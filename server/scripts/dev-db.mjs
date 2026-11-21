/**
 * PostgreSQL local pour le développement, sans Docker.
 *
 *   npm run dev:db          (depuis la racine ou server/)
 *
 * Données conservées dans `server/.pgdata-dev`, base `atelierpro`.
 * Arrêt : Ctrl+C. Ce script est réservé au développement et aux tests
 * manuels ; la production utilise docker-compose (service `db`).
 */
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.PGPORT ?? 5432);
const database = process.env.PGDATABASE ?? 'atelierpro';

const pg = new EmbeddedPostgres({
  databaseDir: './.pgdata-dev',
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

await pg.initialise().catch(() => undefined);
await pg.start();
await pg.createDatabase(database).catch(() => undefined);

console.log(`
✔ PostgreSQL local prêt
  port        : ${port}
  base        : ${database}
  utilisateur : postgres / postgres
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/${database}?schema=public

Ctrl+C pour arrêter.
`);

const stop = async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => undefined, 1 << 30);
