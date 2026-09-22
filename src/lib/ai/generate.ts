import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { User } from "@/lib/db/types";

import { equipmentContext, trainingContext } from "./context";
import { PHASE_SPECS } from "@/lib/workout/phases";
import type { Phase } from "@/lib/workout/phases";
import { GeneratedWeek } from "./schema";

/**
 * Writing a week of training.
 *
 * Opus 5 with adaptive thinking: programming a week is a reasoning job - it
 * has to hold the athlete's history, a recovery curve and a movement balance
 * in mind at once - and it is run a handful of times a week by one coach, so
 * the per-call cost is noise against getting the week right.
 *
 * Structured outputs do the schema enforcement, so this module never parses
 * prose. What it does own is the half a schema cannot express: the system
 * prompt below is the actual programming brief.
 */

const MODEL = "claude-opus-5";

/** Thrown when the app is not configured to call the API at all. */
export class NotConfiguredError extends Error {}

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const SYSTEM = `You are programming training for a garage gym: one athlete, limited
equipment, no coach watching the bar. Your brief is general physical
preparedness - mobility, durable joints, an engine, and enough strength to make
daily life easy. You are not programming for a competitive athlete unless the
history plainly shows one.

Hold to these:

- **Progress off what is written down.** The history you are given is the whole
  basis for load and volume. If a movement has a recorded best, prescribe
  against it; if it does not, prescribe conservatively and say so in the notes.
- **A week is one thing, not seven.** Order the days so hard sessions have easy
  ones after them, no two consecutive days hammer the same pattern, and the
  week has at least one genuinely light or mobility-led day.
- **Mobility is programmed, not bolted on.** Every session's description should
  name a specific warm-up and a specific cool-down, chosen for that day's work.
- **Respect the signals.** Rising RPE at flat volume, missed sessions, or notes
  mentioning pain or stiffness mean back off - say why in the summary.
- **Vary the format.** A month of AMRAPs is not a programme. Use the format
  that fits the stimulus, and read the format list as a menu.
- **Scale honestly.** Every movement's notes should say what to do if the
  prescribed version is not available yet.
- **Program only what the gym owns.** The equipment list is a hard constraint,
  not a suggestion. Never prescribe a machine, an implement or a load the list
  does not cover, and never assume a rack, a rower or a pull-up bar is there
  because most gyms have one.

Loads are in kilograms, as numbers. Write the description as you would say it
to the athlete standing in front of you.`;

export interface GenerateOptions {
  /** The coach's brief: "four days, shoulder is cranky, no running". */
  prompt: string;
  /** How many days the week should cover. */
  days: number;
  athlete: User;
  /** The phase this week is written under. Steers volume, load and intensity. */
  phase: Phase;
}

export async function generateWeek(options: GenerateOptions): Promise<GeneratedWeek> {
  if (!isConfigured()) {
    throw new NotConfiguredError(
      "ANTHROPIC_API_KEY is not set, so workout generation is switched off. " +
        "See deploy/README.md; workouts can still be written by hand.",
    );
  }

  const client = new Anthropic();
  const history = trainingContext(options.athlete);
  const equipment = equipmentContext(options.athlete.unit);

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Write ${options.days} day(s) of training for ${options.athlete.name}.`,
          "",
          "--- training phase ---",
          // The phase outranks the coach's brief and the history: it is the
          // frame both of those are read inside.
          PHASE_SPECS[options.phase].brief,
          "",
          "Say in the summary how this week reflects that phase.",
          "",
          "The coach asks for:",
          options.prompt.trim() || "(nothing specific - use your judgement)",
          "",
          "--- equipment ---",
          equipment,
          "",
          "--- training history ---",
          history,
        ].join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(GeneratedWeek) },
  });

  // parsed_output is null when the model returns something the schema rejects.
  // That is a real failure worth surfacing, not something to paper over with a
  // half-built week.
  const week = response.parsed_output;
  if (!week) {
    throw new Error("The model did not return a usable week. Try again, or adjust the brief.");
  }
  return week;
}
