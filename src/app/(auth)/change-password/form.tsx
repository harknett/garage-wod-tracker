"use client";

import { useActionState } from "react";

import { changePassword, type FormState } from "../actions";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});

  return (
    <Card>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Own your password</h1>
      <p className="mb-5 text-sm opacity-70">
        {forced
          ? "You are still carrying a password somebody else chose. Replace it before you go further."
          : "Change it and every other device is signed out. No loose ends."}
      </p>

      <form action={action} className="space-y-4">
        <Field label="Current password">
          <input
            name="current"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <input
            name="next"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={inputClass}
          />
        </Field>
        <Field label="New password again">
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
        <Notice kind="error">{state.error}</Notice>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </Card>
  );
}
