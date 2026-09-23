/**
 * A result, as it is written on the whiteboard and as it is sorted.
 *
 * Each score carries both: the parts a person reads (`7+12`, `12:34`,
 * `100 kg`) and a single `value` the database can order by. Keeping the
 * sortable number beside the parts means a leaderboard is one `ORDER BY`
 * rather than a comparator shipped into SQL.
 *
 * Scores are never typed. They are derived from the movements an athlete
 * logged — see `derive.ts` — so this module only builds, renders and orders
 * them.
 */

import { formatDuration, formatLoad } from "@/lib/units";
import type { Unit } from "@/lib/units";

import type { ScoreKind } from "./formats";

export class ScoreParseError extends Error {}

export interface Score {
  readonly kind: ScoreKind;
  /** The sortable canonical. Seconds, grams, reps, metres, or rounds-and-reps. */
  readonly value: number;
  /** Whole rounds, for `rounds` scores only. */
  readonly rounds?: number;
  /** Reps into the unfinished round, for `rounds` scores only. */
  readonly reps?: number;
}

/**
 * Rounds and reps collapsed into one orderable number.
 *
 * `rounds * REP_CEILING + reps`, which orders correctly as long as no round
 * carries a thousand reps. Nothing in the format catalogue comes close, and a
 * workout that did would be a data-entry error rather than a workout.
 */
const REP_CEILING = 1000;

export function roundsValue(rounds: number, reps: number): number {
  return rounds * REP_CEILING + reps;
}

export function splitRounds(value: number): { rounds: number; reps: number } {
  return { rounds: Math.trunc(value / REP_CEILING), reps: value % REP_CEILING };
}

/** Render a stored score back the way it was written. */
export function formatScore(score: Score, unit: Unit = "kg"): string {
  switch (score.kind) {
    case "time":
      return formatDuration(score.value);
    case "load":
      return formatLoad(score.value, unit);
    case "reps":
      return `${score.value} reps`;
    case "distance":
      return `${score.value} m`;
    case "rounds": {
      const { rounds, reps } = splitRounds(score.value);
      return reps === 0 ? `${rounds}` : `${rounds}+${reps}`;
    }
  }
}

/** Rebuild a score from the two columns the database keeps. */
export function scoreFromValue(kind: ScoreKind, value: number): Score {
  return kind === "rounds" ? { kind, value, ...splitRounds(value) } : { kind, value };
}
