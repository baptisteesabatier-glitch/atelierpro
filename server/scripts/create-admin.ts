/**
 * Création d'un compte administrateur.
 *
 *   npm run admin:create -- --email admin@mon-atelier.fr --name "Admin"
 *
 * Le mot de passe est généré aléatoirement et affiché une seule fois,
 * sauf si `--password` est fourni explicitement.
 */
import crypto from 'node:crypto';
import { prisma } from '../src/db';
import { hashPassword } from '../src/auth';
import { passwordSchema } from '../src/validation';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const email = (arg('email') ?? '').trim().toLowerCase();
  const name = (arg('name') ?? 'Administrateur').trim();
  const provided = arg('password');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail('Adresse e-mail invalide. Exemple : --email admin@mon-atelier.fr');
  }

  const password = provided ?? `${crypto.randomBytes(15).toString('base64url')}!`;
  const valid = passwordSchema.safeParse(password);
  if (!valid.success) fail(valid.error.issues[0].message);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    fail(`Un compte existe déjà pour ${email}. Utilisez l'interface pour modifier son mot de passe.`);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`
✔ Administrateur créé
  e-mail      : ${user.email}
  nom         : ${user.name}
  mot de passe: ${provided ? '(fourni en paramètre)' : password}

Conservez ce mot de passe en lieu sûr : il n'est plus affiché ensuite.
Connectez-vous puis changez-le depuis Paramètres → Sécurité.
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
