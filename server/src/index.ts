import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';
import { pruneExpiredSessions } from './auth';
import { pruneAttempts } from './loginThrottle';

async function main(): Promise<void> {
  await prisma.$connect();
  await pruneExpiredSessions();

  const maintenance = setInterval(() => {
    pruneExpiredSessions().catch(() => undefined);
    pruneAttempts();
  }, 60 * 60_000);
  maintenance.unref();

  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[atelierpro] API v${config.version} prête sur http://localhost:${config.port} (${config.env})`,
    );
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[atelierpro] ${signal} reçu, arrêt en cours…`);
    clearInterval(maintenance);
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[atelierpro] démarrage impossible :', error);
  process.exit(1);
});
