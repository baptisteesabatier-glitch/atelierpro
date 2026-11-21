import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRecord, resetDb, session } from './helpers';

beforeEach(resetDb);

describe('sauvegarde et restauration', () => {
  it('exporte puis restaure les données métier', async () => {
    const admin = await session('ADMIN');
    const client = await createClientRecord('Client Sauvegardé');
    const created = await admin.agent
      .post('/api/repairs')
      .set('x-csrf-token', admin.csrf)
      .send({
        clientId: client.id,
        category: 'TABLET',
        brand: 'Apple',
        model: 'iPad Air',
        issue: 'Connecteur de charge défectueux',
        estimateCents: 9500,
      });
    const repairId = created.body.repair.id as string;
    await admin.agent
      .post(`/api/repairs/${repairId}/notes`)
      .set('x-csrf-token', admin.csrf)
      .send({ body: 'Note à conserver dans la sauvegarde.' });

    const exported = await admin.agent.get('/api/backups/export');
    expect(exported.status).toBe(200);
    expect(exported.headers['content-disposition']).toMatch(/atelierpro-backup/);
    const file = exported.body as {
      format: string;
      version: string;
      checksum: string;
      payload: { clients: unknown[]; repairs: unknown[]; notes: unknown[] };
    };
    expect(file.format).toBe('atelierpro-backup');
    expect(file.version).toBe('2.0.0');
    expect(file.checksum).toHaveLength(64);
    expect(file.payload.clients).toHaveLength(1);
    expect(file.payload.repairs).toHaveLength(1);

    // Une donnée ajoutée après l'export doit disparaître à la restauration.
    await createClientRecord('Client Ajouté Après Export');
    const before = await admin.agent.get('/api/clients');
    expect(before.body.clients).toHaveLength(2);

    const imported = await admin.agent
      .post('/api/backups/import')
      .set('x-csrf-token', admin.csrf)
      .send(file);
    expect(imported.status).toBe(200);
    expect(imported.body.imported.clients).toBe(1);
    expect(imported.body.imported.repairs).toBe(1);

    const after = await admin.agent.get('/api/clients');
    expect(after.body.clients).toHaveLength(1);
    expect(after.body.clients[0].name).toBe('Client Sauvegardé');

    const detail = await admin.agent.get(`/api/repairs/${repairId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.repair.notes[0].body).toContain('sauvegarde');
  });

  it('refuse une sauvegarde dont l’empreinte ne correspond pas', async () => {
    const admin = await session('ADMIN');
    const exported = await admin.agent.get('/api/backups/export');
    const file = exported.body as Record<string, unknown>;

    const tampered = { ...file, checksum: 'a'.repeat(64) };
    const response = await admin.agent
      .post('/api/backups/import')
      .set('x-csrf-token', admin.csrf)
      .send(tampered);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/intégrité/i);
  });

  it('refuse une version de sauvegarde incompatible', async () => {
    const admin = await session('ADMIN');
    const exported = await admin.agent.get('/api/backups/export');
    const file = exported.body as Record<string, unknown>;

    const response = await admin.agent
      .post('/api/backups/import')
      .set('x-csrf-token', admin.csrf)
      .send({ ...file, version: '1.0.0' });

    expect(response.status).toBe(400);
  });

  it('réserve la sauvegarde aux administrateurs', async () => {
    const tech = await session('TECHNICIAN');
    const exported = await tech.agent.get('/api/backups/export');
    expect(exported.status).toBe(403);
  });
});
