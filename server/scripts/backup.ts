/**
 * Sauvegarde complète des données métier (indépendante de l'interface).
 *
 *   npm run backup -- --out /chemin/atelierpro-backup.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/db';
import { buildBackupFile } from '../src/services/backup';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const file = await buildBackupFile();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const target = path.resolve(arg('out') ?? `atelierpro-backup-${stamp}.json`);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(file, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`
✔ Sauvegarde écrite
  fichier   : ${target}
  dossiers  : ${file.payload.repairs.length}
  clients   : ${file.payload.clients.length}
  devis     : ${file.payload.quotes.length}
  empreinte : ${file.checksum.slice(0, 16)}…
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
