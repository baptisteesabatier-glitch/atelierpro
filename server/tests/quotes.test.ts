import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRecord, resetDb, session } from './helpers';

beforeEach(resetDb);

async function setupRepair() {
  const admin = await session('ADMIN');
  const client = await createClientRecord();
  const created = await admin.agent
    .post('/api/repairs')
    .set('x-csrf-token', admin.csrf)
    .send({
      clientId: client.id,
      category: 'LAPTOP',
      brand: 'Apple',
      model: 'MacBook Air M1',
      issue: 'Batterie ne tient plus la charge',
      estimateCents: 12900,
    });
  expect(created.status).toBe(201);
  return { admin, client, repairId: created.body.repair.id as string };
}

describe('devis', () => {
  it('calcule HT, TVA et TTC à partir des lignes', async () => {
    const { admin, repairId } = await setupRepair();

    const response = await admin.agent
      .post('/api/quotes')
      .set('x-csrf-token', admin.csrf)
      .send({
        repairId,
        vatRate: 20,
        items: [
          { kind: 'PART', label: 'Batterie MacBook Air M1', quantity: 1, unitPriceCents: 8900 },
          { kind: 'LABOR', label: 'Main d’œuvre', quantity: 2, unitPriceCents: 2500 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.quote.number).toMatch(/^DEV-\d{4}-\d{4}$/);
    expect(response.body.quote.subtotalCents).toBe(13900);
    expect(response.body.quote.vatCents).toBe(2780);
    expect(response.body.quote.totalCents).toBe(16680);
    expect(response.body.quote.items).toHaveLength(2);
  });

  it('fait suivre le statut du dossier quand le devis est envoyé puis accepté', async () => {
    const { admin, repairId } = await setupRepair();
    // Le parcours impose un diagnostic avant l'envoi du devis.
    await admin.agent
      .patch(`/api/repairs/${repairId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'DIAGNOSIS' });

    const quote = await admin.agent
      .post('/api/quotes')
      .set('x-csrf-token', admin.csrf)
      .send({
        repairId,
        items: [{ kind: 'LABOR', label: 'Diagnostic', quantity: 1, unitPriceCents: 4500 }],
      });
    const quoteId = quote.body.quote.id as string;

    const sent = await admin.agent
      .post(`/api/quotes/${quoteId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'SENT' });
    expect(sent.status).toBe(200);

    const afterSend = await admin.agent.get(`/api/repairs/${repairId}`);
    expect(afterSend.body.repair.status).toBe('QUOTE_SENT');

    await admin.agent
      .post(`/api/quotes/${quoteId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'ACCEPTED' });

    const afterAccept = await admin.agent.get(`/api/repairs/${repairId}`);
    expect(afterAccept.body.repair.status).toBe('IN_PROGRESS');
    expect(afterAccept.body.repair.quotes[0].acceptedAt).toBeTruthy();
  });

  it('refuse la création de devis à un technicien non autorisé', async () => {
    const { repairId } = await setupRepair();
    const tech = await session('TECHNICIAN', { canCreateQuotes: false });

    const response = await tech.agent
      .post('/api/quotes')
      .set('x-csrf-token', tech.csrf)
      .send({
        repairId,
        items: [{ kind: 'LABOR', label: 'Intervention', quantity: 1, unitPriceCents: 3000 }],
      });

    expect(response.status).toBe(403);
  });

  it('génère le devis en PDF', async () => {
    const { admin, repairId } = await setupRepair();
    const quote = await admin.agent
      .post('/api/quotes')
      .set('x-csrf-token', admin.csrf)
      .send({
        repairId,
        items: [{ kind: 'PART', label: 'Batterie', quantity: 1, unitPriceCents: 8900 }],
      });

    const pdf = await admin.agent.get(`/api/quotes/${quote.body.quote.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('interdit la suppression d’un devis accepté', async () => {
    const { admin, repairId } = await setupRepair();
    const quote = await admin.agent
      .post('/api/quotes')
      .set('x-csrf-token', admin.csrf)
      .send({
        repairId,
        items: [{ kind: 'LABOR', label: 'Intervention', quantity: 1, unitPriceCents: 3000 }],
      });
    const quoteId = quote.body.quote.id as string;

    await admin.agent
      .post(`/api/quotes/${quoteId}/status`)
      .set('x-csrf-token', admin.csrf)
      .send({ status: 'ACCEPTED' });

    const refused = await admin.agent
      .delete(`/api/quotes/${quoteId}`)
      .set('x-csrf-token', admin.csrf);
    expect(refused.status).toBe(409);
  });
});
