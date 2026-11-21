import { Router } from 'express';
import { Prisma, type RepairStatus } from '@prisma/client';
import { prisma } from '../db';
import { audit } from '../audit';
import { HttpError, badRequest, notFound, wrap } from '../errors';
import {
  hasPermission,
  requireAdmin,
  requireAuth,
  requirePermission,
} from '../middleware';
import {
  noteCreateSchema,
  paymentSchema,
  repairCreateSchema,
  repairUpdateSchema,
  statusUpdateSchema,
} from '../validation';
import {
  assertTransition,
  newTrackingToken,
  serializeRepair,
  statusTimestamps,
} from '../services/repairs';
import { nextRepairReference } from '../services/references';
import { renderDepositSlip, renderReturnSlip } from '../services/documents';
import { getSettings } from '../services/settings';

const router = Router();

router.use(requireAuth);

const listInclude = {
  client: true,
  assignedTo: true,
  quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
  _count: { select: { notes: true, quotes: true } },
} satisfies Prisma.RepairInclude;

const detailInclude = {
  client: true,
  assignedTo: true,
  notes: { include: { author: true } },
  events: { include: { actor: true } },
  quotes: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.RepairInclude;

function parseStatuses(value: unknown): RepairStatus[] | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const list = value.split(',').map((entry) => entry.trim().toUpperCase());
  const valid: RepairStatus[] = [
    'NEW',
    'DIAGNOSIS',
    'QUOTE_SENT',
    'AWAITING_APPROVAL',
    'PART_ORDERED',
    'IN_PROGRESS',
    'REPAIRED',
    'READY',
    'RETURNED',
    'CANCELLED',
  ];
  const filtered = list.filter((entry): entry is RepairStatus =>
    (valid as string[]).includes(entry),
  );
  return filtered.length ? filtered : undefined;
}

router.get(
  '/',
  wrap(async (req, res) => {
    const statuses = parseStatuses(req.query.status);
    const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
    const assignee = typeof req.query.assignee === 'string' ? req.query.assignee : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';

    const where: Prisma.RepairWhereInput = {
      status: statuses ? { in: statuses } : undefined,
      priority:
        priority && ['LOW', 'NORMAL', 'URGENT'].includes(priority)
          ? (priority as 'LOW' | 'NORMAL' | 'URGENT')
          : undefined,
      assignedToId: assignee ?? undefined,
      OR: q
        ? [
            { reference: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
            { serialNumber: { contains: q, mode: 'insensitive' } },
            { issue: { contains: q, mode: 'insensitive' } },
            { client: { name: { contains: q, mode: 'insensitive' } } },
            { client: { phone: { contains: q } } },
          ]
        : undefined,
    };

    const orderBy: Prisma.RepairOrderByWithRelationInput[] =
      sort === 'priority'
        ? [{ priority: 'desc' }, { receivedAt: 'asc' }]
        : sort === 'estimate'
          ? [{ estimateCents: 'desc' }]
          : sort === 'oldest'
            ? [{ receivedAt: 'asc' }]
            : [{ receivedAt: 'desc' }];

    const repairs = await prisma.repair.findMany({
      where,
      orderBy,
      take: 400,
      include: listInclude,
    });

    res.json({ repairs: repairs.map(serializeRepair) });
  }),
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const repair = await prisma.repair.findUnique({
      where: { id: req.params.id },
      include: detailInclude,
    });
    if (!repair) throw notFound('Dossier introuvable.');
    res.json({ repair: serializeRepair(repair) });
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    const input = repairCreateSchema.parse(req.body);

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw badRequest('Client inconnu.');
    if (input.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: input.assignedToId, active: true },
      });
      if (!user) throw badRequest('Technicien inconnu ou inactif.');
    }

    let created: Awaited<ReturnType<typeof prisma.repair.create>> | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      try {
        created = await prisma.repair.create({
          data: {
            ...input,
            reference: await nextRepairReference(prisma, attempt),
            trackingToken: newTrackingToken(),
            status: 'NEW',
            events: {
              create: { type: 'CREATED', toStatus: 'NEW', actorId: req.user!.id },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 4
        ) {
          continue;
        }
        throw error;
      }
    }
    if (!created) throw new HttpError(500, 'REFERENCE', 'Impossible de générer une référence.');

    const full = await prisma.repair.findUniqueOrThrow({
      where: { id: created.id },
      include: detailInclude,
    });
    await audit(req, 'REPAIR_CREATED', 'Repair', created.id, {
      reference: created.reference,
      clientId: created.clientId,
    });
    res.status(201).json({ repair: serializeRepair(full) });
  }),
);

router.patch(
  '/:id',
  requirePermission('canEditRepairs'),
  wrap(async (req, res) => {
    const input = repairUpdateSchema.parse(req.body);
    const existing = await prisma.repair.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Dossier introuvable.');

    if (input.clientId) {
      const client = await prisma.client.findUnique({ where: { id: input.clientId } });
      if (!client) throw badRequest('Client inconnu.');
    }
    if (input.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: input.assignedToId, active: true },
      });
      if (!user) throw badRequest('Technicien inconnu ou inactif.');
    }

    const repair = await prisma.repair.update({
      where: { id: existing.id },
      data: {
        ...input,
        events: {
          create: {
            type: 'UPDATED',
            message: `Champs modifiés : ${Object.keys(input).join(', ')}`,
            actorId: req.user!.id,
          },
        },
      },
      include: detailInclude,
    });

    await audit(req, 'REPAIR_UPDATED', 'Repair', repair.id, { fields: Object.keys(input) });
    res.json({ repair: serializeRepair(repair) });
  }),
);

router.patch(
  '/:id/status',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'canChangeStatus')) {
      throw new HttpError(403, 'FORBIDDEN', 'Votre profil ne permet pas de changer un statut.');
    }
    const { status, message, force } = statusUpdateSchema.parse(req.body);

    const existing = await prisma.repair.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Dossier introuvable.');

    assertTransition(existing.status, status, {
      isAdmin: req.user!.role === 'ADMIN',
      force,
    });

    const repair = await prisma.repair.update({
      where: { id: existing.id },
      data: {
        status,
        ...statusTimestamps(status),
        events: {
          create: {
            type: 'STATUS_CHANGE',
            fromStatus: existing.status,
            toStatus: status,
            message: message ?? null,
            actorId: req.user!.id,
          },
        },
      },
      include: detailInclude,
    });

    await audit(req, 'REPAIR_STATUS', 'Repair', repair.id, {
      from: existing.status,
      to: status,
      forced: force === true,
    });
    res.json({ repair: serializeRepair(repair) });
  }),
);

router.post(
  '/:id/notes',
  wrap(async (req, res) => {
    const { body } = noteCreateSchema.parse(req.body);
    const existing = await prisma.repair.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Dossier introuvable.');

    const note = await prisma.note.create({
      data: { repairId: existing.id, authorId: req.user!.id, body },
      include: { author: true },
    });
    await prisma.repairEvent.create({
      data: { repairId: existing.id, type: 'NOTE', actorId: req.user!.id, message: null },
    });
    await audit(req, 'REPAIR_NOTE', 'Repair', existing.id);

    res.status(201).json({
      note: {
        id: note.id,
        body: note.body,
        createdAt: note.createdAt,
        author: note.author ? { id: note.author.id, name: note.author.name } : null,
      },
    });
  }),
);

router.post(
  '/:id/payment',
  requireAdmin,
  wrap(async (req, res) => {
    const { paid, amountCents } = paymentSchema.parse(req.body);
    const existing = await prisma.repair.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Dossier introuvable.');

    const repair = await prisma.repair.update({
      where: { id: existing.id },
      data: {
        paidAmountCents: paid ? (amountCents ?? existing.estimateCents) : 0,
        paidAt: paid ? new Date() : null,
        events: {
          create: {
            type: paid ? 'PAYMENT_RECEIVED' : 'PAYMENT_CANCELLED',
            message: paid
              ? `Encaissement de ${((amountCents ?? existing.estimateCents) / 100).toFixed(2)} €`
              : 'Encaissement annulé',
            actorId: req.user!.id,
          },
        },
      },
      include: detailInclude,
    });
    await audit(req, paid ? 'REPAIR_PAID' : 'REPAIR_PAYMENT_CANCELLED', 'Repair', repair.id, {
      amountCents: amountCents ?? null,
    });
    res.json({ repair: serializeRepair(repair) });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const existing = await prisma.repair.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Dossier introuvable.');
    await prisma.repair.delete({ where: { id: existing.id } });
    await audit(req, 'REPAIR_DELETED', 'Repair', existing.id, { reference: existing.reference });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/deposit-slip.pdf',
  wrap(async (req, res) => {
    const repair = await prisma.repair.findUnique({
      where: { id: req.params.id },
      include: { client: true, assignedTo: true },
    });
    if (!repair) throw notFound('Dossier introuvable.');
    const settings = await getSettings();
    await renderDepositSlip(res, repair, settings);
  }),
);

router.get(
  '/:id/return-slip.pdf',
  wrap(async (req, res) => {
    const repair = await prisma.repair.findUnique({
      where: { id: req.params.id },
      include: { client: true, assignedTo: true },
    });
    if (!repair) throw notFound('Dossier introuvable.');
    const settings = await getSettings();
    await renderReturnSlip(res, repair, settings);
  }),
);

export default router;
