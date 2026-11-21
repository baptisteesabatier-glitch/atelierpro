import { Router } from 'express';
import { prisma } from '../db';
import { notFound, wrap } from '../errors';
import { publicLimiter } from '../middleware';
import { TRACKING_STEPS } from '../services/repairs';
import { getSettings } from '../services/settings';

const router = Router();

/**
 * Suivi public : uniquement le jeton (32 caractères aléatoires).
 * Aucune donnée personnelle du client, aucune note interne, aucun prix.
 */
router.get(
  '/track/:token',
  publicLimiter,
  wrap(async (req, res) => {
    const token = req.params.token;
    if (typeof token !== 'string' || token.length < 24) {
      throw notFound('Lien de suivi invalide.');
    }

    const repair = await prisma.repair.findUnique({
      where: { trackingToken: token },
      include: {
        events: { where: { toStatus: { not: null } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!repair) throw notFound('Aucun dossier ne correspond à ce lien.');

    const settings = await getSettings();
    const reachedAt = new Map<string, Date>();
    for (const event of repair.events) {
      if (event.toStatus && !reachedAt.has(event.toStatus)) {
        reachedAt.set(event.toStatus, event.createdAt);
      }
    }

    const steps = TRACKING_STEPS.map((status) => ({
      status,
      reached: reachedAt.has(status) || (status === 'NEW' && true),
      at: reachedAt.get(status) ?? (status === 'NEW' ? repair.receivedAt : null),
    }));

    const currentIndex = TRACKING_STEPS.indexOf(repair.status);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      tracking: {
        reference: repair.reference,
        status: repair.status,
        currentIndex,
        brand: repair.brand,
        model: repair.model,
        receivedAt: repair.receivedAt,
        readyAt: repair.readyAt,
        returnedAt: repair.returnedAt,
        cancelledAt: repair.cancelledAt,
        isReady: repair.status === 'READY',
        steps,
        shop: {
          name: settings.companyName,
          phone: settings.phone,
          email: settings.email,
          address: [settings.address, settings.postalCode, settings.city]
            .filter(Boolean)
            .join(', '),
        },
      },
    });
  }),
);

export default router;
