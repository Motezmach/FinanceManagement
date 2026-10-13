import {
  addMonths,
  endOfMonth,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";

/** "YYYY-MM-DD" in local time (never UTC-shifted). */
export function toISODate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function todayISO() {
  return toISODate(new Date());
}

/** "YYYY-MM" */
export function toPeriod(d: Date) {
  return format(d, "yyyy-MM");
}

export function currentPeriod() {
  return toPeriod(new Date());
}

export function isValidPeriod(p: string | undefined | null): p is string {
  return !!p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

export function periodToDate(period: string) {
  return parseISO(`${period}-01`);
}

export function periodRange(period: string) {
  const start = periodToDate(period);
  return { start: toISODate(startOfMonth(start)), end: toISODate(endOfMonth(start)) };
}

export function shiftPeriod(period: string, delta: number) {
  return toPeriod(addMonths(periodToDate(period), delta));
}

/** Last N periods ending with `period`, oldest first. */
export function lastPeriods(period: string, n: number) {
  const end = periodToDate(period);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(toPeriod(subMonths(end, i)));
  return out;
}

/** Day a recurring rule falls on in a given month, clamped to the month length. */
export function ruleDateInPeriod(period: string, dayOfMonth: number) {
  const base = periodToDate(period);
  const day = Math.min(Math.max(1, dayOfMonth), getDaysInMonth(base));
  return `${period}-${String(day).padStart(2, "0")}`;
}

export function periodOf(isoDate: string) {
  return isoDate.slice(0, 7);
}
