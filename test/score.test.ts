import { describe, expect, it } from "vitest";

import { ScoreParseError, formatScore, parseScore } from "@/lib/score";

describe("parseScore", () => {
  it("reads minutes and seconds", () => {
    expect(parseScore("12:34", "time")).toEqual({ kind: "time", seconds: 754 });
  });

  it("reads a bare number as seconds for a timed event", () => {
    expect(parseScore("45", "time")).toEqual({ kind: "time", seconds: 45 });
  });

  it("reads the same bare number as rounds for an AMRAP", () => {
    expect(parseScore("45", "rounds")).toEqual({ kind: "rounds", rounds: 45, reps: 0 });
  });

  it("reads rounds plus a part round", () => {
    expect(parseScore("7+12", "rounds")).toEqual({ kind: "rounds", rounds: 7, reps: 12 });
  });

  it("truncates tenths rather than rounding up past the clock", () => {
    expect(parseScore("9:07.9", "time")).toEqual({ kind: "time", seconds: 547.9 });
    expect(formatScore(parseScore("9:07.9", "time"))).toBe("9:07.9");
  });

  it("rejects a minutes-only clock with sixty-plus seconds", () => {
    expect(() => parseScore("12:74", "time")).toThrow(ScoreParseError);
  });

  it("rejects blank input", () => {
    expect(() => parseScore("   ", "time")).toThrow(ScoreParseError);
  });
});

describe("formatScore", () => {
  it("pads seconds", () => {
    expect(formatScore({ kind: "time", seconds: 547 })).toBe("9:07");
  });

  it("drops a zero part round", () => {
    expect(formatScore({ kind: "rounds", rounds: 7, reps: 0 })).toBe("7");
  });

  it("round-trips a whiteboard score", () => {
    for (const text of ["12:34", "0:45", "9:07.5"]) {
      expect(formatScore(parseScore(text, "time"))).toBe(text);
    }
  });
});
