import 'dotenv/config';
import { z } from 'zod';

/** z.coerce.boolean() considère la chaîne "false" comme vraie : on parse explicitement. */
const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // 0 est toléré (certains environnements hébergés l'injectent) → port par défaut.
  PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  /** Origine autorisée pour le front (CORS + vérification d'origine des mutations). */
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: bool(false),
  TRUST_PROXY: bool(false),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  /** Sert les fichiers statiques du front (build Vite) depuis le serveur. */
  WEB_DIST: z.string().default(''),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(400_000),
});

/** Une variable définie mais vide dans .env doit retomber sur sa valeur par défaut. */
const env = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
);

const parsed = schema.safeParse(env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Configuration invalide :\n${issues}\n\nCopiez .env.example vers .env.`);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  port: parsed.data.PORT > 0 ? parsed.data.PORT : 4000,
  databaseUrl: parsed.data.DATABASE_URL,
  appOrigin: parsed.data.APP_ORIGIN.replace(/\/$/, ''),
  cookieSecure: parsed.data.COOKIE_SECURE,
  trustProxy: parsed.data.TRUST_PROXY,
  sessionTtlDays: parsed.data.SESSION_TTL_DAYS,
  loginMaxAttempts: parsed.data.LOGIN_MAX_ATTEMPTS,
  loginWindowMinutes: parsed.data.LOGIN_WINDOW_MINUTES,
  webDist: parsed.data.WEB_DIST,
  uploadMaxBytes: parsed.data.UPLOAD_MAX_BYTES,
  sessionCookie: 'ap_session',
  csrfCookie: 'ap_csrf',
  csrfHeader: 'x-csrf-token',
  version: '2.0.0',
};
