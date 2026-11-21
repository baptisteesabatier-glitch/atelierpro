/** Formatage localisé (fr-FR) pour les montants et les dates. */

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const currencyPrecise = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
});

const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const time = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

export const money = (value: number) => currency.format(value);
export const moneyPrecise = (value: number) => currencyPrecise.format(value);
export const day = (iso: string) => shortDate.format(new Date(iso));
export const fullDate = (iso: string) => longDate.format(new Date(iso));
export const clock = (iso: string) => time.format(new Date(iso));

export function daysBetween(from: string, to: string | Date = new Date()): number {
  const a = new Date(from).getTime();
  const b = typeof to === 'string' ? new Date(to).getTime() : to.getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const d = Math.round(hours / 24);
  if (d === 1) return 'hier';
  if (d < 30) return `il y a ${d} j`;
  return day(iso);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
