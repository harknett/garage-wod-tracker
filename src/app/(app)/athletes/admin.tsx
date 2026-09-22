"use client";

import { useActionState } from "react";

import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import type { Role } from "@/lib/db/types";
import type { Unit } from "@/lib/units";

import { addAthlete, removeAthlete, resetPassword, type AthleteState } from "./actions";

interface Row {
  id: number;
  name: string;
  email: string;
  role: Role;
  unit: Unit;
  mustChangePassword: boolean;
}

/** The one-time password, shown where it cannot be missed. */
function TemporaryPassword({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-lime/40 bg-lime/10 p-3">
      <p className="text-xs font-medium uppercase tracking-wide">Temporary password</p>
      <p className="mt-1 font-mono text-lg tracking-wider">{value}</p>
      <p className="mt-1 text-xs opacity-70">
        Shown once. Hand it over in person. They replace it the moment they sign in.
      </p>
    </div>
  );
}

export function AthleteAdmin({ ownerId, athletes }: { ownerId: number; athletes: Row[] }) {
  const [addState, add, adding] = useActionState<AthleteState, FormData>(addAthlete, {});
  const [resetState, reset] = useActionState<AthleteState, FormData>(resetPassword, {});
  const [removeState, remove] = useActionState<AthleteState, FormData>(removeAthlete, {});

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-semibold">Add an athlete</h2>
        <form action={add} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Weights in">
              <select name="unit" defaultValue="kg" className={inputClass}>
                <option value="kg">Kilograms</option>
                <option value="lb">Pounds</option>
              </select>
            </Field>
            <Field label="Role" hint="Owners can write workouts and manage accounts.">
              <select name="role" defaultValue="member" className={inputClass}>
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
          </div>
          <Notice kind="error">{addState.error}</Notice>
          <Notice kind="ok">{addState.ok}</Notice>
          <TemporaryPassword value={addState.password} />
          <Button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add athlete"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Everyone</h2>
        <Notice kind="error">{resetState.error ?? removeState.error}</Notice>
        <Notice kind="ok">{resetState.ok ?? removeState.ok}</Notice>
        <div className="mt-2">
          <TemporaryPassword value={resetState.password} />
        </div>

        <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
          {athletes.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.name}
                  {a.role === "owner" ? (
                    <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-xs font-normal dark:bg-white/15">
                      owner
                    </span>
                  ) : null}
                  {a.mustChangePassword ? (
                    <span className="ml-2 rounded bg-rust/15 px-1.5 py-0.5 text-xs font-normal text-rust dark:text-orange-300">
                      password not yet chosen
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs opacity-60">
                  {a.email} · {a.unit}
                </p>
              </div>

              <form action={reset}>
                <input type="hidden" name="id" value={a.id} />
                <Button variant="quiet" type="submit" className="text-sm">
                  Reset password
                </Button>
              </form>

              {a.id === ownerId ? null : (
                <form action={remove}>
                  <input type="hidden" name="id" value={a.id} />
                  <Button variant="danger" type="submit" className="text-sm">
                    Remove
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
