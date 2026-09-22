/**
 * The shapes a workout comes in, and what "better" means in each.
 *
 * Every format is defined by one thing: how a result is scored. That single
 * property decides what the logging screen asks for, how the leaderboard
 * sorts, and what a personal best means — so it is written down once, here,
 * rather than re-derived by each of those three.
 */

export const SCORE_KINDS = ["time", "rounds", "reps", "load", "distance"] as const;
export type ScoreKind = (typeof SCORE_KINDS)[number];

export const FORMATS = [
  "for_time",
  "amrap",
  "emom",
  "death_by",
  "sets_reps",
  "tabata",
  "chipper",
  "ladder",
  "interval",
  "strength",
  "skill",
] as const;
export type Format = (typeof FORMATS)[number];

export interface FormatSpec {
  readonly label: string;
  /** What a result is measured in. */
  readonly score: ScoreKind;
  /** Whether a smaller score is a better one. */
  readonly lowerIsBetter: boolean;
  /**
   * Whether the workout carries a clock the athlete works against, as opposed
   * to one they race. An AMRAP's 12 minutes are fixed; a for-time's are not.
   */
  readonly capped: boolean;
  readonly hint: string;
}

export const FORMAT_SPECS: Record<Format, FormatSpec> = {
  for_time: {
    label: "For time",
    score: "time",
    lowerIsBetter: true,
    capped: false,
    hint: "All of the work. Fastest clock. Nothing left out.",
  },
  amrap: {
    label: "AMRAP",
    score: "rounds",
    lowerIsBetter: false,
    capped: true,
    hint: "As many rounds as you can hold before the clock stops you.",
  },
  emom: {
    label: "EMOM",
    score: "rounds",
    lowerIsBetter: false,
    capped: true,
    hint: "Every minute, on the minute. It ends when you cannot start on time.",
  },
  death_by: {
    label: "Death by",
    score: "rounds",
    lowerIsBetter: false,
    capped: false,
    hint: "One rep. Then two. Then three. It ends when you fail.",
  },
  sets_reps: {
    label: "Sets and reps",
    score: "load",
    lowerIsBetter: false,
    capped: false,
    hint: "Same weight every set. The bar does not negotiate.",
  },
  tabata: {
    label: "Tabata",
    score: "reps",
    lowerIsBetter: false,
    capped: true,
    hint: "Twenty on, ten off, eight times. Your score is your worst round.",
  },
  chipper: {
    label: "Chipper",
    score: "time",
    lowerIsBetter: true,
    capped: false,
    hint: "One long list. Once through. Chip away.",
  },
  ladder: {
    label: "Ladder",
    score: "rounds",
    lowerIsBetter: false,
    capped: false,
    hint: "Reps climb every round. Ride it until it throws you.",
  },
  interval: {
    label: "Intervals",
    score: "time",
    lowerIsBetter: true,
    capped: false,
    hint: "Hard efforts, measured rest. The rest is part of the work.",
  },
  strength: {
    label: "Strength",
    score: "load",
    lowerIsBetter: false,
    capped: false,
    hint: "Work up. Find today's heavy. Leave nothing untested.",
  },
  skill: {
    label: "Skill",
    score: "reps",
    lowerIsBetter: false,
    capped: false,
    hint: "Practice. Only clean reps count.",
  },
};

export function isFormat(value: unknown): value is Format {
  return typeof value === "string" && (FORMATS as readonly string[]).includes(value);
}

export function formatSpec(format: Format): FormatSpec {
  return FORMAT_SPECS[format];
}

/**
 * Order two results of the same format, best first.
 *
 * Returns a comparator value, so it drops straight into `Array.sort`. A
 * missing score always sorts last, whichever direction the format runs: not
 * finishing is not a win, and in a lower-is-better workout a null would
 * otherwise beat every finisher.
 */
export function compareScores(
  format: Format,
  a: number | null,
  b: number | null,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return FORMAT_SPECS[format].lowerIsBetter ? a - b : b - a;
}
