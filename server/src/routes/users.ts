import { Router } from 'express';
import { prisma } from '../db';
import { audit } from '../audit';
import { hashPassword } from '../auth';
import { badRequest, conflict, notFound, wrap } from '../errors';
import { requireAdmin, requireAuth, toSafeUser } from '../middleware';
import { userCreateSchema, userUpdateSchema } from '../validation';

const router = Router();

router.use(requireAuth, requireAdmin);

async function activeAdminCount(excludeId?: string): Promise<number> {
  return prisma.user.count({
    where: { role: 'ADMIN', active: true, id: excludeId ? { not: excludeId } : undefined },
  });
}

router.get(
  '/',
  wrap(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] });
    res.json({ users: users.map(toSafeUser) });
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    const input = userCreateSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw conflict('Un compte utilise déjà cet e-mail.');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        permissions: input.permissions ?? {},
      },
    });
    await audit(req, 'USER_CREATED', 'User', user.id, { role: user.role });
    res.status(201).json({ user: toSafeUser(user) });
  }),
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const input = userUpdateSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('Utilisateur introuvable.');

    const demoting = (input.role && input.role !== 'ADMIN') || input.active === false;
    if (target.role === 'ADMIN' && demoting) {
      const others = await activeAdminCount(target.id);
      if (others === 0) {
        throw badRequest('Impossible de retirer le dernier administrateur actif.');
      }
    }
    if (target.id === req.user!.id && input.active === false) {
      throw badRequest('Vous ne pouvez pas désactiver votre propre compte.');
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        name: input.name,
        role: input.role,
        active: input.active,
        permissions: input.permissions,
        passwordHash: input.password ? await hashPassword(input.password) : undefined,
      },
    });

    if (input.active === false || input.password) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
    }
    await audit(req, 'USER_UPDATED', 'User', user.id, { fields: Object.keys(input) });
    res.json({ user: toSafeUser(user) });
  }),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('Utilisateur introuvable.');
    if (target.id === req.user!.id) {
      throw badRequest('Vous ne pouvez pas désactiver votre propre compte.');
    }
    if (target.role === 'ADMIN' && (await activeAdminCount(target.id)) === 0) {
      throw badRequest('Impossible de désactiver le dernier administrateur actif.');
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: { active: false },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await audit(req, 'USER_DEACTIVATED', 'User', user.id);
    res.json({ user: toSafeUser(user) });
  }),
);

export default router;
