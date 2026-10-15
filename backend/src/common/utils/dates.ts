// Scheduling works on calendar days in the app's timezone. Dates are carried
// around as UTC-midnight Date objects, which is how Prisma maps @db.Date.

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const DAY_MS = 86_400_000;

export function todayDate(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function parseDate(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

export function daysInMonth(d: Date): number {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
}
