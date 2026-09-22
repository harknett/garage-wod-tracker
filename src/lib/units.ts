/**
 * Weights and durations, in the units people actually say out loud.
 *
 * Two canonical forms are stored and everything else is a rendering of them:
 *
 *   - **Load** is a whole number of **grams**. Kilograms and pounds are both
 *     rendered from it. An integer is used rather than a float because a
 *     leaderboard sorts and groups by load, and 60.000000000000004 kg sorts
 *     fine but groups as its own distinct lift.
 *   - **Duration** is **seconds**, to one decimal. Clocks in a garage are read
 *     to the tenth at best.
 *
 * Converting on the way in and out means two athletes can log the same barbell
 * in different units and still land on the same row.
 */

export const UNITS = ["kg", "lb"] as const;
export type Unit = (typeof UNITS)[number];

/** Exact by definition: the international pound is 0.45359237 kg. */
const GRAMS_PER_POUND = 453.59237;
const GRAMS_PER_KILO = 1000;

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

/** Thrown for input that is not a number, as opposed to an impossible one. */
export class UnitParseError extends Error {}

/**
 * Read a typed load into grams.
 *
 * Rounded to the nearest gram: the input is a barbell, not an analytical
 * balance, and carrying the fraction would defeat the point of an integer.
 */
export function parseLoad(input: string, unit: Unit): number {
  const text = input.trim().replace(/,/g, "");
  if (text === "") throw new UnitParseError("A load cannot be blank.");

  const value = Number(text);
  if (!Number.isFinite(value)) throw new UnitParseError(`Not a weight: ${input}`);
  if (value < 0) throw new UnitParseError("A load cannot be negative.");

  return Math.round(value * (unit === "kg" ? GRAMS_PER_KILO : GRAMS_PER_POUND));
}

/** Render grams in the athlete's unit, trimming a trailing `.0`. */
export function formatLoad(grams: number, unit: Unit): string {
  const value = grams / (unit === "kg" ? GRAMS_PER_KILO : GRAMS_PER_POUND);
  // One decimal: a kilo plate is 0.5, and a pound conversion is never round.
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${unit}`;
}

const DURATION = /^(?:(\d+):)?([0-5]?\d)(?:\.(\d{1,2}))?$/;

/**
 * Read a clock into seconds.
 *
 * Accepts `12:34`, `9:07.5` and a bare `45` (seconds). Tenths are truncated
 * rather than rounded: a clock reading 9:07.9 has not reached 9:08, and
 * rounding up invents a tenth of a second the athlete did not spend.
 */
export function parseDuration(input: string): number {
  const text = input.trim();
  if (text === "") throw new UnitParseError("A time cannot be blank.");

  const m = DURATION.exec(text);
  if (!m) throw new UnitParseError(`Not a time: ${input}`);

  const [, mins, secs, frac] = m;
  const seconds = Number(mins ?? 0) * 60 + Number(secs) + (frac ? Number(`0.${frac}`) : 0);
  return Math.trunc(seconds * 10) / 10;
}

/** Render seconds as `m:ss`, with a tenth only when there is one. */
export function formatDuration(seconds: number): string {
  const whole = Math.trunc(seconds);
  const mins = Math.trunc(whole / 60);
  const secs = whole % 60;
  const tenths = Math.round((seconds - whole) * 10);
  const base = `${mins}:${String(secs).padStart(2, "0")}`;
  return tenths === 0 ? base : `${base}.${tenths}`;
}
