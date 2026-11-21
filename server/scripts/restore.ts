/**
 * Restauration d'une sauvegarde. La commande refuse de s'exécuter sans
 * confirmation explicite : elle remplace toutes les données métier.
 *
 *   npm run restore -- --file backup.json --confirm REPLACE
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/db';
import { importBackup } from '../src/services/backup';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const file = arg('file');
  const confirm = arg('confirm');

  if (!file) {
    console.error('✖ Indiquez le fichier à restaurer : --file chemin/backup.json');
    process.exit(1);
  }
  if (confirm !== 'REPLACE') {
    console.error('✖ Cette opération remplace les données. Ajoutez --confirm REPLACE.');
    process.exit(1);
  }

  const target = path.resolve(file);
  if (!fs.existsSync(target)) {
    console.error(`✖ Fichier introuvable : ${target}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(target, 'utf8')) as unknown;
  const imported = await importBackup(raw);

  // eslint-disable-next-line no-console
  console.log(`
✔ Restauration terminée
  clients : ${imported.clients}
  dossiers: ${imported.repairs}
  devis   : ${imported.quotes}
  notes   : ${imported.notes}
  actions : ${imported.events}
`);
}

main()
  .catch((error) => {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
