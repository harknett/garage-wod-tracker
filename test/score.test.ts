import { describe, expect, it } from "vitest";

import { compareScores } from "@/lib/workout/formats";
import { ScoreParseError, formatScore, parseScore } from "@/lib/workout/score";

describe("parseScore", () => {
  it("reads a for-time score as a clock", () => {
    expect(parseScore("12:34", "for_time").value).toBe(754);
  });

  it("reads the same bare number differently per format", () => {
    // Nothing in the text distinguishes these; only the format does.
    expect(parseScore("45", "for_time").value).toBe(45);
    expect(parseScore("45", "amrap")).toMatchObject({ rounds: 45, reps: 0 });
  });

  it("reads rounds plus a part round", () => {
    expect(parseScore("7+12", "amrap")).toMatchObject({ rounds: 7, reps: 12 });
  });

  it("reads a load in the athlete's unit", () => {
    expect(parseScore("100", "strength", "kg").value).toBe(100_000);
    expect(parseScore("225", "strength", "lb").value).toBe(102_058);
  });

  it("ignores the unit for scores that are not loads", () => {
    expect(parseScore("12:34", "for_time", "lb").value).toBe(
      parseScore("12:34", "for_time", "kg").value,
    );
  });

  it("reports a bad load as a score problem, not a unit problem", () => {
    expect(() => parseScore("heavy", "strength")).toThrow(ScoreParseError);
  });

  it("rejects blank input", () => {
    expect(() => parseScore("   ", "amrap")).toThrow(ScoreParseError);
  });
});

describe("formatScore", () => {
  it("round-trips each format's own notation", () => {
    const cases = [
      ["12:34", "for_time"],
      ["7+12", "amrap"],
      ["9", "emom"],
      ["84 reps", "tabata"],
    ] as const;
    for (const [text, format] of cases) {
      const typed = text.replace(" reps", "");
      expect(formatScore(parseScore(typed, format), "kg")).toBe(text);
    }
  });

  it("renders a load back in the unit asked for", () => {
    const score = parseScore("100", "strength", "kg");
    expect(formatScore(score, "kg")).toBe("100 kg");
    expect(formatScore(score, "lb")).toBe("220.5 lb");
  });
});

describe("compareScores", () => {
  it("puts the fastest first when lower is better", () => {
    expect([754, 600, 900].sort((a, b) => compareScores("for_time", a, b))).toEqual([
      600, 754, 900,
    ]);
  });

  it("puts the most rounds first when higher is better", () => {
    expect([7, 12, 9].sort((a, b) => compareScores("amrap", a, b))).toEqual([12, 9, 7]);
  });

  it("sorts a missing score last in both directions", () => {
    expect([null, 600].sort((a, b) => compareScores("for_time", a, b))).toEqual([600, null]);
    expect([null, 600].sort((a, b) => compareScores("amrap", a, b))).toEqual([600, null]);
  });
});
