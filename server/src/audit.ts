import type { Request } from 'express';
import { prisma } from './db';

/** Journalise une action sensible sans jamais faire échouer la requête. */
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        meta: meta ? (meta as object) : undefined,
        ip: req.ip?.slice(0, 64),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[atelierpro] échec de journalisation :', error);
  }
}
