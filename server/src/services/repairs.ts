import crypto from 'node:crypto';
import type {
  Client,
  Note,
  Quote,
  QuoteItem,
  Repair,
  RepairEvent,
  RepairStatus,
  User,
} from '@prisma/client';
import { badRequest } from '../errors';

export const ACTIVE_STATUSES: RepairStatus[] = [
  'NEW',
  'DIAGNOSIS',
  'QUOTE_SENT',
  'AWAITING_APPROVAL',
  'PART_ORDERED',
  'IN_PROGRESS',
  'REPAIRED',
  'READY',
];

/** Étapes du parcours public (CANCELLED et RETURNED sont traités à part). */
export const TRACKING_STEPS: RepairStatus[] = [
  'NEW',
  'DIAGNOSIS',
  'QUOTE_SENT',
  'AWAITING_APPROVAL',
  'PART_ORDERED',
  'IN_PROGRESS',
  'REPAIRED',
  'READY',
  'RETURNED',
];

const TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  NEW: ['DIAGNOSIS', 'CANCELLED'],
  DIAGNOSIS: ['QUOTE_SENT', 'IN_PROGRESS', 'CANCELLED'],
  QUOTE_SENT: ['AWAITING_APPROVAL', 'PART_ORDERED', 'IN_PROGRESS', 'CANCELLED'],
  AWAITING_APPROVAL: ['PART_ORDERED', 'IN_PROGRESS', 'CANCELLED'],
  PART_ORDERED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['REPAIRED', 'CANCELLED'],
  REPAIRED: ['READY', 'IN_PROGRESS', 'CANCELLED'],
  READY: ['RETURNED', 'REPAIRED'],
  RETURNED: [],
  CANCELLED: ['NEW'],
};

export function assertTransition(
  from: RepairStatus,
  to: RepairStatus,
  options: { isAdmin: boolean; force?: boolean },
): void {
  if (from === to) return;
  if (options.isAdmin && options.force) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw badRequest(
      `Transition impossible : ${from} → ${to}. Les administrateurs peuvent forcer le changement.`,
      { allowed: TRANSITIONS[from] },
    );
  }
}

/** Horodatages automatiques liés au statut. */
export function statusTimestamps(status: RepairStatus): {
  readyAt?: Date | null;
  returnedAt?: Date | null;
  cancelledAt?: Date | null;
} {
  const now = new Date();
  switch (status) {
    case 'READY':
      return { readyAt: now };
    case 'RETURNED':
      return { returnedAt: now };
    case 'CANCELLED':
      return { cancelledAt: now };
    default:
      return {};
  }
}

export function newTrackingToken(): string {
  // 24 octets → 32 caractères base64url : non devinable par force brute.
  return crypto.randomBytes(24).toString('base64url');
}

type RepairWithRelations = Repair & {
  client: Client;
  assignedTo: User | null;
  quotes?: (Quote & { items?: QuoteItem[] })[];
  notes?: (Note & { author: User | null })[];
  events?: (RepairEvent & { actor: User | null })[];
  _count?: { notes: number; quotes: number };
};

export function serializeRepair(repair: RepairWithRelations) {
  const sortedQuotes = (repair.quotes ?? [])
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    id: repair.id,
    reference: repair.reference,
    status: repair.status,
    priority: repair.priority,
    category: repair.category,
    brand: repair.brand,
    model: repair.model,
    serialNumber: repair.serialNumber,
    issue: repair.issue,
    diagnosis: repair.diagnosis,
    estimateCents: repair.estimateCents,
    paidAmountCents: repair.paidAmountCents,
    paidAt: repair.paidAt,
    receivedAt: repair.receivedAt,
    readyAt: repair.readyAt,
    returnedAt: repair.returnedAt,
    cancelledAt: repair.cancelledAt,
    createdAt: repair.createdAt,
    updatedAt: repair.updatedAt,
    trackingToken: repair.trackingToken,
    client: {
      id: repair.client.id,
      name: repair.client.name,
      phone: repair.client.phone,
      email: repair.client.email,
      city: repair.client.city,
    },
    assignedTo: repair.assignedTo
      ? { id: repair.assignedTo.id, name: repair.assignedTo.name }
      : null,
    latestQuote: sortedQuotes[0]
      ? {
          id: sortedQuotes[0].id,
          number: sortedQuotes[0].number,
          status: sortedQuotes[0].status,
          totalCents: sortedQuotes[0].totalCents,
          validUntil: sortedQuotes[0].validUntil,
        }
      : null,
    counts: {
      notes: repair._count?.notes ?? repair.notes?.length ?? 0,
      quotes: repair._count?.quotes ?? repair.quotes?.length ?? 0,
    },
    notes: repair.notes
      ?.slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: note.createdAt,
        author: note.author ? { id: note.author.id, name: note.author.name } : null,
      })),
    events: repair.events
      ?.slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        message: event.message,
        createdAt: event.createdAt,
        actor: event.actor ? { id: event.actor.id, name: event.actor.name } : null,
      })),
    quotes: sortedQuotes.map((quote) => ({
      id: quote.id,
      number: quote.number,
      status: quote.status,
      vatRate: quote.vatRate,
      subtotalCents: quote.subtotalCents,
      vatCents: quote.vatCents,
      totalCents: quote.totalCents,
      notes: quote.notes,
      issuedAt: quote.issuedAt,
      validUntil: quote.validUntil,
      acceptedAt: quote.acceptedAt,
      items: quote.items?.map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        position: item.position,
      })),
    })),
  };
}

export type SerializedRepair = ReturnType<typeof serializeRepair>;

/** Totaux d'un devis, en centimes entiers (aucun flottant monétaire). */
export function computeQuoteTotals(
  items: { quantity: number; unitPriceCents: number }[],
  vatRate: number,
): { subtotalCents: number; vatCents: number; totalCents: number } {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0,
  );
  const vatCents = Math.round((subtotalCents * vatRate) / 100);
  return { subtotalCents, vatCents, totalCents: subtotalCents + vatCents };
}
