import { Router } from 'express';
import { prisma } from '../db';
import { audit } from '../audit';
import { HttpError, wrap } from '../errors';
import { requireAdmin, requireAuth } from '../middleware';
import { settingsUpdateSchema } from '../validation';
import { getSettings } from '../services/settings';
import { config } from '../config';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  wrap(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

router.patch(
  '/',
  requireAdmin,
  wrap(async (req, res) => {
    const input = settingsUpdateSchema.parse(req.body);

    if (input.logoDataUrl && input.logoDataUrl.length > config.uploadMaxBytes) {
      throw new HttpError(413, 'LOGO_TOO_LARGE', 'Le logo dépasse la taille autorisée.');
    }

    const settings = await getSettings();
    const updated = await prisma.setting.update({
      where: { id: settings.id },
      data: input,
    });
    await audit(req, 'SETTINGS_UPDATED', 'Setting', updated.id, {
      fields: Object.keys(input),
    });
    res.json({ settings: updated });
  }),
);

export default router;
