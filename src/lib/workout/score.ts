/**
 * A result, as it is written on the whiteboard and as it is sorted.
 *
 * Each score carries both: the parts an athlete typed (`7+12`, `12:34`,
 * `100 kg`) and a single `value` the database can order by. Keeping the
 * sortable number beside the parts means a leaderboard is one `ORDER BY`
 * rather than a comparator shipped into SQL.
 */

import { formatDuration, formatLoad, parseDuration, parseLoad, UnitParseError } from "@/lib/units";
import type { Unit } from "@/lib/units";

import { FORMAT_SPECS } from "./formats";
import type { Format, ScoreKind } from "./formats";

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

function wholeNumber(text: string, what: string): number {
  if (!/^\d+$/.test(text)) throw new ScoreParseError(`Not a ${what}: ${text}`);
  return Number(text);
}

const ROUNDS = /^(\d+)(?:\s*\+\s*(\d+))?$/;

/**
 * Read a typed score for a workout of this format.
 *
 * The format decides how the text is read, which is the whole point of taking
 * it: `45` is forty-five seconds in a for-time and forty-five rounds in an
 * EMOM, and there is nothing in the text itself to tell them apart.
 *
 * `unit` is only consulted for load scores; it is ignored otherwise, so the
 * caller can pass the athlete's preference unconditionally.
 */
export function parseScore(input: string, format: Format, unit: Unit = "kg"): Score {
  const kind = FORMAT_SPECS[format].score;
  const text = input.trim();
  if (text === "") throw new ScoreParseError("A score cannot be blank.");

  try {
    switch (kind) {
      case "time":
        return { kind, value: parseDuration(text) };

      case "load":
        return { kind, value: parseLoad(text, unit) };

      case "reps":
        return { kind, value: wholeNumber(text, "rep count") };

      case "distance":
        return { kind, value: wholeNumber(text, "distance in metres") };

      case "rounds": {
        const m = ROUNDS.exec(text);
        if (!m) throw new ScoreParseError(`Not a round count: ${input}`);
        const rounds = Number(m[1]);
        const reps = Number(m[2] ?? 0);
        if (reps >= REP_CEILING) {
          throw new ScoreParseError(`A part round cannot hold ${reps} reps.`);
        }
        return { kind, value: roundsValue(rounds, reps), rounds, reps };
      }
    }
  } catch (err) {
    // A unit-level complaint is still a bad score; the caller should not have
    // to catch two error types to show one message.
    if (err instanceof UnitParseError) throw new ScoreParseError(err.message);
    throw err;
  }
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

/** What to put above the score box on the logging screen. */
export function scorePlaceholder(format: Format): string {
  switch (FORMAT_SPECS[format].score) {
    case "time":
      return "12:34";
    case "rounds":
      return "7+12";
    case "load":
      return "100";
    case "reps":
      return "84";
    case "distance":
      return "1500";
  }
}
