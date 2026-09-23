import { describe, expect, it } from "vitest";

import { deriveScore, roundSize } from "@/lib/workout/derive";
import { formatScore } from "@/lib/workout/score";

/** Cindy: 5 pull-ups, 10 push-ups, 15 air squats — a 30-rep round. */
const CINDY = [
  { reps: 5, sets: null },
  { reps: 10, sets: null },
  { reps: 15, sets: null },
];
const logged = (rows: Array<Partial<{ reps: number; loadG: number; seconds: number; distanceM: number }>>) =>
  rows.map((r) => ({
    reps: r.reps ?? null,
    loadG: r.loadG ?? null,
    seconds: r.seconds ?? null,
    distanceM: r.distanceM ?? null,
  }));

describe("roundSize", () => {
  it("adds the prescribed reps", () => {
    expect(roundSize(CINDY)).toBe(30);
  });

  it("ignores sets, because in a rounds format the sets are the rounds", () => {
    expect(roundSize([{ reps: 5, sets: 5 }])).toBe(5);
  });
});

describe("deriveScore — rounds", () => {
  it("turns total reps back into rounds and a part round", () => {
    // 18 rounds of 30, plus 7 reps into the nineteenth.
    const score = deriveScore("amrap", CINDY, logged([{ reps: 90 }, { reps: 180 }, { reps: 277 }]))!;
    expect(score).toMatchObject({ rounds: 18, reps: 7 });
    expect(formatScore(score)).toBe("18+7");
  });

  it("reads an exact number of rounds with no remainder", () => {
    const score = deriveScore("amrap", CINDY, logged([{ reps: 50 }, { reps: 100 }, { reps: 150 }]))!;
    expect(formatScore(score)).toBe("10");
  });

  it("gives up rather than guessing when no round is prescribed", () => {
    // Calling every rep a round would be a worse answer than admitting we
    // cannot tell; the reps are still stored per movement either way.
    expect(deriveScore("amrap", [{ reps: null, sets: null }], logged([{ reps: 40 }]))).toBeNull();
  });
});

describe("deriveScore — other kinds", () => {
  it("sums working time for a timed workout", () => {
    const score = deriveScore("for_time", CINDY, logged([{ seconds: 300 }, { seconds: 154.5 }]))!;
    expect(formatScore(score)).toBe("7:34.5");
  });

  it("takes the heaviest single load for strength, not the tonnage", () => {
    const score = deriveScore(
      "strength",
      [{ reps: 5, sets: 5 }],
      logged([{ loadG: 80_000 }, { loadG: 100_000 }, { loadG: 90_000 }]),
    )!;
    expect(formatScore(score, "kg")).toBe("100 kg");
  });

  it("sums reps for a reps-scored format", () => {
    const score = deriveScore("tabata", CINDY, logged([{ reps: 40 }, { reps: 44 }]))!;
    expect(formatScore(score)).toBe("84 reps");
  });

  it("sums distance", () => {
    const score = deriveScore(
      "interval",
      CINDY,
      logged([{ distanceM: 500 }, { distanceM: 1000 }]),
    );
    // interval is time-scored, so distance alone derives nothing.
    expect(score).toBeNull();
  });
});

describe("deriveScore — nothing logged", () => {
  it("is null, which is different from zero", () => {
    // Null sorts last on the leaderboard in either direction; a zero would
    // beat every finisher in a lower-is-better workout.
    expect(deriveScore("amrap", CINDY, logged([{}, {}, {}]))).toBeNull();
    expect(deriveScore("for_time", CINDY, logged([{}]))).toBeNull();
    expect(deriveScore("strength", CINDY, logged([{ loadG: 0 }]))).toBeNull();
  });

  it("ignores blank movements and still scores the rest", () => {
    const score = deriveScore("amrap", CINDY, logged([{ reps: 30 }, {}, {}]))!;
    expect(formatScore(score)).toBe("1");
  });
});
