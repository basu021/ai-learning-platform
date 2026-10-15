import type { Frequency } from '@prisma/client';
import { addDays, daysInMonth, diffDays } from '../common/utils/dates';

export interface Rule {
  frequency: Frequency;
  weekdays: string | null;
  monthDay: number | null;
  intervalDays: number | null;
  startDate: Date;
  endDate: Date | null;
}

export function weekdayList(rule: Pick<Rule, 'weekdays'>): number[] {
  return (rule.weekdays ?? '')
    .split(',')
    .filter((d) => d !== '')
    .map(Number);
}

/** Does the rule produce an occurrence on this (UTC-midnight) day? */
export function occursOn(rule: Rule, day: Date): boolean {
  if (day < rule.startDate) return false;
  if (rule.endDate && day > rule.endDate) return false;
  switch (rule.frequency) {
    case 'ONCE':
      return day.getTime() === rule.startDate.getTime();
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return weekdayList(rule).includes(day.getUTCDay());
    case 'MONTHLY': {
      const target = Math.min(rule.monthDay ?? 1, daysInMonth(day));
      return day.getUTCDate() === target;
    }
    case 'CUSTOM':
      return (
        diffDays(day, rule.startDate) % Math.max(1, rule.intervalDays ?? 1) ===
        0
      );
  }
}

export function datesBetween(rule: Rule, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (occursOn(rule, d)) out.push(d);
  }
  return out;
}

export function nextOccurrence(
  rule: Rule,
  after: Date,
  horizonDays = 400,
): Date | null {
  const start = after < rule.startDate ? rule.startDate : after;
  for (let i = 0; i <= horizonDays; i++) {
    const d = addDays(start, i);
    if (rule.endDate && d > rule.endDate) return null;
    if (occursOn(rule, d)) return d;
  }
  return null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describe(rule: Rule): string {
  switch (rule.frequency) {
    case 'ONCE':
      return `Once on ${rule.startDate.toISOString().slice(0, 10)}`;
    case 'DAILY':
      return 'Every day';
    case 'WEEKLY':
      return `Weekly on ${weekdayList(rule)
        .map((d) => DAY_NAMES[d])
        .join(', ')}`;
    case 'MONTHLY':
      return `Monthly on day ${rule.monthDay}`;
    case 'CUSTOM':
      return rule.intervalDays === 1
        ? 'Every day'
        : `Every ${rule.intervalDays} days`;
  }
}
