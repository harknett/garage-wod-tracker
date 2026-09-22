import { z } from "zod";

import { FORMATS } from "@/lib/workout/formats";

/**
 * The shape the model must return.
 *
 * This is the contract in both directions: it constrains generation through
 * structured outputs, and it is what the importer validates before anything
 * reaches the database. Keeping one schema for both means the model cannot
 * return a week the importer would reject.
 *
 * Loads are deliberately **kilograms as a number**, not a formatted string -
 * the model is bad at units and good at numbers, so the conversion to stored
 * grams happens in our code, once.
 */
export const GeneratedMovement = z.object({
  name: z.string().describe("The movement, e.g. 'Back squat', 'Row', 'Wall ball'."),
  reps: z.number().int().positive().nullable().describe("Reps per set or per round."),
  sets: z.number().int().positive().nullable().describe("Number of sets, when the format has fixed sets."),
  load_kg: z.number().nonnegative().nullable().describe("Prescribed load in kilograms. Null for bodyweight."),
  distance_m: z.number().int().positive().nullable().describe("Distance in metres, for machines and runs."),
  seconds: z.number().int().positive().nullable().describe("Work duration in seconds, for holds and intervals."),
  notes: z.string().describe("Scaling options and standards. May be empty."),
});

export const GeneratedWorkout = z.object({
  day: z.number().int().min(0).max(6).describe("Days from the start of the week. 0 is the first day."),
  title: z.string().describe("A short name, e.g. 'Pull strength + engine'."),
  format: z.enum(FORMATS).describe("How the workout is scored."),
  description: z.string().describe("The prescription in plain language, including warm-up and cool-down."),
  cap_seconds: z.number().int().positive().nullable().describe("Time cap in seconds, for capped formats. Null otherwise."),
  movements: z.array(GeneratedMovement).min(1),
});

export const GeneratedWeek = z.object({
  summary: z.string().describe("Two or three sentences on what this week is trying to achieve and why, given the history."),
  workouts: z.array(GeneratedWorkout).min(1).max(7),
});

export type GeneratedWeek = z.infer<typeof GeneratedWeek>;
export type GeneratedWorkout = z.infer<typeof GeneratedWorkout>;
