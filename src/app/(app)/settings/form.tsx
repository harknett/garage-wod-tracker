"use client";

import { useActionState } from "react";

import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import type { Unit } from "@/lib/units";

import { updateProfile, type SettingsState } from "./actions";

export function ProfileForm({ name, unit }: { name: string; unit: Unit }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, {});

  return (
    <Card>
      <form action={action} className="space-y-4">
        <Field label="Name" hint="What goes on the board.">
          <input name="name" defaultValue={name} required className={inputClass} />
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
