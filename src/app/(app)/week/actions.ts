"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { isValidDate, weekStart } from "@/lib/dates";

export interface MoveState {
  error?: string;
}

/**
 * Move a session to another day.
 *
 * An athlete may move their own training, and an owner may rearrange anyone's.
 * The rule lives in the store, so a posted assignment id is checked against
 * the actor there rather than depending on this action remembering to look.
 */
export async function moveWorkout(_prev: MoveState, data: FormData): Promise<MoveState> {
  const user = await requireUser();

  const id = Number(data.get("assignmentId"));
  const date = String(data.get("date") ?? "");
  if (!Number.isInteger(id)) return { error: "That is not a session." };
  if (!isValidDate(date)) return { error: "Pick a date." };

  const moved = getStore().moveAssignment(id, date, { id: user.id, role: user.role });
  if (!moved) return { error: "That workout is already on that day, or is not yours to move." };

  revalidatePath("/");
  revalidatePath("/week");
  return {};
}

export interface RemoveState {
  error?: string;
  ok?: string;
}

/**
 * Take a session out of a week.
 *
 * An athlete may drop their own; an owner may drop anybody's. This is the one
 * action in the app that destroys training history — results are keyed on the
 * assignment and cascade with it — so the screen asks twice before calling it,
 * and the rule lives in the store rather than depending on this action
 * remembering to look.
 */
export async function removeWorkout(
  _prev: RemoveState,
  data: FormData,
): Promise<RemoveState> {
  const user = await requireUser();

  const id = Number(data.get("assignmentId"));
  if (!Number.isInteger(id)) return { error: "That is not a session." };

  if (!getStore().deleteAssignment(id, { id: user.id, role: user.role })) {
    return { error: "That session is not yours to remove, or is already gone." };
  }

  revalidatePath("/");
  revalidatePath("/week");
  return { ok: "Removed." };
}

export interface MoveWeekState {
  error?: string;
}

/**
 * Move a whole week of sessions to another week.
 *
 * The target is snapped to the Sunday it falls in, so any date in the week
 * will do. On success it goes to the target week, which is where the person
 * wants to look next — and the empty week they were on would only make them
 * wonder whether it worked.
 */
export async function moveWeek(_prev: MoveWeekState, data: FormData): Promise<MoveWeekState> {
  const user = await requireUser();

  const athleteId = Number(data.get("athleteId"));
  const from = String(data.get("from") ?? "");
  const to = String(data.get("to") ?? "");
  if (!Number.isInteger(athleteId)) return { error: "Whose week is this?" };
  if (!isValidDate(from) || !isValidDate(to)) return { error: "Pick a date in the week to move it to." };

  const target = weekStart(to);
  const result = getStore().moveWeek(athleteId, weekStart(from), target, { id: user.id, role: user.role });
  if ("error" in result) return { error: result.error };

  revalidatePath("/");
  revalidatePath("/week");
  redirect(athleteId === user.id ? `/week?start=${target}` : `/week?start=${target}&athlete=${athleteId}`);
}
