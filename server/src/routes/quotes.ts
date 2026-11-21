import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { audit } from '../audit';
import { conflict, notFound, wrap } from '../errors';
import { hasPermission, requireAuth, requirePermission } from '../middleware';
import { HttpError } from '../errors';
import {
  quoteCreateSchema,
  quoteStatusSchema,
  quoteUpdateSchema,
} from '../validation';
import {
  assertTransition,
  computeQuoteTotals,
  statusTimestamps,
} from '../services/repairs';
import { nextQuoteNumber } from '../services/references';
import { getSettings } from '../services/settings';
import { renderQuote } from '../services/documents';

const router = Router();

router.use(requireAuth);

const quoteInclude = {
  items: { orderBy: { position: 'asc' } },
  repair: { include: { client: true } },
} as const;

router.get(
  '/',
  wrap(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const quotes = await prisma.quote.findMany({
      where:
        status && ['DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED'].includes(status)
          ? { status: status as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED' }
          : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: quoteInclude,
    });

    res.json({
      quotes: quotes.map((quote) => ({
        id: quote.id,
        number: quote.number,
        status: quote.status,
        totalCents: quote.totalCents,
        vatCents: quote.vatCents,
        subtotalCents: quote.subtotalCents,
        vatRate: quote.vatRate,
        issuedAt: quote.issuedAt,
        validUntil: quote.validUntil,
        repair: {
          id: quote.repair.id,
          reference: quote.repair.reference,
          clientName: quote.repair.client.name,
          status: quote.repair.status,
        },
        itemsCount: quote.items.length,
      })),
    });
  }),
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: quoteInclude,
    });
    if (!quote) throw notFound('Devis introuvable.');
    res.json({ quote });
  }),
);

router.post(
  '/',
  requirePermission('canCreateQuotes'),
  wrap(async (req, res) => {
    const input = quoteCreateSchema.parse(req.body);
    const repairId = z.string().min(1).safeParse((req.body as { repairId?: string }).repairId);
    if (!repairId.success) throw new HttpError(400, 'BAD_REQUEST', 'Dossier cible requis.');

    const repair = await prisma.repair.findUnique({ where: { id: repairId.data } });
    if (!repair) throw notFound('Dossier introuvable.');

    const settings = await getSettings();
    const vatRate = input.vatRate ?? settings.vatRate;
    const totals = computeQuoteTotals(input.items, vatRate);
    const validUntil =
      input.validUntil ?? new Date(Date.now() + settings.quoteValidityDays * 86_400_000);

    const quote = await prisma.quote.create({
      data: {
        repairId: repair.id,
        number: await nextQuoteNumber(prisma, settings.quotePrefix),
        vatRate,
        validUntil,
        notes: input.notes,
        ...totals,
        items: {
          create: input.items.map((item, index) => ({
            kind: item.kind,
            label: item.label,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            position: index,
          })),
        },
      },
      include: quoteInclude,
    });

    await prisma.repairEvent.create({
      data: {
        repairId: repair.id,
        type: 'QUOTE_CREATED',
        actorId: req.user!.id,
        message: `Devis ${quote.number} créé`,
      },
    });
    await audit(req, 'QUOTE_CREATED', 'Quote', quote.id, { number: quote.number });

    res.status(201).json({ quote });
  }),
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'canCreateQuotes')) {
      throw new HttpError(403, 'FORBIDDEN', 'Création de devis non autorisée.');
    }
    const input = quoteUpdateSchema.parse(req.body);
    const existing = await prisma.quote.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Devis introuvable.');
    if (existing.status === 'ACCEPTED' || existing.status === 'REFUSED') {
      throw conflict('Un devis accepté ou refusé ne peut plus être modifié.');
    }

    const vatRate = input.vatRate ?? existing.vatRate;
    const items = input.items;
    const totals = items
      ? computeQuoteTotals(items, vatRate)
      : computeQuoteTotals(
          await prisma.quoteItem.findMany({
            where: { quoteId: existing.id },
            select: { quantity: true, unitPriceCents: true },
          }),
          vatRate,
        );

    const quote = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } });
        await tx.quoteItem.createMany({
          data: items.map((item, index) => ({
            quoteId: existing.id,
            kind: item.kind,
            label: item.label,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            position: index,
          })),
        });
      }
      return tx.quote.update({
        where: { id: existing.id },
        data: {
          vatRate,
          notes: input.notes,
          validUntil: input.validUntil,
          ...totals,
        },
        include: quoteInclude,
      });
    });

    await audit(req, 'QUOTE_UPDATED', 'Quote', quote.id);
    res.json({ quote });
  }),
);

router.post(
  '/:id/status',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'canCreateQuotes')) {
      throw new HttpError(403, 'FORBIDDEN', 'Gestion des devis non autorisée.');
    }
    const { status } = quoteStatusSchema.parse(req.body);
    const existing = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { repair: true },
    });
    if (!existing) throw notFound('Devis introuvable.');

    const quote = await prisma.quote.update({
      where: { id: existing.id },
      data: {
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : existing.acceptedAt,
      },
      include: quoteInclude,
    });

    // Le statut du dossier suit le devis, sans jamais forcer une transition invalide.
    let repairStatus = existing.repair.status;
    if (status === 'SENT' && ['NEW', 'DIAGNOSIS'].includes(existing.repair.status)) {
      repairStatus = 'QUOTE_SENT';
    } else if (
      status === 'ACCEPTED' &&
      ['QUOTE_SENT', 'AWAITING_APPROVAL', 'DIAGNOSIS'].includes(existing.repair.status)
    ) {
      repairStatus = 'IN_PROGRESS';
    }

    if (repairStatus !== existing.repair.status) {
      try {
        assertTransition(existing.repair.status, repairStatus, {
          isAdmin: req.user!.role === 'ADMIN',
        });
        await prisma.repair.update({
          where: { id: existing.repair.id },
          data: {
            status: repairStatus,
            ...statusTimestamps(repairStatus),
            events: {
              create: {
                type: 'STATUS_CHANGE',
                fromStatus: existing.repair.status,
                toStatus: repairStatus,
                message: `Devis ${existing.number} : ${status}`,
                actorId: req.user!.id,
              },
            },
          },
        });
      } catch {
        /* la transition n'était pas permise : le devis reste modifié */
      }
    }

    await prisma.repairEvent.create({
      data: {
        repairId: existing.repair.id,
        type: 'QUOTE_STATUS',
        actorId: req.user!.id,
        message: `Devis ${existing.number} → ${status}`,
      },
    });
    await audit(req, 'QUOTE_STATUS', 'Quote', quote.id, { status });
    res.json({ quote });
  }),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    if (req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'FORBIDDEN', 'Seul un administrateur peut supprimer un devis.');
    }
    const existing = await prisma.quote.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Devis introuvable.');
    if (existing.status === 'ACCEPTED') {
      throw conflict('Un devis accepté ne peut pas être supprimé.');
    }
    await prisma.quote.delete({ where: { id: existing.id } });
    await audit(req, 'QUOTE_DELETED', 'Quote', existing.id, { number: existing.number });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/pdf',
  wrap(async (req, res) => {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: quoteInclude,
    });
    if (!quote) throw notFound('Devis introuvable.');
    const settings = await getSettings();
    await renderQuote(res, quote, settings);
  }),
);

export default router;
