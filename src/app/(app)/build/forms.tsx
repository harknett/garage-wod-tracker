"use client";

import { useActionState, useState } from "react";

import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import type { Unit } from "@/lib/units";
import { FORMATS, FORMAT_SPECS } from "@/lib/workout/formats";
import { PHASES, PHASE_SPECS } from "@/lib/workout/phases";
import type { Phase } from "@/lib/workout/phases";

import { createManual, generate, type BuildState } from "./actions";

interface Athlete {
  id: number;
  name: string;
  phase: Phase;
}

/** Spare movement rows, so adding a movement needs no JavaScript round-trip. */
const MOVEMENT_ROWS = 8;

export function BuildForms(props: {
  athletes: Athlete[];
  defaultAthleteId: number;
  weekStart: string;
  today: string;
  unit: Unit;
  aiReady: boolean;
}) {
  const [tab, setTab] = useState<"ai" | "manual">(props.aiReady ? "ai" : "manual");

  return (
    <>
      <div className="mb-5 flex gap-2">
        <Button variant={tab === "ai" ? "primary" : "quiet"} onClick={() => setTab("ai")}>
          Write a week
        </Button>
        <Button variant={tab === "manual" ? "primary" : "quiet"} onClick={() => setTab("manual")}>
          One workout
        </Button>
      </div>
      {tab === "ai" ? <AiForm {...props} /> : <ManualForm {...props} />}
    </>
  );
}

function AiForm({
  athletes,
  defaultAthleteId,
  weekStart,
  aiReady,
}: {
  athletes: Athlete[];
  defaultAthleteId: number;
  weekStart: string;
  aiReady: boolean;
}) {
  const [state, action, pending] = useActionState<BuildState, FormData>(generate, {});
  // Tracked in state so changing the athlete moves the phase with them; the
  // coach can still override it for this one week.
  const [athleteId, setAthleteId] = useState(defaultAthleteId);
  const [phase, setPhase] = useState<Phase>(
    athletes.find((a) => a.id === defaultAthleteId)?.phase ?? "ramping",
  );

  function chooseAthlete(id: number) {
    setAthleteId(id);
    const next = athletes.find((a) => a.id === id)?.phase;
    if (next) setPhase(next);
  }

  return (
    <Card>
      {!aiReady ? (
        <div className="mb-4">
          <Notice kind="error">
            No ANTHROPIC_API_KEY on the server, so generation is off. Write the week by hand.
          </Notice>
        </div>
      ) : null}

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="For">
            <select
              name="athleteId"
              value={athleteId}
              onChange={(e) => chooseAthlete(Number(e.target.value))}
              className={inputClass}
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Week beginning" hint="Snapped to the Monday.">
            <input name="start" type="date" defaultValue={weekStart} className={inputClass} />
          </Field>
          <Field label="Training days">
            <input
              name="days"
              type="number"
              min={1}
              max={7}
              defaultValue={4}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Phase" hint={PHASE_SPECS[phase].summary}>
          <select
            name="phase"
            value={phase}
            onChange={(e) => setPhase(e.target.value as Phase)}
            className={inputClass}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_SPECS[p].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs opacity-60">
            Their standing phase. Change it here to write one week differently without moving
            them — move them for good on Athletes.
          </p>
        </Field>

        <Field
          label="Brief"
          hint="Injuries, time, anything to work around. It already has their last eight weeks and the kit list."
        >
          <textarea
            name="prompt"
            rows={4}
            placeholder="Rower and a barbell only. Left shoulder is cranky overhead. Keep one long easy day."
            className={`${inputClass} py-2`}
          />
        </Field>

        <Notice kind="error">{state.error}</Notice>
        <Notice kind="ok">{state.ok}</Notice>
        {state.summary ? (
          <p className="rounded-lg border border-black/10 bg-black/5 p-3 text-sm dark:border-white/10 dark:bg-white/5">
            {state.summary}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || !aiReady}>
          {/* Writing a week is a slow call; saying so stops a second submit. */}
          {pending ? "Working… give it a minute" : "Write the week"}
        </Button>
      </form>
    </Card>
  );
}

function ManualForm({
  athletes,
  today,
  unit,
}: {
  athletes: Athlete[];
  today: string;
  unit: Unit;
}) {
  const [state, action, pending] = useActionState<BuildState, FormData>(createManual, {});
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("for_time");
  const spec = FORMAT_SPECS[format];

  return (
    <Card>
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input name="title" required placeholder="Pull strength + engine" className={inputClass} />
          </Field>
          <Field label="Date">
            <input name="date" type="date" defaultValue={today} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Format" hint={spec.hint}>
            <select
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className={inputClass}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_SPECS[f].label}
                </option>
              ))}
            </select>
          </Field>
          {/* A cap box on a format with no cap is just a way to record a lie. */}
          {spec.capped ? (
            <Field label="Time cap" hint="Minutes and seconds, like 20:00.">
              <input name="cap" placeholder="20:00" className={inputClass} />
            </Field>
          ) : null}
        </div>

        <Field label="Athletes">
          <div className="grid gap-2 sm:grid-cols-3">
            {athletes.map((a) => (
              <label key={a.id} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="athletes" value={a.id} className="size-5" />
                <span className="text-sm">{a.name}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Phase" hint="What this session is for. Leave as none for a one-off.">
          <select name="phase" defaultValue="" className={inputClass}>
            <option value="">No phase</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_SPECS[p].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" hint="Warm-up, standards, cool-down.">
          <textarea name="description" rows={3} className={`${inputClass} py-2`} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Movements</legend>
          <div className="space-y-2">
            {Array.from({ length: MOVEMENT_ROWS }, (_, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <input name="m_name" placeholder="Movement" className={`${inputClass} sm:col-span-2`} />
                <input name="m_sets" inputMode="numeric" placeholder="Sets" className={inputClass} />
                <input name="m_reps" inputMode="numeric" placeholder="Reps" className={inputClass} />
                <input name="m_load" inputMode="decimal" placeholder={unit} className={inputClass} />
                <input name="m_notes" placeholder="Notes / scaling" className={`${inputClass} sm:col-span-5`} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs opacity-60">Leave a row blank to skip it.</p>
        </fieldset>

        <Notice kind="error">{state.error}</Notice>
        <Notice kind="ok">{state.ok}</Notice>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Put it on the board"}
        </Button>
      </form>
    </Card>
  );
}
