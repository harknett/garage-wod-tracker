/**
 * The time zone an athlete trains in.
 *
 * A training day is the athlete's calendar day, not the server's. The server
 * runs in UTC, so without this a session logged at 9pm Eastern landed on
 * tomorrow, and "Today" rolled over at 8pm. Every "what day is it" question
 * goes through `today(timeZone)` with the athlete's own zone.
 *
 * Stored as an IANA name, because that is what carries daylight saving: a
 * fixed offset would be an hour wrong for half the year.
 */

export const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * The zones offered in the picker. Short on purpose — a garage gym's
 * athletes are not spread across the planet — with US zones first. A zone
 * outside the list is still accepted if the runtime knows it, so a phone that
 * reports somewhere else can be taken at its word.
 */
export const TIME_ZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "America/New_York", label: "Eastern (New York)" },
  { id: "America/Chicago", label: "Central (Chicago)" },
  { id: "America/Denver", label: "Mountain (Denver)" },
  { id: "America/Phoenix", label: "Mountain, no DST (Phoenix)" },
  { id: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { id: "America/Anchorage", label: "Alaska (Anchorage)" },
  { id: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { id: "America/Halifax", label: "Atlantic (Halifax)" },
  { id: "Europe/London", label: "UK (London)" },
  { id: "Europe/Paris", label: "Central Europe (Paris)" },
  { id: "Australia/Sydney", label: "Eastern Australia (Sydney)" },
  { id: "UTC", label: "UTC" },
];

export function isTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The label for a zone, or the IANA name if it is not one of ours. */
export function timeZoneLabel(id: string): string {
  return TIME_ZONES.find((z) => z.id === id)?.label ?? id.replaceAll("_", " ");
}
