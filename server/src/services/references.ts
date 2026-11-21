import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Référence dossier : AP-2026-0042.
 * Le maximum est recalculé à chaque appel ; l'unicité est garantie par la
 * contrainte en base et une nouvelle tentative en cas de collision.
 */
export async function nextRepairReference(db: Db, attempt = 0): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AP-${year}-`;
  const rows = await db.repair.findMany({
    where: { reference: { startsWith: prefix } },
    select: { reference: true },
  });
  const max = rows.reduce((acc, row) => {
    const value = Number.parseInt(row.reference.slice(prefix.length), 10);
    return Number.isFinite(value) ? Math.max(acc, value) : acc;
  }, 0);
  return `${prefix}${String(max + 1 + attempt).padStart(4, '0')}`;
}

/** Numéro de devis : DEV-2026-0012 (préfixe configurable). */
export async function nextQuoteNumber(db: Db, prefix: string, attempt = 0): Promise<string> {
  const year = new Date().getFullYear();
  const full = `${prefix}-${year}-`;
  const rows = await db.quote.findMany({
    where: { number: { startsWith: full } },
    select: { number: true },
  });
  const max = rows.reduce((acc, row) => {
    const value = Number.parseInt(row.number.slice(full.length), 10);
    return Number.isFinite(value) ? Math.max(acc, value) : acc;
  }, 0);
  return `${full}${String(max + 1 + attempt).padStart(4, '0')}`;
}
