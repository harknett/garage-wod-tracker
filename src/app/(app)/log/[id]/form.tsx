"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, Card, Field, Notice, PageTitle, inputClass } from "@/components/ui";
import type { FullWorkout, MovementResult, Result } from "@/lib/db/types";
import type { Unit } from "@/lib/units";
import { formatDuration, formatLoad } from "@/lib/units";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { formatScore, scoreFromValue, scorePlaceholder } from "@/lib/workout/score";

import { saveResult, type LogState } from "./actions";

export function LogForm({
  assignmentId,
  date,
  workout,
  unit,
  existing,
}: {
  assignmentId: number;
  date: string;
  workout: FullWorkout;
  unit: Unit;
  existing: (Result & { movements: MovementResult[] }) | null;
}) {
  const [state, action, pending] = useActionState<LogState, FormData>(saveResult, {});
  const spec = FORMAT_SPECS[workout.format];
  const byMovement = new Map(existing?.movements.map((m) => [m.movementId, m]) ?? []);

  const previousScore =
    existing?.scoreValue == null
      ? ""
      : formatScore(scoreFromValue(existing.scoreKind, existing.scoreValue), unit)
          // The score box takes the bare notation, not the rendered unit.
          .replace(/ (kg|lb|reps|m)$/, "");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      <PageTitle sub={`${date} · ${spec.label}`}>{workout.title}</PageTitle>

      {workout.description ? (
        <Card>
          <p className="whitespace-pre-line text-sm opacity-80">{workout.description}</p>
        </Card>
      ) : null}

      <Card>
        <Field label="Score" hint={spec.hint}>
          <input
            name="score"
            defaultValue={previousScore}
            placeholder={scorePlaceholder(workout.format)}
            inputMode={spec.score === "time" ? "text" : "decimal"}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <p className="mt-1 text-xs opacity-60">
          {spec.score === "load" ? `Weights in ${unit}.` : null}
          {spec.score === "time" ? "Minutes and seconds, like 12:34." : null}
          {spec.score === "rounds" ? "Rounds, or rounds+reps like 7+12." : null}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="RPE" hint="How hard it actually was, 1–10. Be honest.">
            <input
              name="rpe"
              type="number"
              min={1}
              max={10}
              inputMode="numeric"
              defaultValue={existing?.rpe ?? ""}
              className={inputClass}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-3 self-end">
            <input
              type="checkbox"
              name="scaled"
              defaultChecked={existing?.scaled ?? false}
              className="size-5"
            />
            <span className="text-sm font-medium">I scaled it</span>
          </label>
        </div>
      </Card>

      {workout.movements.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Movements</h2>
          <p className="mb-4 text-xs opacity-60">
            What you actually did. Not what you meant to do. Blank means not recorded.
          </p>
          <div className="space-y-5">
            {workout.movements.map((m) => {
              const prior = byMovement.get(m.id);
              return (
                <fieldset key={m.id} className="border-t border-black/10 pt-4 dark:border-white/10">
                  <legend className="text-sm font-medium">
                    {m.name}
                    {m.loadG ? (
                      <span className="opacity-60"> · prescribed {formatLoad(m.loadG, unit)}</span>
                    ) : null}
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Reps">
                      <input
                        name={`reps_${m.id}`}
                        inputMode="numeric"
                        defaultValue={prior?.reps ?? ""}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={`Load (${unit})`}>
                      <input
                        name={`load_${m.id}`}
                        inputMode="decimal"
                        defaultValue={prior?.loadG != null ? formatLoad(prior.loadG, unit).replace(` ${unit}`, "") : ""}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Time">
                      <input
                        name={`seconds_${m.id}`}
                        placeholder="1:30"
                        defaultValue={prior?.seconds != null ? formatDuration(prior.seconds) : ""}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Distance (m)">
                      <input
                        name={`distance_${m.id}`}
                        inputMode="numeric"
                        defaultValue={prior?.distanceM ?? ""}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Note">
                      <input
                        name={`notes_${m.id}`}
                        defaultValue={prior?.notes ?? ""}
                        placeholder="Banded, or dropped to 40 kg"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </fieldset>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card>
        <Field label="After action" hint="What held up, what broke down, what you fix next time.">
          <textarea
            name="notes"
            rows={3}
            defaultValue={existing?.notes ?? ""}
            className={`${inputClass} py-2`}
          />
        </Field>
      </Card>

      <Notice kind="error">{state.error}</Notice>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Log it"}
        </Button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/15 px-4 dark:border-white/20"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
