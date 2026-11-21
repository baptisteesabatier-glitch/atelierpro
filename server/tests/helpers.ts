import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { hashPassword } from '../src/auth';

export const app = createApp();
export const PASSWORD = 'MotDePasseTest2026!';

export type Agent = ReturnType<typeof request.agent>;

export function newAgent(): Agent {
  return request.agent(app);
}

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "RepairEvent","Note","QuoteItem","Quote","Repair","Client","Session","AuditLog","User","Setting" RESTART IDENTITY CASCADE',
  );
  await prisma.setting.create({ data: { id: 'main' } });
}

export async function createUser(
  role: 'ADMIN' | 'TECHNICIAN',
  options: { email?: string; name?: string; permissions?: Record<string, boolean> } = {},
) {
  const email = options.email ?? `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@atelier.test`;
  return prisma.user.create({
    data: {
      email,
      name: options.name ?? (role === 'ADMIN' ? 'Admin Test' : 'Technicien Test'),
      role,
      passwordHash: await hashPassword(PASSWORD),
      permissions: options.permissions ?? undefined,
    },
  });
}

/** Récupère un jeton CSRF en double soumission (cookie lisible + en-tête). */
export async function csrfToken(agent: Agent): Promise<string> {
  const response = await agent.get('/api/auth/me');
  const cookies = (response.headers['set-cookie'] ?? []) as unknown as string[];
  const cookie = cookies.find((entry) => entry.startsWith('ap_csrf='));
  if (!cookie) throw new Error('Cookie CSRF absent');
  return decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('='));
}

export async function login(
  agent: Agent,
  email: string,
  password = PASSWORD,
): Promise<{ csrf: string; body: Record<string, unknown> }> {
  const csrf = await csrfToken(agent);
  const response = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrf)
    .send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Connexion impossible (${response.status}) : ${JSON.stringify(response.body)}`);
  }
  return { csrf: (response.body as { csrfToken: string }).csrfToken, body: response.body };
}

export async function session(
  role: 'ADMIN' | 'TECHNICIAN',
  permissions?: Record<string, boolean>,
) {
  const user = await createUser(role, { permissions });
  const agent = newAgent();
  const { csrf } = await login(agent, user.email);
  return { agent, csrf, user };
}

export async function createClientRecord(name = 'Client Test') {
  const suffix = Math.random().toString(16).slice(2, 8);
  return prisma.client.create({
    data: {
      name,
      phone: '06 12 34 56 78',
      email: `client-${suffix}@example.com`,
      city: 'Lyon',
    },
  });
}
