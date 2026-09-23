import { describe, expect, it } from "vitest";

import { compareScores } from "@/lib/workout/formats";
import { formatScore, roundsValue, scoreFromValue, splitRounds } from "@/lib/workout/score";

describe("rounds packing", () => {
  it("packs rounds and reps into one orderable number", () => {
    expect(roundsValue(18, 7)).toBe(18_007);
    expect(splitRounds(18_007)).toEqual({ rounds: 18, reps: 7 });
  });

  it("orders a part round below the next whole one", () => {
    // 7+999 must still sort under 8+0, which is what the packing guarantees.
    expect(roundsValue(7, 999)).toBeLessThan(roundsValue(8, 0));
  });
});

describe("formatScore", () => {
  it("renders each kind in its own notation", () => {
    expect(formatScore({ kind: "time", value: 754 })).toBe("12:34");
    expect(formatScore({ kind: "time", value: 547 })).toBe("9:07");
    expect(formatScore(scoreFromValue("rounds", roundsValue(7, 12)))).toBe("7+12");
    expect(formatScore(scoreFromValue("rounds", roundsValue(7, 0)))).toBe("7");
    expect(formatScore({ kind: "reps", value: 84 })).toBe("84 reps");
    expect(formatScore({ kind: "distance", value: 1500 })).toBe("1500 m");
  });

  it("renders a load in whichever unit is asked for", () => {
    expect(formatScore({ kind: "load", value: 100_000 }, "kg")).toBe("100 kg");
    expect(formatScore({ kind: "load", value: 100_000 }, "lb")).toBe("220.5 lb");
  });
});

describe("scoreFromValue", () => {
  it("rebuilds the round parts from the stored number", () => {
    expect(scoreFromValue("rounds", 18_007)).toMatchObject({ rounds: 18, reps: 7 });
  });

  it("leaves other kinds as a bare value", () => {
    expect(scoreFromValue("time", 754)).toEqual({ kind: "time", value: 754 });
  });
});

describe("compareScores", () => {
  it("puts the fastest first when lower is better", () => {
    expect([754, 600, 900].sort((a, b) => compareScores("for_time", a, b))).toEqual([600, 754, 900]);
  });

  it("puts the most rounds first when higher is better", () => {
    expect([7, 12, 9].sort((a, b) => compareScores("amrap", a, b))).toEqual([12, 9, 7]);
  });

  it("sorts an unscored result last in both directions", () => {
    // Not finishing is not a win, and in a lower-is-better workout a null
    // would otherwise beat every finisher.
    expect([null, 600].sort((a, b) => compareScores("for_time", a, b))).toEqual([600, null]);
    expect([null, 600].sort((a, b) => compareScores("amrap", a, b))).toEqual([600, null]);
  });
});
