import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { prisma } from './db';
import { hashToken, randomToken } from './auth';
import { forbidden, unauthorized } from './errors';
import type { SafeUser } from './types';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Charge la session depuis le cookie et attache l'utilisateur à la requête. */
export const attachSession: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[config.sessionCookie] as string | undefined;
    if (!token) return next();

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session) return next();
    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return next();
    }
    if (!session.user.active) return next();

    req.user = toSafeUser(session.user);
    req.sessionId = session.id;

    // Rafraîchit l'activité sans écrire à chaque requête.
    if (Date.now() - session.lastUsedAt.getTime() > 5 * 60_000) {
      await prisma.session
        .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function toSafeUser(user: {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TECHNICIAN';
  active: boolean;
  permissions: unknown;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    permissions: (user.permissions as SafeUser['permissions']) ?? {},
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') return next(forbidden('Réservé aux administrateurs.'));
  next();
};

export type PermissionKey =
  | 'canChangeStatus'
  | 'canEditRepairs'
  | 'canManageClients'
  | 'canCreateQuotes';

export const DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  canChangeStatus: true,
  canEditRepairs: true,
  canManageClients: false,
  canCreateQuotes: false,
};

/** Admin : tout. Technicien : permissions explicites, valeurs par défaut sinon. */
export function hasPermission(user: SafeUser | undefined, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const value = user.permissions?.[key];
  return typeof value === 'boolean' ? value : DEFAULT_PERMISSIONS[key];
}

export const requirePermission =
  (key: PermissionKey): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!hasPermission(req.user, key)) {
      return next(forbidden('Votre profil ne permet pas cette action.'));
    }
    next();
  };

/** Cookie CSRF disponible aussi pour les pages publiques. */
export const issueCsrfCookie: RequestHandler = (req, res, next) => {
  // Un seul jeton par requête : deux cookies du même nom rendraient
  // la double soumission incohérente côté navigateur.
  if (!req.cookies?.[config.csrfCookie] && !res.locals.csrfIssued) {
    res.locals.csrfIssued = true;
    res.cookie(config.csrfCookie, randomToken(24), {
      httpOnly: false,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: config.sessionTtlDays * 86_400_000,
    });
  }
  next();
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Défense CSRF en double soumission : le client renvoie dans l'en-tête
 * la valeur du cookie lisible, comparée en temps constant.
 */
export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (!MUTATING.has(req.method)) return next();
  const cookieToken = req.cookies?.[config.csrfCookie] as string | undefined;
  const headerToken = req.get(config.csrfHeader);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(forbidden('Jeton CSRF manquant ou invalide. Rechargez la page.'));
  }
  next();
};

/** Refuse les mutations provenant d'une origine étrangère. */
export const checkOrigin: RequestHandler = (req, _res, next) => {
  if (!MUTATING.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // clients non-navigateur (curl, tests)
  const allowed = new Set([config.appOrigin, `${req.protocol}://${req.get('host')}`]);
  if (!allowed.has(origin.replace(/\/$/, ''))) {
    return next(forbidden('Origine non autorisée.'));
  }
  next();
};

export const loginLimiter = rateLimit({
  windowMs: config.loginWindowMinutes * 60_000,
  limit: config.loginMaxAttempts,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Trop de tentatives. Réessayez dans quelques minutes.',
    },
  },
});

export const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export function noop(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
