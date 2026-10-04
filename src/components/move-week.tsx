"use client";

import { useActionState, useState } from "react";

import { moveWeek, type MoveWeekState } from "@/app/(app)/week/actions";
import { addDays, shortDate, weekStart } from "@/lib/dates";

/**
 * Move every session in the week on screen to another week.
 *
 * For a block written into the wrong week. Two steps, like removing: pick a
 * date, then confirm with the move spelled out, because shifting a whole week
 * by mistake is tedious to undo even though nothing is lost.
 */
export function MoveWeek({
  athleteId,
  start,
  sessions,
}: {
  athleteId: number;
  start: string;
  sessions: number;
}) {
  const [state, action, pending] = useActionState<MoveWeekState, FormData>(moveWeek, {});
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const target = to ? weekStart(to) : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/20"
      >
        Move this week
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full space-y-3 rounded-xl border border-black/10 bg-white/70 p-4 text-sm dark:border-white/10 dark:bg-slate/60"
    >
      <input type="hidden" name="athleteId" value={athleteId} />
      <input type="hidden" name="from" value={start} />
      <label className="block">
        <span className="mb-1 block font-medium">Move all {sessions} session{sessions === 1 ? "" : "s"} to the week of</span>
        <input
          name="to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-h-11 rounded-lg border border-black/15 bg-white px-3 dark:border-white/20 dark:bg-iron dark:text-chalk"
        />
        <span className="mt-1 block text-xs opacity-60">
          Any day in that week. Each session keeps its weekday; anything already there stays put. Results move with
          their sessions.
        </span>
      </label>
      {target && target !== start ? (
        <p>
          Sessions go to {shortDate(target)} – {shortDate(addDays(target, 6))}.
        </p>
      ) : null}
      {target === start ? <p className="opacity-60">That is this week.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !target || target === start}
          className="min-h-11 rounded-lg bg-iron px-4 font-medium text-chalk disabled:opacity-50 dark:bg-chalk dark:text-iron"
        >
          {pending ? "Moving…" : "Move the week"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-lg px-3 opacity-60 hover:opacity-100"
        >
          Cancel
        </button>
      </div>
      {state.error ? (
        <p role="status" className="text-rust dark:text-orange-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

