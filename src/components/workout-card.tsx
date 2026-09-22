import Link from "next/link";

import { Card } from "@/components/ui";
import type { DayEntry } from "@/lib/db/types";
import type { Unit } from "@/lib/units";
import { formatDuration, formatLoad } from "@/lib/units";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { formatScore, scoreFromValue } from "@/lib/workout/score";

/** The prescription for one movement, rendered the way it is written down. */
function prescription(
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

export function WorkoutCard({ entry, unit }: { entry: DayEntry; unit: Unit }) {
  const { workout, result, assignment } = entry;
  const spec = FORMAT_SPECS[workout.format];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{workout.title}</h3>
          <p className="text-xs uppercase tracking-wide opacity-60">
            {spec.label}
            {workout.capSeconds ? ` · ${formatDuration(workout.capSeconds)} cap` : ""}
            {workout.source === "ai" ? " · written by AI" : ""}
          </p>
        </div>
        {result ? (
          <span className="rounded-lg bg-lime/15 px-3 py-1 text-sm font-semibold text-lime dark:text-lime-300">
            {result.scoreValue === null
              ? "Logged"
              : formatScore(scoreFromValue(result.scoreKind, result.scoreValue), unit)}
            {result.scaled ? " (scaled)" : ""}
          </span>
        ) : null}
      </div>

      {workout.description ? (
        <p className="mt-3 whitespace-pre-line text-sm opacity-80">{workout.description}</p>
      ) : null}

      {workout.movements.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {workout.movements.map((m) => {
            const detail = prescription(m, unit);
            return (
              <li key={m.id} className="text-sm">
                <span className="font-medium">{m.name}</span>
                {detail ? <span className="opacity-70"> — {detail}</span> : null}
                {m.notes ? <span className="block text-xs opacity-55">{m.notes}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <Link
        href={`/log/${assignment.id}`}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-iron px-4 font-medium text-chalk dark:bg-chalk dark:text-iron"
      >
        {result ? "Fix the record" : "Log it"}
      </Link>
    </Card>
  );
}
