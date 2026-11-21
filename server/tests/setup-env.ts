import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = fs.readFileSync(path.join(here, '.database-url'), 'utf8').trim();

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = url;
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.TRUST_PROXY = 'false';
// Les tests créent beaucoup de sessions : on neutralise la limite par IP.
process.env.LOGIN_MAX_ATTEMPTS = '10000';
process.env.LOGIN_WINDOW_MINUTES = '15';
process.env.WEB_DIST = '';
