"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Card, Field, Notice, PageTitle, inputClass } from "@/components/ui";
import type { FullWorkout, MovementResult, Result } from "@/lib/db/types";
import type { Unit } from "@/lib/units";
import { formatDuration, formatLoad } from "@/lib/units";
import { deriveScore } from "@/lib/workout/derive";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { prescription } from "@/lib/workout/prescription";
import { formatScore } from "@/lib/workout/score";

import { saveProgress, saveResult, type LogState } from "./actions";

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
  const router = useRouter();
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

  /*
    Save as you go.

    A workout is logged between rounds, not written up afterwards, so anything
    typed is committed without a button: shortly after it stops changing, the
    moment the athlete leaves the box, and when the phone is locked or the app
    is backgrounded. The last two matter most — the natural thing to do after
    typing a set is to put the phone down, and a debounce alone would lose it.

    The whole form is posted each time — the result row is an upsert keyed on
    the assignment — which keeps the autosave and the finish reading exactly
    the same shape. Server actions run one at a time, so saves land in the
    order they were made.
  */
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(0);
  // Once the finish is submitted nothing else should be sent. MAX(completed)
  // already stops a late draft reopening the session; this stops it racing.
  const finishing = useRef(false);
  const [progress, setProgress] = useState<{ saving: boolean; savedAt?: number; error?: string }>({
    saving: false,
  });

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const form = formRef.current;
    if (!form || finishing.current) return;

    inFlight.current += 1;
    setProgress((p) => ({ ...p, saving: true }));
    // Built from the form element rather than from state, so the fields that
    // are not controlled — RPE, scaled, the notes — go with it.
    const res = await saveProgress({}, new FormData(form));
    inFlight.current -= 1;
    setProgress((p) => ({
      saving: inFlight.current > 0 || timer.current !== null,
      savedAt: res.savedAt ?? p.savedAt,
      error: res.error,
    }));
  }, []);

  /** Save soon: debounced, because the alternative is a write per keystroke. */
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setProgress((p) => ({ ...p, saving: true }));
    timer.current = setTimeout(save, 900);
  }, [save]);

  /** Save now, if anything is waiting. */
  const flush = useCallback(async () => {
    if (timer.current) await save();
  }, [save]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  /*
    Opening the screen is starting the session.

    An empty draft is written straight away, so the session reads as in
    progress everywhere else from the first minute — and a null score is
    exactly "started, nothing recorded yet". Done here rather than in the page,
    because a server render that writes would fire on a prefetch. The ref
    keeps a development double-mount to one write.
  */
  const started = useRef(existing !== null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void save();
  }, [save]);

  const savedNote = progress.error
    ? progress.error
    : progress.saving
      ? "Saving\u2026"
      : progress.savedAt
        ? "Saved"
        : existing
          ? "Picked up where you left off"
          : "Started. Saves as you go";

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
    // Input anywhere in the form schedules a save and leaving any box saves at
    // once — one pair of handlers instead of remembering to wire every field.
    <form
      ref={formRef}
      action={action}
      onInput={schedule}
      onBlur={() => void flush()}
      onSubmit={() => {
        finishing.current = true;
        if (timer.current) clearTimeout(timer.current);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />

      <PageTitle sub={`${date} · ${spec.label}${workout.capSeconds ? ` · ${formatDuration(workout.capSeconds)} cap` : ""}`}>
        {workout.title}
      </PageTitle>

      {/* Pinned, so the running result and whether it is safe to put the
          phone down stay in view however far down the movements you are. */}
      <div
        role="status"
        className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-black/10 bg-chalk/95 px-4 py-2 text-sm backdrop-blur dark:border-white/10 dark:bg-iron/95"
      >
        <span className="font-semibold tabular-nums">{derived ?? "\u2014"}</span>
        <span
          className={
            progress.error ? "text-xs font-medium text-rust dark:text-orange-300" : "text-xs opacity-70"
          }
        >
          {savedNote}
        </span>
      </div>

      {workout.description ? (
        <Card>
          <p className="whitespace-pre-line text-sm opacity-80">{workout.description}</p>
        </Card>
      ) : null}


      {workout.movements.length > 0 ? (
        <Card>
          <h2 className="mb-1 font-semibold">The work</h2>
          <p className="mb-4 text-xs opacity-60">
            What was written, then what you actually did. Blank means not recorded.
          </p>
          <div className="space-y-5">
            {workout.movements.map((m, index) => {
              const prior = byMovement.get(m.id);
              const row = logged[index]!;
              const prescribed = prescription(m, unit);

              return (
                <fieldset key={m.id} className="border-t border-black/10 pt-4 dark:border-white/10">
                  {/* The movement as written sits directly above its boxes, so
                      the prescription is in view while the set is logged. */}
                  <legend className="font-semibold">
                    <span className="opacity-50 tabular-nums">{index + 1}. </span>
                    {m.name}
                  </legend>
                  {prescribed ? <p className="mt-1 text-sm tabular-nums">{prescribed}</p> : null}
                  {m.notes ? (
                    <p className="mt-1 whitespace-pre-line text-sm opacity-70">{m.notes}</p>
                  ) : null}
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
          Worked out from the movements above, as you fill them in.
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
          {pending ? "Finishing…" : existing?.completed ? "Save changes" : "Finish session"}
        </Button>
        <Link
          href="/"
          onClick={async (e) => {
            // Nothing to press to keep the work: leaving saves whatever was
            // still waiting on the debounce before it goes.
            if (!timer.current) return;
            e.preventDefault();
            await flush();
            router.push("/");
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/15 px-4 dark:border-white/20"
        >
          {/* Not "cancel", and not a save: the work is already kept. */}
          Back later
        </Link>
      </div>
    </form>
  );
}
