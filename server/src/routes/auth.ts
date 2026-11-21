import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { audit } from '../audit';
import {
  BCRYPT_ROUNDS,
  clearSessionCookies,
  createSession,
  destroySession,
  hashPassword,
  setSessionCookies,
  verifyPassword,
} from '../auth';
import { config } from '../config';
import { HttpError, forbidden, unauthorized, wrap } from '../errors';
import { loginLimiter, requireAuth, toSafeUser } from '../middleware';
import { isLocked, registerFailure, resetFailures } from '../loginThrottle';
import { changePasswordSchema, loginSchema } from '../validation';

const router = Router();

/** Haché factice : égalise le temps de réponse quand l'e-mail est inconnu. */
const DUMMY_HASH = bcrypt.hashSync('atelierpro-timing-equaliser', BCRYPT_ROUNDS);

router.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    if (isLocked(email)) {
      throw new HttpError(
        429,
        'ACCOUNT_LOCKED',
        'Trop de tentatives sur ce compte. Réessayez dans quelques minutes.',
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, DUMMY_HASH).then(() => false);

    if (!user || !valid) {
      registerFailure(email);
      throw unauthorized('E-mail ou mot de passe incorrect.');
    }
    if (!user.active) {
      throw forbidden('Ce compte est désactivé. Contactez un administrateur.');
    }

    resetFailures(email);
    const session = await createSession(user.id, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    setSessionCookies(res, session);

    req.user = toSafeUser(user);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit(req, 'AUTH_LOGIN', 'User', user.id);

    res.json({
      user: req.user,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      version: config.version,
    });
  }),
);

router.post(
  '/logout',
  wrap(async (req, res) => {
    await destroySession(req.cookies?.[config.sessionCookie]);
    clearSessionCookies(res);
    if (req.user) await audit(req, 'AUTH_LOGOUT', 'User', req.user.id);
    res.json({ ok: true });
  }),
);

router.get(
  '/me',
  wrap(async (req, res) => {
    res.json({ user: req.user ?? null, version: config.version });
  }),
);

router.post(
  '/password',
  requireAuth,
  wrap(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Mot de passe actuel incorrect.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    // Révoque les autres sessions : un mot de passe changé doit déconnecter ailleurs.
    await prisma.session.deleteMany({
      where: { userId: user.id, id: { not: req.sessionId ?? '' } },
    });
    await audit(req, 'AUTH_PASSWORD_CHANGED', 'User', user.id);
    res.json({ ok: true });
  }),
);

export default router;
