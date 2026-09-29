import { formatDuration, formatLoad } from "@/lib/units";
import type { Unit } from "@/lib/units";

/**
 * The prescription for one movement, rendered the way it is written down.
 *
 * Shared by the workout card and the logging screen, so what an athlete reads
 * before starting and what they read mid-set cannot drift apart.
 */
export function prescription(
  m: { reps: number | null; sets: number | null; loadG: number | null; distanceM: number | null; seconds: number | null },
  unit: Unit,
): string {
  const bits: string[] = [];
  if (m.sets && m.reps) bits.push(`${m.sets} × ${m.reps}`);
  else if (m.reps) bits.push(`${m.reps} reps`);
  else if (m.sets) bits.push(`${m.sets} sets`);
  if (m.distanceM) bits.push(`${m.distanceM} m`);
  if (m.seconds) bits.push(formatDuration(m.seconds));
  if (m.loadG) bits.push(formatLoad(m.loadG, unit));
  return bits.join(" · ");
}
