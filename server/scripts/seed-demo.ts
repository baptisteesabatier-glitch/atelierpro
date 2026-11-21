/**
 * Jeu de démonstration : comptes, clients, dossiers, devis et historique.
 * À exécuter sur une base vide, jamais sur une base de production.
 *
 *   npm run db:seed-demo -- --password "MotDePasseDemo2026!"
 */
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { hashPassword } from '../src/auth';
import { passwordSchema } from '../src/validation';
import { computeQuoteTotals } from '../src/services/repairs';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

const demoPassword = arg('password') ?? `${crypto.randomBytes(12).toString('base64url')}!`;
const parsed = passwordSchema.safeParse(demoPassword);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(`✖ ${parsed.error.issues[0].message}`);
  process.exit(1);
}

const daysAgo = (days: number, hour = 10): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 24, 0, 0);
  return date.getTime() > Date.now() ? new Date(Date.now() - 3_600_000) : date;
};

const token = () => crypto.randomBytes(24).toString('base64url');

async function main(): Promise<void> {
  const existing = await prisma.client.count();
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.error('✖ La base contient déjà des données. Utilisez une base vide.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(demoPassword);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@atelierpro.local' },
    update: {},
    create: {
      email: 'admin@atelierpro.local',
      name: 'Camille Responsable',
      role: 'ADMIN',
      passwordHash,
    },
  });

  const sofiane = await prisma.user.upsert({
    where: { email: 'sofiane@atelierpro.local' },
    update: {},
    create: {
      email: 'sofiane@atelierpro.local',
      name: 'Sofiane',
      role: 'TECHNICIAN',
      passwordHash,
      permissions: { canChangeStatus: true, canEditRepairs: true, canCreateQuotes: true },
    },
  });

  const ines = await prisma.user.upsert({
    where: { email: 'ines@atelierpro.local' },
    update: {},
    create: {
      email: 'ines@atelierpro.local',
      name: 'Inès',
      role: 'TECHNICIAN',
      passwordHash,
      permissions: { canChangeStatus: true, canEditRepairs: true, canManageClients: false },
    },
  });

  await prisma.setting.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      companyName: 'Atelier Nord',
      legalName: 'Atelier Nord SAS',
      address: '14 rue des Artisans',
      postalCode: '69006',
      city: 'Lyon',
      phone: '04 78 00 12 34',
      email: 'contact@atelier-nord.fr',
      siret: '123 456 789 00012',
      vatNumber: 'FR 12 345678900',
      vatRate: 20,
      quotePrefix: 'DEV',
      monthlyGoalCents: 450000,
      footer:
        'Garantie pièces et main d’œuvre 90 jours. Les données personnelles sont conservées 3 ans.',
    },
  });

  const clientsData: Prisma.ClientCreateManyInput[] = [
    { name: 'Camille Aubert', email: 'camille.aubert@mail.fr', phone: '06 12 44 87 21', address: '8 rue Tête d’Or', postalCode: '69006', city: 'Lyon' },
    { name: 'Yanis Berrada', email: 'y.berrada@mail.fr', phone: '07 61 09 33 58', address: '22 cours Émile Zola', postalCode: '69100', city: 'Villeurbanne' },
    { name: 'Léa Fontaine', email: 'lea.fontaine@mail.fr', phone: '06 88 27 41 06', address: '5 place Guichard', postalCode: '69003', city: 'Lyon' },
    { name: 'Marc Delvaux', email: 'marc.delvaux@mail.fr', phone: '06 45 71 90 12', address: '31 avenue de la République', postalCode: '69300', city: 'Caluire' },
    { name: 'Sofia Ricci', email: 'sofia.ricci@mail.fr', phone: '07 12 65 80 44', address: '12 rue de Gerland', postalCode: '69007', city: 'Lyon' },
    { name: 'Hugo Marchand', email: 'hugo.marchand@mail.fr', phone: '06 33 12 77 05', address: '4 chemin des Bruyères', postalCode: '69500', city: 'Bron' },
    { name: 'Nadia Belkacem', email: 'nadia.belkacem@mail.fr', phone: '07 84 20 61 39', address: '9 rue Bataille', postalCode: '69008', city: 'Lyon' },
    { name: 'Thomas Pichon', email: 't.pichon@mail.fr', phone: '06 07 54 28 63', address: '17 chemin de la Tuilerie', postalCode: '69130', city: 'Écully' },
    { name: 'Emma Leclerc', email: 'emma.leclerc@mail.fr', phone: '07 55 91 03 27', address: '2 quai Jules Courmont', postalCode: '69002', city: 'Lyon' },
  ];

  const clients = [];
  for (const data of clientsData) {
    clients.push(await prisma.client.create({ data }));
  }

  type Seed = Omit<Prisma.RepairUncheckedCreateInput, 'reference' | 'trackingToken'> & {
    quotes?: { status: 'DRAFT' | 'SENT' | 'ACCEPTED'; items: { label: string; qty: number; unit: number; kind?: 'LABOR' | 'PART' | 'SUPPLY' }[] };
  };

  const seeds: Seed[] = [
    {
      clientId: clients[0].id, category: 'PHONE', brand: 'Apple', model: 'iPhone 14 Pro',
      issue: 'Écran fissuré après une chute, tactile partiel en bas à droite.',
      diagnosis: 'Écran OLED à remplacer, châssis intact.',
      estimateCents: 18900, status: 'IN_PROGRESS', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(2, 9),
      quotes: { status: 'ACCEPTED', items: [
        { label: 'Écran OLED compatible iPhone 14 Pro', qty: 1, unit: 12900, kind: 'PART' },
        { label: 'Main d’œuvre remplacement écran', qty: 1, unit: 6000 },
      ] },
    },
    {
      clientId: clients[1].id, category: 'LAPTOP', brand: 'Apple', model: 'MacBook Air M1',
      issue: 'Batterie ne tient plus la charge au-delà de deux heures.',
      estimateCents: 12900, status: 'DIAGNOSIS', priority: 'URGENT',
      assignedToId: ines.id, receivedAt: daysAgo(1, 11),
    },
    {
      clientId: clients[2].id, category: 'TABLET', brand: 'Apple', model: 'iPad Air 5',
      issue: 'Connecteur de charge capricieux, il faut maintenir le câble.',
      estimateCents: 9500, status: 'PART_ORDERED', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(4, 14),
    },
    {
      clientId: clients[3].id, category: 'CONSOLE', brand: 'Sony', model: 'PlayStation 5 Slim',
      issue: 'Surchauffe et extinction après 20 minutes de jeu.',
      estimateCents: 11000, status: 'NEW', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(0, 9),
    },
    {
      clientId: clients[4].id, category: 'PHONE', brand: 'Samsung', model: 'Galaxy S23',
      issue: 'Vitre arrière cassée.',
      estimateCents: 7900, status: 'READY', priority: 'LOW',
      assignedToId: ines.id, receivedAt: daysAgo(3, 10), readyAt: daysAgo(1, 16),
    },
    {
      clientId: clients[5].id, category: 'LAPTOP', brand: 'Dell', model: 'XPS 13',
      issue: 'Clavier : plusieurs touches mortes après un renversement de liquide.',
      diagnosis: 'Clavier à remplacer, nappe testée bonne.',
      estimateCents: 14500, status: 'REPAIRED', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(5, 16),
    },
    {
      clientId: clients[6].id, category: 'PHONE', brand: 'Apple', model: 'iPhone 13 mini',
      issue: 'Face ID inopérant depuis une réparation précédente.',
      estimateCents: 15900, status: 'QUOTE_SENT', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(1, 15),
      quotes: { status: 'SENT', items: [
        { label: 'Module Face ID', qty: 1, unit: 11900, kind: 'PART' },
        { label: 'Main d’œuvre diagnostic et pose', qty: 1, unit: 4000 },
      ] },
    },
    {
      clientId: clients[7].id, category: 'TABLET', brand: 'Microsoft', model: 'Surface Pro 9',
      issue: 'Écran tactile fantôme, touches aléatoires.',
      estimateCents: 21000, status: 'AWAITING_APPROVAL', priority: 'URGENT',
      assignedToId: ines.id, receivedAt: daysAgo(6, 9),
      quotes: { status: 'SENT', items: [
        { label: 'Dalle tactile Surface Pro 9', qty: 1, unit: 17000, kind: 'PART' },
        { label: 'Main d’œuvre', qty: 1, unit: 4000 },
      ] },
    },
    {
      clientId: clients[8].id, category: 'PHONE', brand: 'Google', model: 'Pixel 8',
      issue: 'Caméra principale floue, vitre rayée.',
      estimateCents: 8900, status: 'RETURNED', priority: 'NORMAL',
      assignedToId: ines.id, receivedAt: daysAgo(9, 10), returnedAt: daysAgo(6, 17),
      paidAmountCents: 8900, paidAt: daysAgo(6, 17),
      quotes: { status: 'ACCEPTED', items: [
        { label: 'Module caméra Pixel 8', qty: 1, unit: 5900, kind: 'PART' },
        { label: 'Main d’œuvre', qty: 1, unit: 3000 },
      ] },
    },
    {
      clientId: clients[0].id, category: 'OTHER', brand: 'Apple', model: 'AirPods Pro 2',
      issue: 'Boîtier ne charge plus.',
      estimateCents: 4500, status: 'RETURNED', priority: 'LOW',
      assignedToId: ines.id, receivedAt: daysAgo(12, 10), returnedAt: daysAgo(9, 11),
      paidAmountCents: 4500, paidAt: daysAgo(9, 11),
    },
    {
      clientId: clients[2].id, category: 'LAPTOP', brand: 'Apple', model: 'MacBook Pro 14',
      issue: 'Écran : bandes verticales à l’allumage.',
      diagnosis: 'Nappe écran défectueuse, dalle saine.',
      estimateCents: 38900, status: 'IN_PROGRESS', priority: 'URGENT',
      assignedToId: sofiane.id, receivedAt: daysAgo(3, 12),
      quotes: { status: 'ACCEPTED', items: [
        { label: 'Nappe écran MacBook Pro 14', qty: 1, unit: 25900, kind: 'PART' },
        { label: 'Main d’œuvre', qty: 2, unit: 6500 },
      ] },
    },
    {
      clientId: clients[4].id, category: 'CONSOLE', brand: 'Nintendo', model: 'Switch OLED',
      issue: 'Joy-Con drift côté gauche.',
      estimateCents: 6500, status: 'RETURNED', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(15, 11), returnedAt: daysAgo(12, 15),
      paidAmountCents: 6500, paidAt: daysAgo(12, 15),
    },
    {
      clientId: clients[5].id, category: 'OTHER', brand: 'Apple', model: 'Apple Watch Series 8',
      issue: 'Vitre avant fissurée.',
      estimateCents: 11900, status: 'RETURNED', priority: 'NORMAL',
      assignedToId: sofiane.id, receivedAt: daysAgo(18, 9), returnedAt: daysAgo(14, 16),
      paidAmountCents: 11900, paidAt: daysAgo(14, 16),
    },
    {
      clientId: clients[3].id, category: 'LAPTOP', brand: 'HP', model: 'Spectre x360',
      issue: 'Windows ne démarre plus, écran bleu au boot.',
      estimateCents: 9900, status: 'RETURNED', priority: 'NORMAL',
      assignedToId: ines.id, receivedAt: daysAgo(21, 14), returnedAt: daysAgo(17, 12),
      paidAmountCents: 9900, paidAt: daysAgo(17, 12),
    },
    {
      clientId: clients[7].id, category: 'TABLET', brand: 'Samsung', model: 'Galaxy Tab S9',
      issue: 'Nettoyage complet et remplacement de la pâte thermique.',
      estimateCents: 5500, status: 'RETURNED', priority: 'LOW',
      assignedToId: ines.id, receivedAt: daysAgo(24, 10), returnedAt: daysAgo(21, 10),
      paidAmountCents: 5500, paidAt: daysAgo(21, 10),
    },
    {
      clientId: clients[6].id, category: 'PHONE', brand: 'Apple', model: 'iPhone 12',
      issue: 'Batterie à 74 % de capacité, extinctions intempestives.',
      estimateCents: 6900, status: 'CANCELLED', priority: 'LOW',
      assignedToId: ines.id, receivedAt: daysAgo(8, 15), cancelledAt: daysAgo(7, 9),
    },
  ];

  let sequence = 1;
  for (const seed of seeds) {
    const { quotes: quoteSeed, ...repairData } = seed;
    const year = new Date().getFullYear();
    const reference = `AP-${year}-${String(sequence).padStart(4, '0')}`;
    sequence += 1;

    const { clientId, assignedToId, ...rest } = repairData;
    const repair = await prisma.repair.create({
      data: {
        ...rest,
        client: { connect: { id: clientId } },
        assignedTo: assignedToId ? { connect: { id: assignedToId } } : undefined,
        reference,
        trackingToken: token(),
        events: {
          create: [
            { type: 'CREATED', toStatus: 'NEW', actorId: admin.id, createdAt: repairData.receivedAt },
            ...(repairData.status !== 'NEW'
              ? [
                  {
                    type: 'STATUS_CHANGE',
                    fromStatus: 'NEW' as const,
                    toStatus: repairData.status,
                    actorId: assignedToId ?? admin.id,
                    createdAt: daysAgo(1, 12),
                  },
                ]
              : []),
          ],
        },
        notes: {
          create: [
            {
              authorId: repairData.assignedToId ?? admin.id,
              body: 'Appareil réceptionné, état extérieur conforme au bon de dépôt.',
              createdAt: repairData.receivedAt,
            },
          ],
        },
      },
    });

    if (quoteSeed) {
      const vatRate = 20;
      const totals = computeQuoteTotals(
        quoteSeed.items.map((item) => ({
          quantity: item.qty,
          unitPriceCents: item.unit,
        })),
        vatRate,
      );
      const issuedAt = new Date(repair.receivedAt.getTime() + 3_600_000);
      await prisma.quote.create({
        data: {
          repairId: repair.id,
          number: `DEV-${year}-${String(sequence).padStart(4, '0')}`,
          status: quoteSeed.status,
          vatRate,
          notes: null,
          issuedAt,
          validUntil: new Date(issuedAt.getTime() + 30 * 86_400_000),
          acceptedAt: quoteSeed.status === 'ACCEPTED' ? issuedAt : null,
          ...totals,
          items: {
            create: quoteSeed.items.map((item, index) => ({
              kind: item.kind ?? 'LABOR',
              label: item.label,
              quantity: item.qty,
              unitPriceCents: item.unit,
              position: index,
            })),
          },
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`
✔ Jeu de démonstration créé
  ${clients.length} clients · ${seeds.length} dossiers

  Administrateur : admin@atelierpro.local
  Techniciens    : sofiane@atelierpro.local · ines@atelierpro.local
  Mot de passe   : ${demoPassword}

Ce mot de passe est de démonstration : changez-le avant toute mise en service.
`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
