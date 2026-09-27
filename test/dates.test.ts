import { describe, expect, it } from "vitest";

import { addDays, dayName, isValidDate, toDateString, weekStart } from "@/lib/dates";

describe("dates", () => {
  it("formats in local time, not UTC", () => {
    // Late-evening local time is the next day in UTC; toISOString() would
    // report the wrong training day for anyone east of Greenwich.
    expect(toDateString(new Date(2026, 8, 21, 23, 30))).toBe("2026-09-21");
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
