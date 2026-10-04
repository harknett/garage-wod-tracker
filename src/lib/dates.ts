/**
 * Dates as `YYYY-MM-DD` calendar strings.
 *
 * The whole app stores and compares dates as text, because SQLite sorts and
 * ranges them correctly that way and because a training day is a calendar
 * idea: a session at 6am Sunday belongs to Sunday wherever the server is.
 *
 * Two rules keep the server's own clock zone out of it:
 *
 *   - **Today is asked of the athlete's zone.** `today(timeZone)` reads the
 *     current instant as a date in that zone. The server's local zone is never
 *     consulted, so a host in UTC and an athlete in New York agree on the day.
 *   - **Arithmetic is pure calendar.** Adding days and naming weekdays is done
 *     in UTC, where there is no daylight saving to skip or repeat an hour, so
 *     the answer cannot depend on where the code happens to run.
 */

function parts(date: string): [number, number, number] {
  return date.split("-").map(Number) as [number, number, number];
}

/** A calendar date as a UTC midnight, for arithmetic only. */
function utc(date: string): Date {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * The date it is now in a time zone.
 *
 * `now` is only there so tests can pin the instant.
 */
export function today(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; formatToParts keeps it from depending on that.
  const bits = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => bits.find((b) => b.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: string, days: number): string {
  const at = utc(date);
  at.setUTCDate(at.getUTCDate() + days);
  return fromUtc(at);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** The Sunday on or before a date. Weeks start Sunday. */
export function weekStart(date: string): string {
  // getUTCDay() is already Sunday-based: 0 on Sunday through 6 on Saturday,
  // which is exactly how far into the week a date sits.
  return addDays(date, -utc(date).getUTCDay());
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(date: string): string {
  return DAY_NAMES[utc(date).getUTCDay()]!;
}

/** "Mon 21 Sep" - short enough for a phone header. */
export function shortDate(date: string): string {
  return utc(date).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Mon 21 Sep, 9:14 pm" in a zone - so a picker can show what it means. */
export function nowIn(timeZone: string, now: Date = new Date()): string {
  return now.toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parts(value);
  const at = utc(value);
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}
