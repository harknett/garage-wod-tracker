"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { isValidDate } from "@/lib/dates";

export interface MoveState {
  error?: string;
}

/**
 * Move a session to another day.
 *
 * An athlete may move their own training; the ownership check lives in the
 * store, so a posted assignment id belonging to somebody else fails there
 * rather than depending on this action remembering to look.
 */
export async function moveWorkout(_prev: MoveState, data: FormData): Promise<MoveState> {
  const user = await requireUser();

  const id = Number(data.get("assignmentId"));
  const date = String(data.get("date") ?? "");
  if (!Number.isInteger(id)) return { error: "That is not a session." };
  if (!isValidDate(date)) return { error: "Pick a date." };

  const moved = getStore().moveAssignment(id, user.id, date);
  if (!moved) return { error: "That workout is already on that day." };

  revalidatePath("/");
  revalidatePath("/week");
  return {};
}
