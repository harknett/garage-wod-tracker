"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { nowIn } from "@/lib/dates";
import { TIME_ZONES, timeZoneLabel } from "@/lib/timezones";
import type { Unit } from "@/lib/units";
import { TRACKS, TRACK_SPECS, trackLength } from "@/lib/workout/tracks";
import type { Track } from "@/lib/workout/tracks";

import { updateProfile, type SettingsState } from "./actions";

/** A device's zone does not change under an open page; nothing to watch. */
const noSubscribe = () => () => {};

export function ProfileForm({
  name,
  unit,
  track,
  timeZone,
}: {
  name: string;
  unit: Unit;
  track: Track;
  timeZone: string;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, {});
  const [chosen, setChosen] = useState<Track>(track);
  const [zone, setZone] = useState(timeZone);

  // What the phone itself says. Null on the server, which has no idea where
  // the phone is, and read for real once hydrated.
  const deviceZone = useSyncExternalStore(
    noSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );

  // A zone saved from somewhere off the list still has to be selectable.
  const zones = TIME_ZONES.some((z) => z.id === zone)
    ? TIME_ZONES
    : [...TIME_ZONES, { id: zone, label: timeZoneLabel(zone) }];

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
          label="Time zone"
          // Shown as a clock rather than an offset: "it is 9:14 pm there" is
          // checkable at a glance, "UTC-4" is not. Only once hydrated, since a
          // clock rendered on the server can disagree with the browser's.
          hint={
            deviceZone
              ? `It is ${nowIn(zone)} there. Decides which day is today.`
              : "Decides which day is today."
          }
        >
          <select
            name="timeZone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={inputClass}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
          {deviceZone && deviceZone !== zone ? (
            <button
              type="button"
              onClick={() => setZone(deviceZone)}
              className="mt-2 min-h-11 text-sm underline"
            >
              Use this phone&apos;s zone: {timeZoneLabel(deviceZone)}
            </button>
          ) : null}
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
