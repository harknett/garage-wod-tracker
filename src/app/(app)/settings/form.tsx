"use client";

import { useActionState, useState } from "react";

import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import type { Unit } from "@/lib/units";
import { TRACKS, TRACK_SPECS, trackLength } from "@/lib/workout/tracks";
import type { Track } from "@/lib/workout/tracks";

import { updateProfile, type SettingsState } from "./actions";

export function ProfileForm({
  name,
  unit,
  track,
}: {
  name: string;
  unit: Unit;
  track: Track;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, {});
  const [chosen, setChosen] = useState<Track>(track);

  return (
    <Card>
      <form action={action} className="space-y-4">
        <Field label="Name" hint="What goes on the board.">
          <input name="name" defaultValue={name} required className={inputClass} />
        </Field>
        <Field label="The week you are taking on" hint={TRACK_SPECS[chosen].summary}>
          <select
            name="track"
            value={chosen}
            onChange={(e) => setChosen(e.target.value as Track)}
            className={inputClass}
          >
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {TRACK_SPECS[t].label} — {TRACK_SPECS[t].sessions}× {trackLength(t)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs opacity-60">
            Your call. It shapes the next week written for you; sessions already on the board
            keep the shape they were written as.
          </p>
        </Field>
        <Field
          label="Weights in"
          hint="Changes how loads are shown and read. Nothing already logged is altered."
        >
          <select name="unit" defaultValue={unit} className={inputClass}>
            <option value="kg">Kilograms</option>
            <option value="lb">Pounds</option>
          </select>
        </Field>
        <Notice kind="error">{state.error}</Notice>
        <Notice kind="ok">{state.ok}</Notice>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
