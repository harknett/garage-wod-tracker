"use client";

import { useActionState, useState } from "react";

import { removeWorkout, type RemoveState } from "@/app/(app)/week/actions";

/**
 * Take a session off your week.
 *
 * Two steps, always. Removing an assignment cascades to its logged result, so
 * this is the only control in the app that can destroy training you have
 * already done — and on a phone the button sits a thumb's width from "Log it".
 * The second step names what is actually at stake rather than asking a generic
 * "are you sure".
 */
export function RemoveWorkout({
  assignmentId,
  hasResult,
}: {
  assignmentId: number;
  /** Whether a result would go with it, which changes what the warning says. */
  hasResult: boolean;
}) {
  const [state, action, pending] = useActionState<RemoveState, FormData>(removeWorkout, {});
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="min-h-11 rounded-lg px-3 text-sm opacity-60 hover:opacity-100"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <span className="text-xs text-rust dark:text-orange-300">
        {hasResult ? "This deletes the result too." : "Take it off the week?"}
      </span>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-rust px-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Removing…" : "Yes, remove"}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-11 rounded-lg px-3 text-sm opacity-60 hover:opacity-100"
      >
        Keep
      </button>
      {state.error ? (
        <span role="status" className="text-xs text-rust dark:text-orange-300">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
