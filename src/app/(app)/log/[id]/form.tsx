"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { Button, Card, Field, Notice, PageTitle, inputClass } from "@/components/ui";
import type { FullWorkout, MovementResult, Result } from "@/lib/db/types";
import type { Unit } from "@/lib/units";
import { formatDuration, formatLoad } from "@/lib/units";
import { deriveScore } from "@/lib/workout/derive";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { formatScore } from "@/lib/workout/score";

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

  /**
   * What the movement boxes currently add up to.
   *
   * The score is not typed — it follows from the movements — so it is shown
   * here as it is being built. Without this the athlete is filling in reps
   * with no idea what is being recorded.
   */
  const [logged, setLogged] = useState(() =>
    workout.movements.map((m) => {
      const prior = byMovement.get(m.id);
      return {
        reps: prior?.reps != null ? String(prior.reps) : "",
        load: prior?.loadG != null ? formatLoad(prior.loadG, unit).replace(` ${unit}`, "") : "",
        seconds: prior?.seconds != null ? formatDuration(prior.seconds) : "",
        distance: prior?.distanceM != null ? String(prior.distanceM) : "",
      };
    }),
  );

  function update(index: number, field: keyof (typeof logged)[number], value: string) {
    setLogged((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  const derived = useMemo(() => {
    // Parsing here is deliberately forgiving: a half-typed "1:" is not an
    // error worth shouting about while somebody is still typing it. The
    // server parses strictly when it saves.
    const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);
    const clock = (v: string) => {
      const m = /^(?:(\d+):)?([0-5]?\d)(?:\.(\d))?$/.exec(v.trim());
      if (!m) return null;
      return Number(m[1] ?? 0) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
    };
    const weight = (v: string) => {
      const n = Number(v.trim());
      if (v.trim() === "" || !Number.isFinite(n) || n < 0) return null;
      return Math.round(n * (unit === "kg" ? 1000 : 453.59237));
    };

    const rows = logged.map((r) => ({
      reps: num(r.reps),
      loadG: weight(r.load),
      seconds: clock(r.seconds),
      distanceM: num(r.distance),
    }));
    const score = deriveScore(workout.format, workout.movements, rows);
    return score === null ? null : formatScore(score, unit);
  }, [logged, workout.format, workout.movements, unit]);

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
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">Result</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {derived ?? "—"}
            </p>
          </div>
          <p className="max-w-[55%] text-right text-xs opacity-60">{spec.hint}</p>
        </div>
        <p className="mt-3 text-xs opacity-60">
          Worked out from the movements below. Fill those in and this follows.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="RPE" hint="How hard it actually was, 1\u201310. Be honest.">
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
            {workout.movements.map((m, index) => {
              const prior = byMovement.get(m.id);
              const row = logged[index]!;
              const prescribed = [
                m.sets && m.reps ? `${m.sets} × ${m.reps}` : m.reps ? `${m.reps} reps` : null,
                m.loadG ? formatLoad(m.loadG, unit) : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <fieldset key={m.id} className="border-t border-black/10 pt-4 dark:border-white/10">
                  <legend className="text-sm font-medium">
                    {m.name}
                    {prescribed ? (
                      <span className="opacity-60"> · prescribed {prescribed}</span>
                    ) : null}
                  </legend>
                  {/* Controlled, so the result above keeps up as this is typed. */}
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Reps">
                      <input
                        name={`reps_${m.id}`}
                        inputMode="numeric"
                        value={row.reps}
                        onChange={(e) => update(index, "reps", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={`Load (${unit})`}>
                      <input
                        name={`load_${m.id}`}
                        inputMode="decimal"
                        value={row.load}
                        onChange={(e) => update(index, "load", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Time">
                      <input
                        name={`seconds_${m.id}`}
                        placeholder="1:30"
                        value={row.seconds}
                        onChange={(e) => update(index, "seconds", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Distance (m)">
                      <input
                        name={`distance_${m.id}`}
                        inputMode="numeric"
                        value={row.distance}
                        onChange={(e) => update(index, "distance", e.target.value)}
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
