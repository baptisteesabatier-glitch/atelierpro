import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRecord, resetDb, session } from './helpers';

beforeEach(resetDb);

describe('tableau de bord', () => {
  it('sépare l’argent encaissé des montants estimés', async () => {
    const admin = await session('ADMIN');
    const tech = await session('TECHNICIAN');
    const client = await createClientRecord();

    const active = await admin.agent
      .post('/api/repairs')
      .set('x-csrf-token', admin.csrf)
      .send({
        clientId: client.id,
        category: 'PHONE',
        brand: 'Apple',
        model: 'iPhone 14',
        issue: 'Écran cassé',
        estimateCents: 12900,
        priority: 'URGENT',
        assignedToId: tech.user.id,
      });
    expect(active.status).toBe(201);

    const paid = await admin.agent
      .post('/api/repairs')
      .set('x-csrf-token', admin.csrf)
      .send({
        clientId: client.id,
        category: 'CONSOLE',
        brand: 'Sony',
        model: 'PlayStation 5',
        issue: 'Surchauffe',
        estimateCents: 8900,
      });
    const paidId = paid.body.repair.id as string;

    await admin.agent
      .patch(`/api/repairs/${paidId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'DIAGNOSIS' });
    await admin.agent
      .patch(`/api/repairs/${paidId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'IN_PROGRESS' });
    await admin.agent
      .patch(`/api/repairs/${paidId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'REPAIRED' });
    await admin.agent
      .patch(`/api/repairs/${paidId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'READY' });

    const payment = await admin.agent
      .post(`/api/repairs/${paidId}/payment`)
      .set('x-csrf-token', admin.csrf)
      .send({ paid: true, amountCents: 8900 });
    expect(payment.status).toBe(200);
    expect(payment.body.repair.paidAmountCents).toBe(8900);

    const summary = await admin.agent.get('/api/dashboard/summary');
    expect(summary.status).toBe(200);

    const body = summary.body as {
      counts: { active: number; urgent: number; ready: number; clients: number };
      revenue: {
        billedMonthCents: number;
        billedAllTimeCents: number;
        pendingCents: number;
        monthlyGoalCents: number;
      };
      avgRepairDays: number;
      series: unknown[];
      statuses: { status: string; count: number }[];
      technicians: { id: string; active: number; billedCents: number }[];
    };

    // Le dossier payé reste actif (READY) mais seul 8900 €/100 a été encaissé.
    expect(body.counts.active).toBe(2);
    expect(body.counts.urgent).toBe(1);
    expect(body.counts.ready).toBe(1);
    expect(body.counts.clients).toBe(1);
    expect(body.revenue.billedMonthCents).toBe(8900);
    expect(body.revenue.billedAllTimeCents).toBe(8900);
    expect(body.revenue.pendingCents).toBe(12900 + 8900);
    expect(body.revenue.billedMonthCents).not.toBe(body.revenue.pendingCents);
    expect(body.series).toHaveLength(14);
    expect(body.statuses).toHaveLength(10);
    expect(body.avgRepairDays).toBeGreaterThanOrEqual(0);

    const technician = body.technicians.find((entry) => entry.id === tech.user.id);
    expect(technician?.active).toBe(1);
  });

  it('refuse l’accès sans session', async () => {
    const response = await (await import('./helpers')).newAgent().get('/api/dashboard/summary');
    expect(response.status).toBe(401);
  });
});
