import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { badRequest } from '../errors';
import { getSettings } from './settings';

export const BACKUP_FORMAT = 'atelierpro-backup';
export const BACKUP_VERSION = '2.0.0';

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.string().min(1),
  exportedAt: z.string().min(1),
  checksum: z.string().length(64),
  payload: z.object({
    settings: z.record(z.any()).optional(),
    clients: z.array(z.record(z.any())),
    repairs: z.array(z.record(z.any())),
    quotes: z.array(z.record(z.any())),
    notes: z.array(z.record(z.any())),
    events: z.array(z.record(z.any())),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;

const toDate = (value: unknown, fallback = new Date()): Date => {
  if (!value) return fallback;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

export const checksum = (payload: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export async function buildBackupPayload() {
  const [settings, clients, repairs, quotes, notes, events] = await Promise.all([
    getSettings(),
    prisma.client.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.repair.findMany({ orderBy: { receivedAt: 'asc' } }),
    prisma.quote.findMany({ include: { items: { orderBy: { position: 'asc' } } } }),
    prisma.note.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.repairEvent.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  // Les comptes utilisateurs ne sont volontairement pas exportés : ils restent
  // rattachés à l'installation et ne circulent pas dans une sauvegarde.
  const { id: _id, updatedAt: _updatedAt, ...settingsData } = settings;

  return { settings: settingsData, clients, repairs, quotes, notes, events };
}

export async function buildBackupFile(): Promise<BackupFile> {
  const payload = await buildBackupPayload();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    checksum: checksum(payload),
    payload,
  };
}

export function verifyBackup(body: unknown): BackupFile {
  const parsed = backupSchema.parse(body);
  if (parsed.version !== BACKUP_VERSION) {
    throw badRequest(
      `Sauvegarde version ${parsed.version} : cette installation attend la version ${BACKUP_VERSION}.`,
    );
  }
  if (checksum(parsed.payload) !== parsed.checksum) {
    throw badRequest('Contrôle d’intégrité échoué : le fichier a été modifié ou corrompu.');
  }
  return parsed;
}

export interface ImportCounts {
  clients: number;
  repairs: number;
  quotes: number;
  notes: number;
  events: number;
}

/**
 * Remplace les données métier par celles de la sauvegarde, dans une
 * transaction unique : en cas d'erreur, la base reste inchangée.
 */
export async function importBackup(body: unknown): Promise<ImportCounts> {
  const file = verifyBackup(body);
  const payload = file.payload;

  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((user) => user.id));
  const repairIds = new Set(payload.repairs.map((repair) => String(repair.id)));

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.repairEvent.deleteMany();
        await tx.note.deleteMany();
        await tx.quoteItem.deleteMany();
        await tx.quote.deleteMany();
        await tx.repair.deleteMany();
        await tx.client.deleteMany();

        if (payload.settings) {
          await tx.setting.upsert({
            where: { id: 'main' },
            create: { id: 'main', ...payload.settings } as never,
            update: payload.settings as never,
          });
        }

        if (payload.clients.length) {
          await tx.client.createMany({
            data: payload.clients.map((client) => ({
              id: String(client.id),
              name: String(client.name),
              email: (client.email as string | null) ?? null,
              phone: String(client.phone),
              address: (client.address as string | null) ?? null,
              postalCode: (client.postalCode as string | null) ?? null,
              city: (client.city as string | null) ?? null,
              notes: (client.notes as string | null) ?? null,
              createdAt: toDate(client.createdAt),
              updatedAt: toDate(client.updatedAt),
            })),
          });
        }

        if (payload.repairs.length) {
          await tx.repair.createMany({
            data: payload.repairs.map((repair) => ({
              id: String(repair.id),
              reference: String(repair.reference),
              clientId: String(repair.clientId),
              category: repair.category as never,
              brand: String(repair.brand),
              model: String(repair.model),
              serialNumber: (repair.serialNumber as string | null) ?? null,
              issue: String(repair.issue),
              diagnosis: (repair.diagnosis as string | null) ?? null,
              estimateCents: Number(repair.estimateCents ?? 0),
              status: repair.status as never,
              priority: (repair.priority as never) ?? 'NORMAL',
              assignedToId:
                repair.assignedToId && userIds.has(String(repair.assignedToId))
                  ? String(repair.assignedToId)
                  : null,
              trackingToken: String(repair.trackingToken),
              receivedAt: toDate(repair.receivedAt),
              readyAt: repair.readyAt ? toDate(repair.readyAt) : null,
              returnedAt: repair.returnedAt ? toDate(repair.returnedAt) : null,
              cancelledAt: repair.cancelledAt ? toDate(repair.cancelledAt) : null,
              paidAmountCents: Number(repair.paidAmountCents ?? 0),
              paidAt: repair.paidAt ? toDate(repair.paidAt) : null,
              createdAt: toDate(repair.createdAt),
              updatedAt: toDate(repair.updatedAt),
            })),
          });
        }

        if (payload.quotes.length) {
          await tx.quote.createMany({
            data: payload.quotes.map((quote) => ({
              id: String(quote.id),
              number: String(quote.number),
              repairId: String(quote.repairId),
              status: (quote.status as never) ?? 'DRAFT',
              vatRate: Number(quote.vatRate ?? 20),
              subtotalCents: Number(quote.subtotalCents ?? 0),
              vatCents: Number(quote.vatCents ?? 0),
              totalCents: Number(quote.totalCents ?? 0),
              notes: (quote.notes as string | null) ?? null,
              issuedAt: toDate(quote.issuedAt),
              validUntil: toDate(quote.validUntil),
              acceptedAt: quote.acceptedAt ? toDate(quote.acceptedAt) : null,
              createdAt: toDate(quote.createdAt),
              updatedAt: toDate(quote.updatedAt),
            })),
          });

          const items = payload.quotes.flatMap((quote) =>
            Array.isArray(quote.items)
              ? (quote.items as Record<string, unknown>[]).map((item, index) => ({
                  id: String(item.id ?? `${String(quote.id)}-${index}`),
                  quoteId: String(quote.id),
                  kind: (item.kind as never) ?? 'LABOR',
                  label: String(item.label),
                  quantity: Number(item.quantity ?? 1),
                  unitPriceCents: Number(item.unitPriceCents ?? 0),
                  position: Number(item.position ?? index),
                }))
              : [],
          );
          if (items.length) await tx.quoteItem.createMany({ data: items });
        }

        if (payload.notes.length) {
          await tx.note.createMany({
            data: payload.notes
              .filter((note) => repairIds.has(String(note.repairId)))
              .map((note) => ({
                id: String(note.id),
                repairId: String(note.repairId),
                authorId:
                  note.authorId && userIds.has(String(note.authorId))
                    ? String(note.authorId)
                    : null,
                body: String(note.body),
                createdAt: toDate(note.createdAt),
              })),
          });
        }

        if (payload.events.length) {
          await tx.repairEvent.createMany({
            data: payload.events
              .filter((event) => repairIds.has(String(event.repairId)))
              .map((event) => ({
                id: String(event.id),
                repairId: String(event.repairId),
                type: String(event.type),
                fromStatus: (event.fromStatus as never) ?? null,
                toStatus: (event.toStatus as never) ?? null,
                message: (event.message as string | null) ?? null,
                actorId:
                  event.actorId && userIds.has(String(event.actorId))
                    ? String(event.actorId)
                    : null,
                createdAt: toDate(event.createdAt),
              })),
          });
        }
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    throw badRequest(
      `Restauration interrompue, aucune donnée n’a été modifiée : ${
        error instanceof Error ? error.message : 'format invalide'
      }`,
    );
  }

  return {
    clients: payload.clients.length,
    repairs: payload.repairs.length,
    quotes: payload.quotes.length,
    notes: payload.notes.length,
    events: payload.events.length,
  };
}
