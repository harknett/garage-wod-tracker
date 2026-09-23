/**
 * The workout's result, worked out from what was actually logged.
 *
 * Athletes record each movement — reps, load, time, distance — and the score
 * follows from that rather than being typed a second time. Asking for both
 * invites them to disagree, and when they do there is no way to tell which one
 * is the lie.
 *
 * What "the result" means is decided by the format's score kind, the same
 * property the leaderboard sorts on:
 *
 *   - **rounds** — total reps, divided back into rounds and a part round using
 *     the prescribed round. Logging 547 reps of Cindy's 30-rep round reads as
 *     `18+7`, which is what went on the whiteboard.
 *   - **reps** — total reps, plain.
 *   - **time** — the working time logged across the movements.
 *   - **load** — the heaviest single load, not the total: a strength day is
 *     judged by the top set, and summing sets would reward volume instead.
 *   - **distance** — total metres.
 *
 * Returns null when nothing relevant was logged. That is "started, not
 * finished", which is different from a score of zero and must stay different:
 * the leaderboard sorts a null last in either direction.
 */

import type { Movement, MovementResult } from "@/lib/db/types";

import { FORMAT_SPECS } from "./formats";
import type { Format } from "./formats";
import { roundsValue } from "./score";
import type { Score } from "./score";

/** Only the fields the derivation reads, so callers can pass form state. */
export type LoggedMovement = Pick<
  MovementResult,
  "reps" | "loadG" | "seconds" | "distanceM"
>;
export type PrescribedMovement = Pick<Movement, "reps" | "sets">;

function total(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}

/**
 * How many reps make one round.
 *
 * The sum of each movement's prescribed reps. `sets` is deliberately ignored:
 * in a rounds format the sets *are* the rounds, so multiplying by them would
 * count the same work twice.
 */
export function roundSize(movements: PrescribedMovement[]): number {
  return movements.reduce((sum, m) => sum + (m.reps ?? 0), 0);
}

export function deriveScore(
  format: Format,
  prescribed: PrescribedMovement[],
  logged: LoggedMovement[],
): Score | null {
  const kind = FORMAT_SPECS[format].score;

  switch (kind) {
    case "time": {
      const seconds = total(logged.map((m) => m.seconds));
      return seconds === null ? null : { kind, value: seconds };
    }

    case "load": {
      // The top set, not the tonnage.
      const loads = logged
        .map((m) => m.loadG)
        .filter((v): v is number => v !== null && v > 0);
      return loads.length === 0 ? null : { kind, value: Math.max(...loads) };
    }

    case "distance": {
      const metres = total(logged.map((m) => m.distanceM));
      return metres === null ? null : { kind, value: metres };
    }

    case "reps": {
      const reps = total(logged.map((m) => m.reps));
      return reps === null ? null : { kind, value: reps };
    }

    case "rounds": {
      const reps = total(logged.map((m) => m.reps));
      if (reps === null) return null;

      const size = roundSize(prescribed);
      // Without a prescribed round there is nothing to divide by, and calling
      // every rep a round would be a worse answer than admitting we cannot
      // tell. The reps themselves are still stored per movement.
      if (size <= 0) return null;

      const rounds = Math.floor(reps / size);
      const part = reps % size;
      return { kind, value: roundsValue(rounds, part), rounds, reps: part };
    }
  }
}
