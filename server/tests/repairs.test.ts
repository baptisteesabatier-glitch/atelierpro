import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRecord, resetDb, session, type Agent } from './helpers';

beforeEach(resetDb);

async function createRepair(agent: Agent, csrf: string, clientId: string) {
  const response = await agent
    .post('/api/repairs')
    .set('x-csrf-token', csrf)
    .send({
      clientId,
      category: 'PHONE',
      brand: 'Apple',
      model: 'iPhone 13',
      serialNumber: 'SN-0001',
      issue: 'Écran fissuré après une chute',
      estimateCents: 12900,
      priority: 'URGENT',
    });
  expect(response.status).toBe(201);
  return response.body.repair as {
    id: string;
    reference: string;
    trackingToken: string;
    status: string;
    events: { type: string; toStatus: string | null }[];
  };
}

describe('réparations', () => {
  it('crée un dossier avec une référence unique et un jeton de suivi', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord();

    const first = await createRepair(agent, csrf, client.id);
    const second = await createRepair(agent, csrf, client.id);

    expect(first.reference).toMatch(/^AP-\d{4}-\d{4}$/);
    expect(second.reference).not.toBe(first.reference);
    expect(first.trackingToken.length).toBeGreaterThanOrEqual(24);
    expect(first.status).toBe('NEW');
    expect(first.events[0].type).toBe('CREATED');
  });

  it('modifie un dossier et journalise la modification', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord();
    const repair = await createRepair(agent, csrf, client.id);

    const updated = await agent
      .patch(`/api/repairs/${repair.id}`)
      .set('x-csrf-token', csrf)
      .send({ diagnosis: 'Écran OLED à remplacer', estimateCents: 14900 });

    expect(updated.status).toBe(200);
    expect(updated.body.repair.diagnosis).toBe('Écran OLED à remplacer');
    expect(updated.body.repair.estimateCents).toBe(14900);
    expect(
      updated.body.repair.events.some((event: { type: string }) => event.type === 'UPDATED'),
    ).toBe(true);
  });

  it('applique le parcours de statuts et refuse une transition invalide', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord();
    const repair = await createRepair(agent, csrf, client.id);

    const diagnosis = await agent
      .patch(`/api/repairs/${repair.id}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'DIAGNOSIS', message: 'Appareil pris en charge' });
    expect(diagnosis.status).toBe(200);
    expect(diagnosis.body.repair.status).toBe('DIAGNOSIS');

    const invalid = await agent
      .patch(`/api/repairs/${repair.id}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'READY' });
    expect(invalid.status).toBe(400);

    const forced = await agent
      .patch(`/api/repairs/${repair.id}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'READY', force: true });
    expect(forced.status).toBe(200);
    expect(forced.body.repair.readyAt).toBeTruthy();

    const returned = await agent
      .patch(`/api/repairs/${repair.id}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'RETURNED' });
    expect(returned.status).toBe(200);
    expect(returned.body.repair.returnedAt).toBeTruthy();
  });

  it('ajoute une note interne et l’historique la référence', async () => {
    const { agent, csrf } = await session('TECHNICIAN');
    const client = await createClientRecord();
    const repair = await createRepair(agent, csrf, client.id);

    const note = await agent
      .post(`/api/repairs/${repair.id}/notes`)
      .set('x-csrf-token', csrf)
      .send({ body: 'Client prévenu par téléphone, accord donné.' });

    expect(note.status).toBe(201);
    expect(note.body.note.body).toContain('accord donné');

    const detail = await agent.get(`/api/repairs/${repair.id}`);
    expect(detail.body.repair.notes).toHaveLength(1);
    expect(
      detail.body.repair.events.some((event: { type: string }) => event.type === 'NOTE'),
    ).toBe(true);
  });

  it('interdit le changement de statut sans permission', async () => {
    const admin = await session('ADMIN');
    const client = await createClientRecord();
    const repair = await createRepair(admin.agent, admin.csrf, client.id);

    const tech = await session('TECHNICIAN', { canChangeStatus: false });
    const refused = await tech.agent
      .patch(`/api/repairs/${repair.id}/status`)
      .set('x-csrf-token', tech.csrf)
      .send({ status: 'DIAGNOSIS' });

    expect(refused.status).toBe(403);
  });

  it('filtre et trie la liste des dossiers', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord();
    const repair = await createRepair(agent, csrf, client.id);

    const byStatus = await agent.get('/api/repairs').query({ status: 'NEW' });
    expect(byStatus.body.repairs).toHaveLength(1);

    const byWrongStatus = await agent.get('/api/repairs').query({ status: 'RETURNED' });
    expect(byWrongStatus.body.repairs).toHaveLength(0);

    const bySearch = await agent.get('/api/repairs').query({ q: 'iphone' });
    expect(bySearch.body.repairs[0].id).toBe(repair.id);
  });

  it('réserve la suppression à l’administrateur', async () => {
    const admin = await session('ADMIN');
    const client = await createClientRecord();
    const repair = await createRepair(admin.agent, admin.csrf, client.id);

    const tech = await session('TECHNICIAN');
    const refused = await tech.agent
      .delete(`/api/repairs/${repair.id}`)
      .set('x-csrf-token', tech.csrf);
    expect(refused.status).toBe(403);

    const deleted = await admin.agent
      .delete(`/api/repairs/${repair.id}`)
      .set('x-csrf-token', admin.csrf);
    expect(deleted.status).toBe(200);
  });

  it('produit un bon de dépôt PDF', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord();
    const repair = await createRepair(agent, csrf, client.id);

    const pdf = await agent.get(`/api/repairs/${repair.id}/deposit-slip.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
  });
});
