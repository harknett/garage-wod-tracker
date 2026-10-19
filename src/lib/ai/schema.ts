import { z } from "zod";

import type { Unit } from "@/lib/units";
import { FORMATS } from "@/lib/workout/formats";

/**
 * The shape the model must return.
 *
 * This is the contract in both directions: it constrains generation through
 * structured outputs, and it is what the importer validates before anything
 * reaches the database. Keeping one schema for both means the model cannot
 * return a week the importer would reject.
 *
 * Loads are deliberately **a number in the athlete's own unit**, not a
 * formatted string - the model is bad at units and good at numbers, so the
 * conversion to stored grams happens in our code, once. The unit is the
 * athlete's because that is what the model reads their history and the kit
 * list in, and what they load the bar in: a week written in kilograms for a
 * pounds athlete prescribes 102.5 kg, which lands on their card as 226 lb.
 */
const UNIT_NAMES: Record<Unit, string> = { kg: "kilograms", lb: "pounds" };

function generatedMovement(unit: Unit) {
  return z.object({
    name: z.string().describe("The movement, e.g. 'Back squat', 'Row', 'Wall ball'."),
    reps: z.number().int().positive().nullable().describe("Reps per set or per round."),
    sets: z.number().int().positive().nullable().describe("Number of sets, when the format has fixed sets."),
    load: z
      .number()
      .nonnegative()
      .nullable()
      .describe(`Prescribed load in ${UNIT_NAMES[unit]} (${unit}). Null for bodyweight.`),
    distance_m: z.number().int().positive().nullable().describe("Distance in metres, for machines and runs."),
    seconds: z.number().int().positive().nullable().describe("Work duration in seconds, for holds and intervals."),
    notes: z.string().describe("Scaling options and standards. May be empty."),
  });
}

function generatedWorkout(unit: Unit) {
  return z.object({
    day: z.number().int().min(0).max(6).describe("Days from the start of the week. 0 is the first day."),
    title: z.string().describe("A short name, e.g. 'Pull strength + engine'."),
    format: z.enum(FORMATS).describe("How the workout is scored."),
    description: z.string().describe("The prescription in plain language, including warm-up and cool-down."),
    cap_seconds: z.number().int().positive().nullable().describe("Time cap in seconds, for capped formats. Null otherwise."),
    movements: z.array(generatedMovement(unit)).min(1),
  });
}

/** The week's schema, with loads in `unit`. */
export function generatedWeek(unit: Unit) {
  return z.object({
    summary: z.string().describe("Two or three sentences on what this week is trying to achieve and why, given the history."),
    workouts: z.array(generatedWorkout(unit)).min(1).max(7),
  });
}

// The unit only changes descriptions, never the shape, so one type serves both.
export type GeneratedWeek = z.infer<ReturnType<typeof generatedWeek>>;
export type GeneratedWorkout = GeneratedWeek["workouts"][number];
