import { Router } from 'express';
import { prisma } from '../db';
import { wrap } from '../errors';
import { requireAuth } from '../middleware';
import { ACTIVE_STATUSES, serializeRepair } from '../services/repairs';
import { getSettings } from '../services/settings';
import type { RepairStatus } from '@prisma/client';

const router = Router();

router.use(requireAuth);

const DAY_MS = 86_400_000;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

router.get(
  '/summary',
  wrap(async (_req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const windowStart = new Date(now.getTime() - 13 * DAY_MS);
    windowStart.setHours(0, 0, 0, 0);

    const [
      activeCount,
      urgentCount,
      readyCount,
      awaitingQuotes,
      paidThisMonth,
      activeRepairs,
      returnedRepairs,
      distributionRaw,
      priorityRepairs,
      recentEvents,
      technicians,
      clientCount,
      userCount,
      settings,
      windowRepairs,
    ] = await Promise.all([
      prisma.repair.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.repair.count({
        where: { status: { in: ACTIVE_STATUSES }, priority: 'URGENT' },
      }),
      prisma.repair.count({ where: { status: 'READY' } }),
      prisma.quote.count({ where: { status: 'SENT' } }),
      prisma.repair.aggregate({
        where: { paidAt: { gte: startOfMonth } },
        _sum: { paidAmountCents: true },
        _count: { _all: true },
      }),
      prisma.repair.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        select: { estimateCents: true },
      }),
      prisma.repair.findMany({
        where: { returnedAt: { not: null } },
        select: { receivedAt: true, returnedAt: true },
      }),
      prisma.repair.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.repair.findMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          OR: [{ priority: 'URGENT' }, { status: 'PART_ORDERED' }, { status: 'READY' }],
        },
        include: {
          client: true,
          assignedTo: true,
          quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { notes: true, quotes: true } },
        },
        orderBy: [{ priority: 'desc' }, { receivedAt: 'asc' }],
        take: 5,
      }),
      prisma.repairEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          actor: { select: { name: true } },
          repair: { select: { id: true, reference: true, brand: true, model: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: 'TECHNICIAN', active: true },
        select: {
          id: true,
          name: true,
          assigned: {
            select: { status: true, paidAmountCents: true, estimateCents: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.client.count(),
      prisma.user.count({ where: { active: true } }),
      getSettings(),
      prisma.repair.findMany({
        where: {
          OR: [
            { receivedAt: { gte: windowStart } },
            { returnedAt: { gte: windowStart } },
            { paidAt: { gte: windowStart } },
          ],
        },
        select: { receivedAt: true, returnedAt: true, paidAt: true, paidAmountCents: true },
      }),
    ]);

    const pendingCents = activeRepairs.reduce((sum, repair) => sum + repair.estimateCents, 0);
    const billedMonthCents = paidThisMonth._sum.paidAmountCents ?? 0;

    const avgRepairDays =
      returnedRepairs.length > 0
        ? returnedRepairs.reduce(
            (sum, repair) =>
              sum + (repair.returnedAt!.getTime() - repair.receivedAt.getTime()),
            0,
          ) /
          returnedRepairs.length /
          DAY_MS
        : 0;

    // Série de 14 jours : entrées, sorties, encaissements réels.
    const series = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(windowStart.getTime() + index * DAY_MS);
      const key = dayKey(date);
      const received = windowRepairs.filter(
        (repair) => dayKey(repair.receivedAt) === key,
      ).length;
      const returned = windowRepairs.filter(
        (repair) => repair.returnedAt && dayKey(repair.returnedAt) === key,
      ).length;
      const paidCents = windowRepairs
        .filter((repair) => repair.paidAt && dayKey(repair.paidAt) === key)
        .reduce((sum, repair) => sum + repair.paidAmountCents, 0);
      return { date: key, received, returned, paidCents };
    });

    const distribution = distributionRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    const goal = settings.monthlyGoalCents || 0;

    res.json({
      generatedAt: new Date().toISOString(),
      counts: {
        active: activeCount,
        urgent: urgentCount,
        ready: readyCount,
        awaitingQuotes,
        clients: clientCount,
        users: userCount,
        returnedTotal: returnedRepairs.length,
      },
      revenue: {
        // Argent réellement encaissé (paiement enregistré), jamais une estimation.
        billedMonthCents,
        billedAllTimeCents: await prisma.repair
          .aggregate({ _sum: { paidAmountCents: true } })
          .then((result) => result._sum.paidAmountCents ?? 0),
        pendingCents,
        monthlyGoalCents: goal,
        goalProgress: goal > 0 ? Math.round((billedMonthCents / goal) * 100) : 0,
      },
      avgRepairDays: Number(avgRepairDays.toFixed(2)),
      series,
      distribution,
      statuses: [
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
      ].map((status) => ({
        status: status as RepairStatus,
        count: distribution[status] ?? 0,
      })),
      priorities: priorityRepairs.map(serializeRepair),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        type: event.type,
        message: event.message,
        createdAt: event.createdAt,
        actorName: event.actor?.name ?? null,
        repair: event.repair,
      })),
      technicians: technicians.map((technician) => {
        const active = technician.assigned.filter((repair) =>
          (ACTIVE_STATUSES as string[]).includes(repair.status),
        ).length;
        const completed = technician.assigned.filter(
          (repair) => repair.status === 'RETURNED',
        ).length;
        const billedCents = technician.assigned.reduce(
          (sum, repair) => sum + repair.paidAmountCents,
          0,
        );
        const pipelineCents = technician.assigned
          .filter((repair) => (ACTIVE_STATUSES as string[]).includes(repair.status))
          .reduce((sum, repair) => sum + repair.estimateCents, 0);
        return {
          id: technician.id,
          name: technician.name,
          active,
          completed,
          billedCents,
          pipelineCents,
        };
      }),
    });
  }),
);

export default router;
