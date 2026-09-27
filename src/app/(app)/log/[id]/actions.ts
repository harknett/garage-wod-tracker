"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import type { MovementResult } from "@/lib/db/types";
import { parseDuration, parseLoad, UnitParseError } from "@/lib/units";
import { deriveScore } from "@/lib/workout/derive";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { ScoreParseError } from "@/lib/workout/score";

export interface LogState {
  error?: string;
}

export interface ProgressState {
  error?: string;
  /** When the last autosave landed, so the screen can say so. */
  savedAt?: number;
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
 * Read the form into rows, or explain what is wrong with it.
 *
 * Shared by the autosave and the finish, so a draft cannot be accepted in a
 * shape the final save would reject.
 */
async function readForm(data: FormData) {
  const user = await requireUser();
  const store = getStore();

  const assignmentId = Number(data.get("assignmentId"));
  const assignment = store.findAssignment(assignmentId);
  if (!assignment || assignment.userId !== user.id) {
    throw new ScoreParseError("That workout is not yours to log.");
  }

  const workout = store.getWorkout(assignment.workoutId)!;
  // Each athlete types in their own unit; the form carries it so a shared
  // phone in the garage cannot silently log pounds as kilos.
  const unit = user.unit;

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
  if (rpe !== null && (rpe < 1 || rpe > 10)) {
    throw new ScoreParseError("RPE runs from 1 to 10.");
  }

  const spec = FORMAT_SPECS[workout.format];
  const score = deriveScore(workout.format, workout.movements, movements);

  return {
    user,
    store,
    result: {
      assignmentId,
      scoreValue: score?.value ?? null,
      scoreKind: spec.score,
      scaled: data.get("scaled") === "on",
      rpe,
      notes: String(data.get("notes") ?? "").trim(),
      movements,
    },
  };
}

function asMessage(err: unknown): string {
  if (err instanceof ScoreParseError || err instanceof UnitParseError) return err.message;
  throw err;
}

/**
 * Save the session as it stands, without finishing it.
 *
 * Called while the athlete is still training, so it never redirects and never
 * marks the session done. A set logged between rounds is worth keeping even if
 * the phone is locked and forgotten about; losing the first twenty minutes of
 * a workout because the last twenty were never entered is the failure this
 * exists to prevent.
 *
 * Half-typed input is normal here — somebody is mid-keystroke — so a parse
 * error is reported without wiping anything already stored.
 */
export async function saveProgress(
  _prev: ProgressState,
  data: FormData,
): Promise<ProgressState> {
  try {
    const { store, user, result } = await readForm(data);
    store.saveResult({ ...result, completed: false }, user.id);
  } catch (err) {
    return { error: asMessage(err) };
  }

  // No revalidate: the athlete is on this screen and nothing else is looking.
  return { savedAt: Date.now() };
}

/**
 * Finish the session.
 *
 * The same save, plus the flag that puts it on the board and into the
 * analytics. Finishing sticks: a late autosave cannot reopen it.
 */
export async function saveResult(_prev: LogState, data: FormData): Promise<LogState> {
  try {
    const { store, user, result } = await readForm(data);
    store.saveResult({ ...result, completed: true }, user.id);
  } catch (err) {
    return { error: asMessage(err) };
  }

  revalidatePath("/");
  revalidatePath("/week");
  redirect("/");
}
