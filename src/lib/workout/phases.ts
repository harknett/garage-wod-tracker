/**
 * Where an athlete is in their training, and what that means for programming.
 *
 * A phase is not a label on a profile — it changes what a good week looks
 * like. The same athlete, the same equipment and the same history should
 * produce three different weeks under the three phases, so the instruction
 * that makes that true is written here rather than left to the prompt to
 * improvise.
 *
 * `brief` goes to the model. `summary` is what a person reads on screen. They
 * say the same thing at different lengths, and they are kept beside each other
 * so they cannot drift apart.
 */

export const PHASES = ["ramping", "conditioning", "leaning", "building"] as const;
export type Phase = (typeof PHASES)[number];

export interface PhaseSpec {
  readonly label: string;
  /** One line, for a badge or a select. */
  readonly summary: string;
  /** The programming instruction handed to the model. */
  readonly brief: string;
}

export const PHASE_SPECS: Record<Phase, PhaseSpec> = {
  ramping: {
    label: "Ramping",
    summary: "Coming back. Build the base before you touch intensity.",
    brief: [
      "RAMPING — returning from being sedentary, ill or injured.",
      "Build tolerance before intensity. Keep effort moderate and repeatable:",
      "no grinding sets, nothing taken to failure, nothing that costs them the",
      "next two days. Prioritise range of motion, positions and tissue tolerance.",
      "Volume climbs before load does. Sessions should end with the athlete",
      "feeling they could have done more — that is the point, not a shortfall.",
      "Target RPE 5-7. If the history shows pain or a missed week, back off further.",
    ].join(" "),
  },
  conditioning: {
    label: "Mobility & conditioning",
    summary: "Maintenance. Stay balanced, stay mobile, keep the engine.",
    brief: [
      "CONDITIONING — general maintenance and balance, with no body-composition",
      "or strength target in play. This is where a healthy athlete lives between",
      "blocks, and it is a destination, not a holding pattern.",
      "Balance the week across push, pull, hinge, squat, carry and a genuine",
      "aerobic base — no pattern neglected two weeks running. Mobility is",
      "programmed work here rather than a warm-up afterthought: give it real time",
      "in every session, and aim it at the positions their history shows they",
      "avoid. Nothing should be hard enough to need a recovery day; the week",
      "should be repeatable indefinitely. Target RPE 5-7, with one harder piece",
      "if they want it.",
    ].join(" "),
  },
  leaning: {
    label: "Leaning",
    summary: "Stripping fat. Density and engine, without giving up strength.",
    brief: [
      "LEANING — dropping body fat while holding onto muscle.",
      "Favour density and conditioning: more work in the same time, shorter rest,",
      "mixed-modal pieces that keep the heart rate up. Keep genuine heavy work in",
      "the week — a leaning block that drops all load costs muscle, which is the",
      "one thing this phase must not do. Assume they are training in a calorie",
      "deficit, so watch total volume and recovery; RPE creeping up week on week",
      "at flat volume means cut the volume, not add to it. Target RPE 6-8.",
    ].join(" "),
  },
  building: {
    label: "Building",
    summary: "Getting stronger. Heavy first, full rest, add weight every week.",
    brief: [
      "BUILDING — adding strength and muscle.",
      "Heavy compound work goes first, while they are fresh: lower reps, full rest",
      "between working sets, and a visible week-on-week progression in load against",
      "what the history records. Conditioning stays in the week but is subordinate —",
      "it supports recovery rather than competing with the lifting for it. Accept",
      "lower total session volume in exchange for quality. Target RPE 7-9 on the",
      "main lifts.",
    ].join(" "),
  },
};

export function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && (PHASES as readonly string[]).includes(value);
}

export function phaseSpec(phase: Phase): PhaseSpec {
  return PHASE_SPECS[phase];
}
