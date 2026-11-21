import fs from 'node:fs';
import path from 'node:path';
import express, { type Request } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { prisma } from './db';
import { errorHandler } from './errors';
import { attachSession, checkOrigin, issueCsrfCookie, verifyCsrf } from './middleware';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import clientsRoutes from './routes/clients';
import repairsRoutes from './routes/repairs';
import quotesRoutes from './routes/quotes';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import backupsRoutes from './routes/backups';
import publicRoutes from './routes/public';

function cors(req: Request, res: express.Response, next: express.NextFunction): void {
  const origin = req.get('origin');
  if (origin && origin.replace(/\/$/, '') === config.appOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-csrf-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(cors);
  app.use(attachSession);
  app.use(issueCsrfCookie);
  app.use(checkOrigin);
  app.use(verifyCsrf);

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', version: config.version, database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', version: config.version, database: 'down' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/repairs', repairsRoutes);
  app.use('/api/quotes', quotesRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/backups', backupsRoutes);
  app.use('/api/public', publicRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route inconnue.' } });
  });

  const dist = config.webDist ? path.resolve(process.cwd(), config.webDist) : '';
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(
      express.static(dist, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store');
            return;
          }
          if (!filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
