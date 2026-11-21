import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRecord, newAgent, resetDb, session } from './helpers';

beforeEach(resetDb);

describe('suivi client public', () => {
  it('expose l’avancement sans aucune donnée personnelle', async () => {
    const { agent, csrf } = await session('ADMIN');
    const client = await createClientRecord('Claire Martin');
    const created = await agent
      .post('/api/repairs')
      .set('x-csrf-token', csrf)
      .send({
        clientId: client.id,
        category: 'PHONE',
        brand: 'Samsung',
        model: 'Galaxy S22',
        serialNumber: 'SERIE-CONFIDENTIELLE',
        issue: 'Écran fissuré, tactile partiel',
        estimateCents: 15900,
      });
    const repair = created.body.repair as { id: string; trackingToken: string; reference: string };

    await agent
      .patch(`/api/repairs/${repair.id}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'DIAGNOSIS' });
    await agent
      .post(`/api/repairs/${repair.id}/notes`)
      .set('x-csrf-token', csrf)
      .send({ body: 'Note interne confidentielle : client difficile.' });

    const response = await newAgent().get(`/api/public/track/${repair.trackingToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.tracking.reference).toBe(repair.reference);
    expect(response.body.tracking.status).toBe('DIAGNOSIS');
    expect(response.body.tracking.steps).toHaveLength(9);
    expect(response.body.tracking.steps[1].reached).toBe(true);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(client.phone);
    expect(serialized).not.toContain(client.email ?? 'client-inexistant@example.com');
    expect(serialized).not.toContain('Claire Martin');
    expect(serialized).not.toContain('SERIE-CONFIDENTIELLE');
    expect(serialized).not.toContain('confidentielle');
    expect(serialized).not.toContain('15900');
    expect(serialized).not.toContain('trackingToken');
  });

  it('renvoie 404 pour un jeton inconnu', async () => {
    const response = await newAgent().get(
      '/api/public/track/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(response.status).toBe(404);
  });

  it('refuse un jeton manifestement invalide', async () => {
    const response = await newAgent().get('/api/public/track/court');
    expect(response.status).toBe(404);
  });
});
