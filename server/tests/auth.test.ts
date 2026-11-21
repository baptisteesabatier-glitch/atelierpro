import { beforeEach, describe, expect, it } from 'vitest';
import {
  PASSWORD,
  createUser,
  csrfToken,
  login,
  newAgent,
  resetDb,
} from './helpers';

beforeEach(resetDb);

describe('authentification', () => {
  it('refuse un mot de passe incorrect sans révéler d’information', async () => {
    const user = await createUser('ADMIN');
    const agent = newAgent();
    const csrf = await csrfToken(agent);

    const response = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: user.email, password: 'mauvais-mot-de-passe' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/incorrect/i);
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
  });

  it('refuse une mutation sans jeton CSRF', async () => {
    const user = await createUser('ADMIN');
    const response = await newAgent()
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('connecte puis expose la session courante', async () => {
    const user = await createUser('ADMIN');
    const agent = newAgent();
    await login(agent, user.email);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);
    expect(me.body.user.role).toBe('ADMIN');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('déconnecte et invalide la session', async () => {
    const user = await createUser('TECHNICIAN');
    const agent = newAgent();
    const { csrf } = await login(agent, user.email);

    const logout = await agent.post('/api/auth/logout').set('x-csrf-token', csrf);
    expect(logout.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toBeNull();

    const denied = await agent.get('/api/repairs');
    expect(denied.status).toBe(401);
  });

  it('refuse les routes protégées sans session', async () => {
    const response = await newAgent().get('/api/repairs');
    expect(response.status).toBe(401);
  });

  it('change le mot de passe et révoque les autres sessions', async () => {
    const user = await createUser('TECHNICIAN');
    const main = newAgent();
    const { csrf } = await login(main, user.email);

    const other = newAgent();
    await login(other, user.email);

    const changed = await main
      .post('/api/auth/password')
      .set('x-csrf-token', csrf)
      .send({ currentPassword: PASSWORD, newPassword: 'NouveauMotDePasse2026!' });
    expect(changed.status).toBe(200);

    const stillConnected = await main.get('/api/auth/me');
    expect(stillConnected.body.user.email).toBe(user.email);

    const revoked = await other.get('/api/auth/me');
    expect(revoked.body.user).toBeNull();

    const oldPassword = newAgent();
    const oldCsrf = await csrfToken(oldPassword);
    const refused = await oldPassword
      .post('/api/auth/login')
      .set('x-csrf-token', oldCsrf)
      .send({ email: user.email, password: PASSWORD });
    expect(refused.status).toBe(401);

    const newPassword = newAgent();
    const newCsrf = await csrfToken(newPassword);
    const accepted = await newPassword
      .post('/api/auth/login')
      .set('x-csrf-token', newCsrf)
      .send({ email: user.email, password: 'NouveauMotDePasse2026!' });
    expect(accepted.status).toBe(200);
  });

  it('refuse la connexion d’un compte désactivé', async () => {
    const user = await createUser('TECHNICIAN');
    const { prisma } = await import('../src/db');
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });

    const agent = newAgent();
    const csrf = await csrfToken(agent);
    const response = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: user.email, password: PASSWORD });

    expect(response.status).toBe(403);
  });
});
