/**
 * Dates as `YYYY-MM-DD` strings in local time.
 *
 * The whole app stores and compares dates as text, because SQLite sorts and
 * ranges them correctly that way and because a training day is a local-calendar
 * idea: a session at 6am Sunday belongs to Sunday wherever the server thinks
 * it is. Going through `toISOString()` would shift it by the UTC offset.
 */

export function today(): string {
  return toDateString(new Date());
}

export function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return toDateString(new Date(y, m - 1, d + days));
}

/** The Sunday on or before a date. Weeks start Sunday. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  // getDay() is already Sunday-based: 0 on Sunday through 6 on Saturday, which
  // is exactly how far into the week a date sits.
  return addDays(date, -new Date(y, m - 1, d).getDay());
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return DAY_NAMES[new Date(y, m - 1, d).getDay()]!;
}

/** "Mon 21 Sep" - short enough for a phone header. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const at = new Date(y, m - 1, d);
  return at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const at = new Date(y, m - 1, d);
  return at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d;
}
