/**
 * The shape of an athlete's week.
 *
 * A track is not a difficulty setting. It is how the week is divided up — how
 * many times you train and how long you have when you do — and that changes
 * what good programming looks like more than almost anything else. Three
 * 40-minute sessions and six 12-minute ones are not the same week written at
 * different volumes; they need different structures, and a session designed
 * for one is wrong in the other.
 *
 * `brief` goes to the model, `summary` to the screen, and `sessions` and the
 * minute range are the numbers both of them are really about — kept here so a
 * track cannot say one thing in the UI and another in the prompt.
 */

export const TRACKS = ["long", "short"] as const;
export type Track = (typeof TRACKS)[number];

export interface TrackSpec {
  readonly label: string;
  readonly summary: string;
  /** Sessions in a week. The default the planner offers. */
  readonly sessions: number;
  readonly minutes: readonly [number, number];
  readonly brief: string;
}

export const TRACK_SPECS: Record<Track, TrackSpec> = {
  long: {
    label: "Three long sessions",
    summary: "3 a week, 30–45 minutes. Room for strength and conditioning in one go.",
    sessions: 3,
    minutes: [30, 45],
    brief: [
      "LONG TRACK — three sessions a week, 30 to 45 minutes each, warm-up and",
      "cool-down included in that time.",
      "There is room for a real structure: warm-up, a strength or skill piece while",
      "fresh, a conditioning piece, then a cool-down. Use it.",
      "Because there are only three sessions, each one has to be broad — no movement",
      "pattern should go untouched for the whole week. Assume at least a full day",
      "between sessions, so a session may be genuinely demanding and leave a mark.",
    ].join(" "),
  },
  short: {
    label: "Six short sessions",
    summary: "6 a week, 10–15 minutes. One focused piece a day, recoverable by tomorrow.",
    sessions: 6,
    minutes: [10, 15],
    brief: [
      "SHORT TRACK — six sessions a week, 10 to 15 minutes each, warm-up included",
      "in that time.",
      "Each session does one thing well: a single focused piece, not a circuit of",
      "four. Keep the warm-up to two or three minutes and fold mobility into the",
      "working sets rather than bolting it on the end — there is not time for both.",
      "These land on consecutive days, so alternate what is loaded: nothing heavy",
      "two days running, and no pattern hammered back to back. Hold intensity to",
      "something recoverable by tomorrow, because tomorrow is another session.",
      "Daily training only works if it is sustainable; a session that wrecks them",
      "costs the next one too.",
    ].join(" "),
  },
};

export function isTrack(value: unknown): value is Track {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value);
}

export function trackSpec(track: Track): TrackSpec {
  return TRACK_SPECS[track];
}

/** "30–45 min", for a badge. */
export function trackLength(track: Track): string {
  const [from, to] = TRACK_SPECS[track].minutes;
  return `${from}–${to} min`;
}
