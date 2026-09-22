"use client";

import { useActionState } from "react";

import { claimOwner, type FormState } from "../actions";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

export function SetupForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(claimOwner, {});

  if (!configured) {
    return (
      <Card>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Setup is shut</h1>
        <p className="text-sm opacity-70">
          No <code>SETUP_TOKEN</code> is set on the server, so the first account cannot be
          claimed. Set one temporarily, create your account, then remove it — see{" "}
          <code>deploy/README.md</code>.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Take command</h1>
      <p className="mb-5 text-sm opacity-70">
        The first account owns this place. It writes the training and answers for it.
      </p>

      <form action={action} className="space-y-4">
        <Field label="Setup token" hint="The value of SETUP_TOKEN on the server.">
          <input name="token" type="password" required autoFocus className={inputClass} />
        </Field>
        <Field label="Your name">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required className={inputClass} />
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={inputClass}
          />
        </Field>
        <Field label="Weights in" hint="You can change this later, and each athlete picks their own.">
          <select name="unit" defaultValue="kg" className={inputClass}>
            <option value="kg">Kilograms</option>
            <option value="lb">Pounds</option>
          </select>
        </Field>
        <Notice kind="error">{state.error}</Notice>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create owner account"}
        </Button>
      </form>
    </Card>
  );
}
