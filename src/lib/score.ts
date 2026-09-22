/**
 * Workout scores, as they are actually written on a whiteboard.
 *
 * Two shapes cover nearly every WOD: a "for time" score, which is a duration,
 * and an AMRAP score, which is whole rounds plus a part-finished round. They
 * are kept as one tagged union so a log entry can hold either without the
 * caller guessing which fields are meaningful.
 */
export type Score =
  | { kind: "time"; seconds: number }
  | { kind: "rounds"; rounds: number; reps: number };

/** Thrown for input that is not a score, as opposed to a bad score. */
export class ScoreParseError extends Error {}

const TIME = /^(?:(\d+):)?([0-5]?\d)(?:\.(\d{1,2}))?$/;
const ROUNDS = /^(\d+)(?:\s*\+\s*(\d+))?$/;

/**
 * Parse a whiteboard score.
 *
 * Accepts `12:34`, `9:07.5`, `45` (seconds) for time, and `7` or `7+12` for
 * rounds. The two notations overlap at a bare integer — `45` — so the event's
 * scoring decides, not the text: a bare number is seconds under `"time"` and
 * rounds under `"rounds"`. Guessing from the text alone silently turns a
 * 45-second sprint into 45 rounds.
 */
export function parseScore(input: string, kind: Score["kind"]): Score {
  const text = input.trim();
  if (text === "") throw new ScoreParseError("A score cannot be blank.");

  if (kind === "time") {
    const m = TIME.exec(text);
    if (!m) throw new ScoreParseError(`Not a time: ${input}`);
    const [, mins, secs, frac] = m;
    // Fractions are truncated, not rounded: a clock that reads 9:07.9 has not
    // reached 9:08, and rounding up would invent a tenth of a second.
    const seconds = Number(mins ?? 0) * 60 + Number(secs) + (frac ? Number(`0.${frac}`) : 0);
    return { kind: "time", seconds: Math.trunc(seconds * 10) / 10 };
  }

  const m = ROUNDS.exec(text);
  if (!m) throw new ScoreParseError(`Not a round count: ${input}`);
  return { kind: "rounds", rounds: Number(m[1]), reps: Number(m[2] ?? 0) };
}

/** Render a score the way it would be written back on the board. */
export function formatScore(score: Score): string {
  if (score.kind === "rounds") {
    return score.reps === 0 ? `${score.rounds}` : `${score.rounds}+${score.reps}`;
  }
  const whole = Math.trunc(score.seconds);
  const mins = Math.trunc(whole / 60);
  const secs = whole % 60;
  const frac = Math.round((score.seconds - whole) * 10);
  const base = `${mins}:${String(secs).padStart(2, "0")}`;
  return frac === 0 ? base : `${base}.${frac}`;
}
