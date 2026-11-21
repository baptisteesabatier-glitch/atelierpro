import type { DeviceCategory, Priority, RepairStatus } from './api';

export const STATUS_FLOW: RepairStatus[] = [
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

export const STATUS_META: Record<
  RepairStatus,
  { label: string; short: string; tone: string; hint: string }
> = {
  NEW: {
    label: 'Nouvel appareil',
    short: 'Reçu',
    tone: 'slate',
    hint: 'Appareil réceptionné, en attente de prise en charge.',
  },
  DIAGNOSIS: {
    label: 'Diagnostic',
    short: 'Diag',
    tone: 'indigo',
    hint: 'Analyse technique en cours.',
  },
  QUOTE_SENT: {
    label: 'Devis envoyé',
    short: 'Devis',
    tone: 'amber',
    hint: 'Devis transmis au client.',
  },
  AWAITING_APPROVAL: {
    label: 'En attente d’accord',
    short: 'Attente',
    tone: 'amber',
    hint: 'Relance possible si le client ne répond pas.',
  },
  PART_ORDERED: {
    label: 'Pièce commandée',
    short: 'Pièce',
    tone: 'amber',
    hint: 'Intervention suspendue à la réception d’une pièce.',
  },
  IN_PROGRESS: {
    label: 'Réparation en cours',
    short: 'Atelier',
    tone: 'accent',
    hint: 'Intervention en cours sur l’établi.',
  },
  REPAIRED: {
    label: 'Réparation terminée',
    short: 'Terminé',
    tone: 'green',
    hint: 'Contrôles qualité à effectuer avant restitution.',
  },
  READY: {
    label: 'Prêt à récupérer',
    short: 'Prêt',
    tone: 'green',
    hint: 'Le client peut venir retirer son appareil.',
  },
  RETURNED: {
    label: 'Restitué',
    short: 'Restitué',
    tone: 'muted',
    hint: 'Dossier clos, appareil remis au client.',
  },
  CANCELLED: {
    label: 'Annulé',
    short: 'Annulé',
    tone: 'rose',
    hint: 'Dossier abandonné ou refusé par le client.',
  },
};

/** Transitions proposées dans l’interface (l’API reste l’autorité). */
export const NEXT_STATUS: Record<RepairStatus, RepairStatus[]> = {
  NEW: ['DIAGNOSIS'],
  DIAGNOSIS: ['QUOTE_SENT', 'IN_PROGRESS'],
  QUOTE_SENT: ['AWAITING_APPROVAL', 'PART_ORDERED', 'IN_PROGRESS'],
  AWAITING_APPROVAL: ['PART_ORDERED', 'IN_PROGRESS'],
  PART_ORDERED: ['IN_PROGRESS'],
  IN_PROGRESS: ['REPAIRED'],
  REPAIRED: ['READY', 'IN_PROGRESS'],
  READY: ['RETURNED', 'REPAIRED'],
  RETURNED: [],
  CANCELLED: ['NEW'],
};

export const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  LOW: { label: 'Basse', tone: 'muted' },
  NORMAL: { label: 'Normale', tone: 'slate' },
  URGENT: { label: 'Urgente', tone: 'rose' },
};

export const CATEGORY_META: Record<
  DeviceCategory,
  { label: string; icon: 'phone' | 'laptop' | 'tablet' | 'console' | 'chip' }
> = {
  PHONE: { label: 'Téléphone', icon: 'phone' },
  LAPTOP: { label: 'Ordinateur', icon: 'laptop' },
  TABLET: { label: 'Tablette', icon: 'tablet' },
  CONSOLE: { label: 'Console', icon: 'console' },
  OTHER: { label: 'Autre', icon: 'chip' },
};

export const QUOTE_STATUS_META = {
  DRAFT: { label: 'Brouillon', tone: 'slate' },
  SENT: { label: 'Envoyé', tone: 'amber' },
  ACCEPTED: { label: 'Accepté', tone: 'green' },
  REFUSED: { label: 'Refusé', tone: 'rose' },
  EXPIRED: { label: 'Expiré', tone: 'muted' },
} as const;

/** Montants stockés en centimes entiers. */
export const centsToEuros = (cents: number) => cents / 100;
