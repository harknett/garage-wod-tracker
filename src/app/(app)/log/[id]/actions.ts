"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import type { MovementResult } from "@/lib/db/types";
import { parseDuration, parseLoad, UnitParseError } from "@/lib/units";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { ScoreParseError, parseScore } from "@/lib/workout/score";

export interface LogState {
  error?: string;
}

/** An empty box means "not recorded", which is different from zero. */
function optional(data: FormData, key: string): string | null {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

function optionalInt(data: FormData, key: string, what: string): number | null {
  const raw = optional(data, key);
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) throw new ScoreParseError(`${what} must be a whole number.`);
  return Number(raw);
}

/**
 * Save what happened.
 *
 * Everything is parsed before anything is written, so a mistyped weight in the
 * last movement does not leave the first three saved and the score lost.
 */
export async function saveResult(_prev: LogState, data: FormData): Promise<LogState> {
  const user = await requireUser();
  const store = getStore();

  const assignmentId = Number(data.get("assignmentId"));
  const assignment = store.findAssignment(assignmentId);
  if (!assignment || assignment.userId !== user.id) {
    return { error: "That workout is not yours to log." };
  }

  const workout = store.getWorkout(assignment.workoutId)!;
  const spec = FORMAT_SPECS[workout.format];
  // Each athlete types in their own unit; the form carries it so a shared
  // phone in the garage cannot silently log pounds as kilos.
  const unit = user.unit;

  try {
    const scoreText = optional(data, "score");
    const score = scoreText === null ? null : parseScore(scoreText, workout.format, unit);

    const movements: MovementResult[] = workout.movements.map((m) => {
      const loadText = optional(data, `load_${m.id}`);
      const timeText = optional(data, `seconds_${m.id}`);
      return {
        movementId: m.id,
        reps: optionalInt(data, `reps_${m.id}`, "Reps"),
        loadG: loadText === null ? null : parseLoad(loadText, unit),
        seconds: timeText === null ? null : parseDuration(timeText),
        distanceM: optionalInt(data, `distance_${m.id}`, "Distance"),
        notes: String(data.get(`notes_${m.id}`) ?? "").trim(),
      };
    });

    const rpe = optionalInt(data, "rpe", "RPE");
    if (rpe !== null && (rpe < 1 || rpe > 10)) return { error: "RPE runs from 1 to 10." };

    store.saveResult(
      {
        assignmentId,
        scoreValue: score?.value ?? null,
        scoreKind: spec.score,
        scaled: data.get("scaled") === "on",
        rpe,
        notes: String(data.get("notes") ?? "").trim(),
        movements,
      },
      user.id,
    );
  } catch (err) {
    if (err instanceof ScoreParseError || err instanceof UnitParseError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/week");
  redirect("/");
}
