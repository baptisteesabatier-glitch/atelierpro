import type { Setting } from '@prisma/client';
import { prisma } from '../db';

/** Récupère (ou crée) la ligne unique de configuration. */
export async function getSettings(): Promise<Setting> {
  const existing = await prisma.setting.findUnique({ where: { id: 'main' } });
  if (existing) return existing;
  return prisma.setting.create({ data: { id: 'main' } });
}
