import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { config } from './config';
import { prisma } from './db';

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export interface SessionContext {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

/** Crée une session serveur et renvoie le jeton brut (jamais stocké tel quel). */
export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string },
): Promise<SessionContext> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 86_400_000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip?.slice(0, 64),
      userAgent: meta.userAgent?.slice(0, 250),
    },
  });

  return { token, csrfToken: randomToken(24), expiresAt };
}

export function setSessionCookies(res: Response, session: SessionContext): void {
  res.cookie(config.sessionCookie, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    expires: session.expiresAt,
  });
  // Jeton CSRF lisible par le client (double soumission), pas un secret de session.
  res.cookie(config.csrfCookie, session.csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    expires: session.expiresAt,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(config.sessionCookie, { path: '/' });
  res.clearCookie(config.csrfCookie, { path: '/' });
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Purge des sessions expirées — appelée au démarrage et périodiquement. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
