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

  it("starts the week on Monday", () => {
    // 2026-09-21 is a Monday.
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
    expect(weekStart("2026-09-25")).toBe("2026-09-21");
    // Sunday belongs to the week that began six days earlier, not the next one.
    expect(weekStart("2026-09-27")).toBe("2026-09-21");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });

  it("names the day", () => {
    expect(dayName("2026-09-21")).toBe("Monday");
    expect(dayName("2026-09-27")).toBe("Sunday");
  });

  it("rejects malformed input", () => {
    expect(isValidDate("21-09-2026")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
  });
});
