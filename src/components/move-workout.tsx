"use client";

import { useActionState } from "react";

import { moveWorkout, type MoveState } from "@/app/(app)/week/actions";

/**
 * Move one session to another date.
 *
 * A date field rather than arrows, so a workout can be pushed to next week
 * without tapping through the days between. It submits on change: picking a
 * date is the whole decision, and a separate confirm button is one more thing
 * to forget on a phone.
 */
export function MoveWorkout({
  assignmentId,
  date,
}: {
  assignmentId: number;
  date: string;
}) {
  const [state, action] = useActionState<MoveState, FormData>(moveWorkout, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="text-xs opacity-60" htmlFor={`move-${assignmentId}`}>
        Move to
      </label>
      <input
        id={`move-${assignmentId}`}
        name="date"
        type="date"
        defaultValue={date}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-11 rounded-lg border border-black/15 bg-white px-3 text-sm dark:border-white/20 dark:bg-iron dark:text-chalk"
      />
      {state.error ? (
        <span role="status" className="text-xs text-rust dark:text-orange-300">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
