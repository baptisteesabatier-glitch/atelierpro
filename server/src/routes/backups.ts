import { Router } from 'express';
import { audit } from '../audit';
import { wrap } from '../errors';
import { requireAdmin, requireAuth } from '../middleware';
import { buildBackupFile, importBackup } from '../services/backup';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get(
  '/export',
  wrap(async (req, res) => {
    const file = await buildBackupFile();

    await audit(req, 'BACKUP_EXPORTED', 'Setting', 'main', {
      clients: file.payload.clients.length,
      repairs: file.payload.repairs.length,
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="atelierpro-backup-${stamp}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify(file, null, 2));
  }),
);

router.post(
  '/import',
  wrap(async (req, res) => {
    const imported = await importBackup(req.body);
    await audit(req, 'BACKUP_IMPORTED', 'Setting', 'main', { ...imported });
    res.json({ ok: true, imported, exportedAt: (req.body as { exportedAt?: string }).exportedAt });
  }),
);

export default router;
