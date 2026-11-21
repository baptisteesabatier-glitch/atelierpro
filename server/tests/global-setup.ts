import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
// Dossier propre à chaque exécution : évite les verrous d'un run interrompu.
const PGDATA = path.join(here, `.pgdata-${process.pid}`);
const URL_FILE = path.join(here, '.database-url');
const PORT = Number(process.env.TEST_PG_PORT ?? 55432);
const DATABASE = 'atelierpro_test';

/**
 * Démarre un PostgreSQL local jetable, applique les migrations Prisma puis
 * publie l'URL de connexion pour les tests. Aucun service externe requis.
 */
export default async function setup(): Promise<() => Promise<void>> {
  fs.rmSync(PGDATA, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: PGDATA,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
    // Le locale Windows par défaut produit un encodage WIN1252 qui refuse
    // l'UTF-8 (flèches, emoji, accents composites) : la base doit être en UTF8.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  } as const);

  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(DATABASE);
  } catch {
    /* la base existe déjà sur une instance réutilisée */
  }

  const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/${DATABASE}?schema=public`;
  execSync('npx prisma migrate deploy', {
    cwd: path.join(here, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  fs.writeFileSync(URL_FILE, url, 'utf8');

  return async () => {
    fs.rmSync(URL_FILE, { force: true });
    await pg.stop();
    try {
      // Windows peut garder un verrou quelques instants après l'arrêt.
      fs.rmSync(PGDATA, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      /* le dossier sera recréé au prochain lancement */
    }
  };
}
