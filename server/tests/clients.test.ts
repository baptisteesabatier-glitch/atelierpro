import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRecord, resetDb, session } from './helpers';

beforeEach(resetDb);

describe('clients', () => {
  it('crée, recherche et modifie un client (administrateur)', async () => {
    const { agent, csrf } = await session('ADMIN');

    const created = await agent
      .post('/api/clients')
      .set('x-csrf-token', csrf)
      .send({
        name: 'Camille Aubert',
        phone: '06 12 44 87 21',
        email: 'camille@example.com',
        address: '8 rue Tête d’Or',
        postalCode: '69006',
        city: 'Lyon',
      });

    expect(created.status).toBe(201);
    expect(created.body.client.name).toBe('Camille Aubert');

    const search = await agent.get('/api/clients').query({ q: 'aubert' });
    expect(search.status).toBe(200);
    expect(search.body.clients).toHaveLength(1);

    const updated = await agent
      .patch(`/api/clients/${created.body.client.id}`)
      .set('x-csrf-token', csrf)
      .send({ city: 'Villeurbanne', phone: '07 00 00 00 00' });

    expect(updated.status).toBe(200);
    expect(updated.body.client.city).toBe('Villeurbanne');

    const detail = await agent.get(`/api/clients/${created.body.client.id}`);
    expect(detail.body.client.repairs).toEqual([]);
    expect(detail.body.client.stats.repairs).toBe(0);
  });

  it('valide les données reçues', async () => {
    const { agent, csrf } = await session('ADMIN');
    const response = await agent
      .post('/api/clients')
      .set('x-csrf-token', csrf)
      .send({ name: 'A', phone: '1' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse la suppression d’un client rattaché à un dossier', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord();

    const repair = await agent
      .post('/api/repairs')
      .set('x-csrf-token', csrf)
      .send({
        clientId: client.id,
        category: 'PHONE',
        brand: 'Apple',
        model: 'iPhone 12',
        issue: 'Batterie à remplacer',
      });
    expect(repair.status).toBe(201);

    const refused = await agent
      .delete(`/api/clients/${client.id}`)
      .set('x-csrf-token', csrf);
    expect(refused.status).toBe(409);
    expect(refused.body.error.details.repairs).toBe(1);
  });

  it('supprime un client sans dossier', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord('Sans dossier');

    const response = await agent
      .delete(`/api/clients/${client.id}`)
      .set('x-csrf-token', csrf);
    expect(response.status).toBe(200);

    const list = await agent.get('/api/clients');
    expect(list.body.clients).toHaveLength(0);
  });

  it('interdit la gestion des clients à un technicien non autorisé', async () => {
    const { agent, csrf } = await session('TECHNICIAN', { canManageClients: false });

    const response = await agent
      .post('/api/clients')
      .set('x-csrf-token', csrf)
      .send({ name: 'Client Interdit', phone: '0600000000' });

    expect(response.status).toBe(403);
  });

  it('autorise un technicien disposant de la permission', async () => {
    const { agent, csrf } = await session('TECHNICIAN', { canManageClients: true });

    const response = await agent
      .post('/api/clients')
      .set('x-csrf-token', csrf)
      .send({ name: 'Client Autorisé', phone: '0600000001' });

    expect(response.status).toBe(201);
  });
});
