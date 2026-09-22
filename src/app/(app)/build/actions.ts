"use server";

import { revalidatePath } from "next/cache";

import { NotConfiguredError, generateWeek } from "@/lib/ai/generate";
import { importWeek } from "@/lib/ai/import";
import { requireOwner } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import type { NewMovement } from "@/lib/db/types";
import { isValidDate, weekStart } from "@/lib/dates";
import { UnitParseError, parseDuration, parseLoad } from "@/lib/units";
import { isFormat, FORMAT_SPECS } from "@/lib/workout/formats";
import { PHASE_SPECS, isPhase } from "@/lib/workout/phases";

export interface BuildState {
  error?: string;
  ok?: string;
  /** What the model said it was going for, shown back to the coach. */
  summary?: string;
}

/**
 * Write a week with the model, then put it in an athlete's planner.
 *
 * Generation and import are deliberately one action: a week the coach has to
 * separately remember to save is a week that gets lost when the tab closes.
 * The coach edits afterwards, against real rows.
 */
export async function generate(_prev: BuildState, data: FormData): Promise<BuildState> {
  await requireOwner();
  const store = getStore();

  const athleteId = Number(data.get("athleteId"));
  const athlete = store.findUser(athleteId);
  if (!athlete) return { error: "Pick an athlete to write for." };

  const startRaw = String(data.get("start") ?? "");
  if (!isValidDate(startRaw)) return { error: "Pick a start date." };
  const start = weekStart(startRaw);

  const days = Number(data.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return { error: "A week runs from one to seven days." };
  }

  // The athlete's standing phase, unless the coach overrides it for this week
  // alone. An override does not move the athlete — that is a separate,
  // deliberate act on the Athletes screen.
  const phaseRaw = String(data.get("phase") ?? athlete.phase);
  if (!isPhase(phaseRaw)) return { error: "Pick a training phase." };

  try {
    const week = await generateWeek({
      prompt: String(data.get("prompt") ?? ""),
      days,
      athlete,
      phase: phaseRaw,
    });
    importWeek(week, athlete.id, start, phaseRaw);
    revalidatePath("/week");
    revalidatePath("/");
    return {
      ok:
        `Wrote ${week.workouts.length} session(s) for ${athlete.name}, ` +
        `${PHASE_SPECS[phaseRaw].label.toLowerCase()}, starting ${start}.`,
      summary: week.summary,
    };
  } catch (err) {
    if (err instanceof NotConfiguredError) return { error: err.message };
    // The API can be down, rate-limited or refuse; none of that should take
    // the page with it, and the coach can still write the week by hand.
    return {
      error: err instanceof Error ? err.message : "The model could not be reached.",
    };
  }
}

/** Write one workout by hand. */
export async function createManual(_prev: BuildState, data: FormData): Promise<BuildState> {
  const owner = await requireOwner();
  const store = getStore();

  const title = String(data.get("title") ?? "").trim();
  const format = String(data.get("format") ?? "");
  if (!title) return { error: "Give the workout a name." };
  if (!isFormat(format)) return { error: "Pick a format." };

  const athleteIds = data
    .getAll("athletes")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (athleteIds.length === 0) return { error: "Choose at least one athlete." };

  const date = String(data.get("date") ?? "");
  if (!isValidDate(date)) return { error: "Pick a date." };

  const phase = String(data.get("phase") ?? "");
  // A hand-written workout need not belong to a phase; "none" is a real answer
  // for a one-off, and is not the same as forgetting to choose.
  if (phase !== "" && !isPhase(phase)) return { error: "Pick a training phase, or none." };

  try {
    const capText = String(data.get("cap") ?? "").trim();
    const capSeconds =
      FORMAT_SPECS[format].capped && capText !== "" ? Math.round(parseDuration(capText)) : null;

    // The movement rows are a parallel-array form post: names[i] goes with
    // reps[i]. Rows whose name is blank are the empty spares at the bottom.
    const names = data.getAll("m_name").map((v) => String(v).trim());
    const reps = data.getAll("m_reps").map((v) => String(v).trim());
    const sets = data.getAll("m_sets").map((v) => String(v).trim());
    const loads = data.getAll("m_load").map((v) => String(v).trim());
    const notes = data.getAll("m_notes").map((v) => String(v).trim());

    const movements: NewMovement[] = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      if (name === "") continue;
      movements.push({
        name,
        reps: reps[i] ? Number(reps[i]) : null,
        sets: sets[i] ? Number(sets[i]) : null,
        loadG: loads[i] ? parseLoad(loads[i]!, owner.unit) : null,
        distanceM: null,
        seconds: null,
        notes: notes[i] ?? "",
      });
    }
    if (movements.length === 0) return { error: "Add at least one movement." };

    const workoutId = store.createWorkout({
      title,
      format,
      description: String(data.get("description") ?? "").trim(),
      capSeconds,
      source: "manual",
      phase: phase === "" ? null : phase,
      createdBy: owner.id,
      movements,
    });

    for (const id of athleteIds) store.assign(workoutId, id, date);

    revalidatePath("/week");
    revalidatePath("/");
    return { ok: `"${title}" assigned to ${athleteIds.length} athlete(s) on ${date}.` };
  } catch (err) {
    if (err instanceof UnitParseError) return { error: err.message };
    throw err;
  }
}
