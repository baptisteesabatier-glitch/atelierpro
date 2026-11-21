import { Router } from 'express';
import { prisma } from '../db';
import { audit } from '../audit';
import { conflict, notFound, wrap } from '../errors';
import { requireAdmin, requireAuth, requirePermission } from '../middleware';
import { clientCreateSchema, clientUpdateSchema } from '../validation';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const clients = await prisma.client.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        repairs: {
          select: { id: true, status: true, estimateCents: true, paidAmountCents: true },
        },
      },
    });

    res.json({
      clients: clients.map((client) => {
        const active = client.repairs.filter(
          (repair) => repair.status !== 'RETURNED' && repair.status !== 'CANCELLED',
        ).length;
        const billedCents = client.repairs.reduce(
          (sum, repair) => sum + repair.paidAmountCents,
          0,
        );
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
          postalCode: client.postalCode,
          city: client.city,
          notes: client.notes,
          createdAt: client.createdAt,
          stats: { repairs: client.repairs.length, active, billedCents },
        };
      }),
    });
  }),
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        repairs: {
          orderBy: { receivedAt: 'desc' },
          select: {
            id: true,
            reference: true,
            status: true,
            brand: true,
            model: true,
            estimateCents: true,
            paidAmountCents: true,
            receivedAt: true,
            readyAt: true,
            returnedAt: true,
          },
        },
      },
    });
    if (!client) throw notFound('Client introuvable.');

    res.json({
      client: {
        ...client,
        stats: {
          repairs: client.repairs.length,
          billedCents: client.repairs.reduce((sum, repair) => sum + repair.paidAmountCents, 0),
        },
      },
    });
  }),
);

router.post(
  '/',
  requirePermission('canManageClients'),
  wrap(async (req, res) => {
    const input = clientCreateSchema.parse(req.body);
    const client = await prisma.client.create({ data: input });
    await audit(req, 'CLIENT_CREATED', 'Client', client.id);
    res.status(201).json({ client });
  }),
);

router.patch(
  '/:id',
  requirePermission('canManageClients'),
  wrap(async (req, res) => {
    const input = clientUpdateSchema.parse(req.body);
    const exists = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!exists) throw notFound('Client introuvable.');

    const client = await prisma.client.update({ where: { id: exists.id }, data: input });
    await audit(req, 'CLIENT_UPDATED', 'Client', client.id, { fields: Object.keys(input) });
    res.json({ client });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { repairs: true } } },
    });
    if (!client) throw notFound('Client introuvable.');
    if (client._count.repairs > 0) {
      throw conflict(
        `Suppression impossible : ${client._count.repairs} réparation(s) rattachée(s) à ce client. Archivez ou réaffectez-les d'abord.`,
        { repairs: client._count.repairs },
      );
    }

    await prisma.client.delete({ where: { id: client.id } });
    await audit(req, 'CLIENT_DELETED', 'Client', client.id, { name: client.name });
    res.json({ ok: true });
  }),
);

export default router;
