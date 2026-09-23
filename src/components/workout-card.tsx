import Link from "next/link";

import { Card } from "@/components/ui";
import { MoveWorkout } from "@/components/move-workout";
import type { DayEntry } from "@/lib/db/types";
import type { Unit } from "@/lib/units";
import { formatDuration, formatLoad } from "@/lib/units";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { PHASE_SPECS } from "@/lib/workout/phases";
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

export function WorkoutCard({
  entry,
  unit,
  movable = false,
}: {
  entry: DayEntry;
  unit: Unit;
  /** Show the date picker that shifts this session to another day. */
  movable?: boolean;
}) {
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
          {/* The phase it was written under, which is not necessarily the
              phase the athlete is in now. */}
          {workout.phase ? (
            <p className="mt-1 text-xs opacity-70">{PHASE_SPECS[workout.phase].summary}</p>
          ) : null}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/log/${assignment.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-iron px-4 font-medium text-chalk dark:bg-chalk dark:text-iron"
        >
          {result ? "Fix the record" : "Log it"}
        </Link>
        {movable ? <MoveWorkout assignmentId={assignment.id} date={assignment.date} /> : null}
      </div>
    </Card>
  );
}
