import { config } from './config';

/**
 * Verrouillage par compte en complément du rate-limit par IP.
 * Stockage en mémoire : suffisant pour une installation mono-serveur
 * (le cas visé par la licence perpétuelle). Documenté dans docs/security.md.
 */
interface Entry {
  failures: number;
  firstAt: number;
  lockedUntil?: number;
}

const attempts = new Map<string, Entry>();

const windowMs = config.loginWindowMinutes * 60_000;

export function isLocked(identifier: string): boolean {
  const entry = attempts.get(identifier);
  if (!entry?.lockedUntil) return false;
  if (entry.lockedUntil > Date.now()) return true;
  attempts.delete(identifier);
  return false;
}

export function registerFailure(identifier: string): void {
  const now = Date.now();
  const entry = attempts.get(identifier);

  if (!entry || now - entry.firstAt > windowMs) {
    attempts.set(identifier, { failures: 1, firstAt: now });
    return;
  }

  entry.failures += 1;
  if (entry.failures >= config.loginMaxAttempts) {
    entry.lockedUntil = now + windowMs;
  }
}

export function resetFailures(identifier: string): void {
  attempts.delete(identifier);
}

/** Nettoyage périodique pour éviter une croissance non bornée. */
export function pruneAttempts(): void {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    const expired =
      (entry.lockedUntil ? entry.lockedUntil < now : false) || now - entry.firstAt > windowMs * 2;
    if (expired) attempts.delete(key);
  }
}
