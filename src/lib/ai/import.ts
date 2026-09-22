import "server-only";

import { getStore } from "@/lib/db";
import type { NewMovement } from "@/lib/db/types";
import { addDays } from "@/lib/dates";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import type { Phase } from "@/lib/workout/phases";

import type { GeneratedWeek } from "./schema";

/**
 * Turn a generated week into rows, assigned to one athlete.
 *
 * Two conversions happen here and nowhere else: kilograms become stored grams,
 * and a day offset becomes a calendar date. Doing both at the boundary keeps
 * the model's output in the model's own units right up until it lands.
 *
 * The whole import is one transaction. A half-imported week - three days in
 * the planner and four missing - is worse than a failed one, because it looks
 * like a finished week.
 */
export function importWeek(
  week: GeneratedWeek,
  userId: number,
  startDate: string,
  phase: Phase,
): number[] {
  const store = getStore();

  return store.transaction(() =>
    week.workouts.map((w) => {
      const movements: NewMovement[] = w.movements.map((m) => ({
        name: m.name,
        reps: m.reps,
        sets: m.sets,
        loadG: m.load_kg === null ? null : Math.round(m.load_kg * 1000),
        distanceM: m.distance_m,
        seconds: m.seconds,
        notes: m.notes,
      }));

      const workoutId = store.createWorkout({
        title: w.title,
        format: w.format,
        description: w.description,
        // A cap only means something for a format that has one; a cap on a
        // strength day is the model being tidy rather than a real constraint.
        capSeconds: FORMAT_SPECS[w.format].capped ? w.cap_seconds : null,
        source: "ai",
        // Stamped from the phase the week was generated under, not read back
        // out of the model: the phase is an input, and a model that renamed it
        // would quietly rewrite the record of what was asked for.
        phase,
        createdBy: userId,
        movements,
      });

      store.assign(workoutId, userId, addDays(startDate, w.day), w.day);
      return workoutId;
    }),
  );
}
