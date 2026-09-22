"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { isUnit } from "@/lib/units";

export interface SettingsState {
  error?: string;
  ok?: string;
}

export async function updateProfile(
  _prev: SettingsState,
  data: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const name = String(data.get("name") ?? "").trim();
  const unit = String(data.get("unit") ?? "");

  if (!name) return { error: "A name is needed." };
  if (!isUnit(unit)) return { error: "Pick kilograms or pounds." };

  const store = getStore();
  store.setName(user.id, name);
  // Changing the unit re-renders every stored gram; nothing is converted or
  // rewritten, which is the whole reason loads are stored in one unit.
  store.setUnit(user.id, unit);

  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
