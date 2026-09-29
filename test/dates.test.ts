import { describe, expect, it } from "vitest";

import { addDays, dayName, isValidDate, shortDate, today, weekStart } from "@/lib/dates";

describe("dates", () => {
  it("reads today in the athlete's zone, not the server's", () => {
    // 01:30 UTC on the 22nd is still 9:30pm on the 21st in New York. A server
    // in UTC asked for "today" would put an evening session on tomorrow.
    const lateEvening = new Date(Date.UTC(2026, 8, 22, 1, 30));
    expect(today("America/New_York", lateEvening)).toBe("2026-09-21");
    expect(today("UTC", lateEvening)).toBe("2026-09-22");
    expect(today("Australia/Sydney", lateEvening)).toBe("2026-09-22");
  });

  it("follows daylight saving rather than a fixed offset", () => {
    // 04:30 UTC is 11:30pm the day before under January's UTC-5, but 12:30am
    // the same day under July's UTC-4. A fixed offset gets one of them wrong.
    expect(today("America/New_York", new Date(Date.UTC(2026, 0, 15, 4, 30)))).toBe("2026-01-14");
    expect(today("America/New_York", new Date(Date.UTC(2026, 6, 15, 4, 30)))).toBe("2026-07-15");
  });

  it("does calendar arithmetic without depending on the server's zone", () => {
    // Across the spring-forward night in the US, where a local-midnight Date
    // plus 24 hours can land on the same day or skip one.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(shortDate("2026-09-21")).toBe("Mon 21 Sept");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
  });

  it("starts the week on Sunday", () => {
    // 2026-09-20 is a Sunday; 2026-09-21 the Monday after it.
    expect(weekStart("2026-09-20")).toBe("2026-09-20");
    expect(weekStart("2026-09-21")).toBe("2026-09-20");
    expect(weekStart("2026-09-25")).toBe("2026-09-20");
    // Saturday closes the week that began six days earlier.
    expect(weekStart("2026-09-26")).toBe("2026-09-20");
    // And the next Sunday opens a new one rather than closing the old.
    expect(weekStart("2026-09-27")).toBe("2026-09-27");
  });

  it("names the day", () => {
    expect(dayName("2026-09-20")).toBe("Sunday");
    expect(dayName("2026-09-21")).toBe("Monday");
    expect(dayName("2026-09-26")).toBe("Saturday");
  });

  it("rejects malformed input", () => {
    expect(isValidDate("21-09-2026")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
  });
});
