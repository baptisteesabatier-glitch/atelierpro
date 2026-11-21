import { PrismaClient } from '@prisma/client';
import { config } from './config';

/**
 * Client Prisma partagé. En développement, le rechargement de tsx peut
 * recréer le module : on réutilise l'instance globale pour éviter
 * d'épuiser le pool de connexions PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.env === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
