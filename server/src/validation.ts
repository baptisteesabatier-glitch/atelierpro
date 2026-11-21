import { z } from 'zod';

export const REPAIR_STATUSES = [
  'NEW',
  'DIAGNOSIS',
  'QUOTE_SENT',
  'AWAITING_APPROVAL',
  'PART_ORDERED',
  'IN_PROGRESS',
  'REPAIRED',
  'READY',
  'RETURNED',
  'CANCELLED',
] as const;

export const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED'] as const;
export const CATEGORIES = ['PHONE', 'LAPTOP', 'TABLET', 'CONSOLE', 'OTHER'] as const;
export const PRIORITIES = ['LOW', 'NORMAL', 'URGENT'] as const;
export const ROLES = ['ADMIN', 'TECHNICIAN'] as const;
export const ITEM_KINDS = ['LABOR', 'PART', 'SUPPLY'] as const;

const text = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} est requis` })
    .trim()
    .min(min, `${label} : ${min} caractères minimum`)
    .max(max, `${label} : ${max} caractères maximum`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse e-mail invalide')
  .max(160);

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(200, 'Mot de passe trop long');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const clientCreateSchema = z.object({
  name: text(2, 120, 'Le nom'),
  email: z.union([emailSchema, z.literal('')]).optional().transform((v) => (v ? v : null)),
  phone: text(6, 30, 'Le téléphone'),
  address: optionalText(200),
  postalCode: optionalText(20),
  city: optionalText(100),
  notes: optionalText(2000),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const repairCreateSchema = z.object({
  clientId: z.string().min(1, 'Client requis'),
  category: z.enum(CATEGORIES).default('PHONE'),
  brand: text(1, 80, 'La marque'),
  model: text(1, 120, 'Le modèle'),
  serialNumber: optionalText(120),
  issue: text(5, 4000, 'La panne signalée'),
  diagnosis: optionalText(4000),
  estimateCents: z.coerce.number().int().min(0).max(100_000_000).default(0),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  assignedToId: z.string().min(1).optional().nullable(),
  receivedAt: z.coerce.date().optional(),
});

export const repairUpdateSchema = repairCreateSchema.partial().extend({
  serialNumber: optionalText(120).optional(),
  diagnosis: optionalText(4000).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(REPAIR_STATUSES),
  message: z.string().trim().max(500).optional(),
  /** Réservé aux administrateurs : autorise une transition hors parcours. */
  force: z.boolean().optional(),
});

export const noteCreateSchema = z.object({
  body: text(1, 2000, 'La note'),
});

export const paymentSchema = z.object({
  paid: z.boolean(),
  amountCents: z.coerce.number().int().min(0).max(100_000_000).optional(),
});

export const quoteItemSchema = z.object({
  kind: z.enum(ITEM_KINDS).default('LABOR'),
  label: text(1, 200, 'La désignation'),
  quantity: z.coerce.number().min(0.01).max(9999).default(1),
  unitPriceCents: z.coerce.number().int().min(0).max(100_000_000).default(0),
});

export const quoteCreateSchema = z.object({
  vatRate: z.coerce.number().min(0).max(100).optional(),
  notes: optionalText(2000),
  validUntil: z.coerce.date().optional(),
  items: z.array(quoteItemSchema).min(1, 'Ajoutez au moins une ligne').max(60),
});

export const quoteUpdateSchema = z.object({
  vatRate: z.coerce.number().min(0).max(100).optional(),
  notes: optionalText(2000).optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(quoteItemSchema).min(1).max(60).optional(),
});

export const quoteStatusSchema = z.object({
  status: z.enum(QUOTE_STATUSES),
});

const permissionsSchema = z
  .object({
    canChangeStatus: z.boolean().optional(),
    canEditRepairs: z.boolean().optional(),
    canManageClients: z.boolean().optional(),
    canCreateQuotes: z.boolean().optional(),
  })
  .strict();

export const userCreateSchema = z.object({
  email: emailSchema,
  name: text(2, 120, 'Le nom'),
  password: passwordSchema,
  role: z.enum(ROLES).default('TECHNICIAN'),
  permissions: permissionsSchema.optional(),
});

export const userUpdateSchema = z.object({
  name: text(2, 120, 'Le nom').optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
  permissions: permissionsSchema.optional(),
});

const logoPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export const settingsUpdateSchema = z.object({
  companyName: z.string().trim().max(120).optional(),
  legalName: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.union([emailSchema, z.literal('')]).optional(),
  siret: z.string().trim().max(20).optional(),
  vatNumber: z.string().trim().max(30).optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  logoDataUrl: z
    .union([
      z
        .string()
        .max(700_000, 'Logo trop volumineux')
        .regex(logoPattern, 'Format attendu : PNG, JPEG ou WebP'),
      z.null(),
    ])
    .optional(),
  quotePrefix: z.string().trim().min(1).max(10).optional(),
  depositPrefix: z.string().trim().min(1).max(10).optional(),
  returnPrefix: z.string().trim().min(1).max(10).optional(),
  quoteValidityDays: z.coerce.number().int().min(1).max(365).optional(),
  footer: z.string().trim().max(500).optional(),
  monthlyGoalCents: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

export const backupImportSchema = z.object({
  confirm: z.literal('REPLACE'),
  data: z.object({
    version: z.string(),
    exportedAt: z.string(),
    settings: z.unknown().optional(),
    users: z.array(z.unknown()).optional(),
    clients: z.array(z.unknown()),
    repairs: z.array(z.unknown()),
    quotes: z.array(z.unknown()).optional(),
    notes: z.array(z.unknown()).optional(),
    events: z.array(z.unknown()).optional(),
  }),
});
