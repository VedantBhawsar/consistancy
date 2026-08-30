import { fromZonedTime } from "date-fns-tz";

/** Calendar date (YYYY-MM-DD) "today" currently is in the given IANA timezone. */
export function todayInTz(timeZone: string, base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

/**
 * Adds whole calendar days to a YYYY-MM-DD string, anchored at UTC noon to
 * avoid DST/timezone edge cases that plain Date arithmetic can introduce.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

/** 0 = Sunday .. 6 = Saturday, for a YYYY-MM-DD calendar date (timezone-agnostic). */
export function dayOfWeekForDateStr(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** [start, end) as UTC instants for a given local calendar date in a timezone. */
export function dayRangeInTz(
  dateStr: string,
  timeZone: string
): { start: Date; end: Date } {
  const start = fromZonedTime(`${dateStr}T00:00:00`, timeZone);
  const end = fromZonedTime(`${addDaysToDateStr(dateStr, 1)}T00:00:00`, timeZone);
  return { start, end };
}
