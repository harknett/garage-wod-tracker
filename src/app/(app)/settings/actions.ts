"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { isTimeZone } from "@/lib/timezones";
import { isUnit } from "@/lib/units";
import { isTrack } from "@/lib/workout/tracks";

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
  const track = String(data.get("track") ?? "");
  const timeZone = String(data.get("timeZone") ?? "");

  if (!name) return { error: "A name is needed." };
  if (!isUnit(unit)) return { error: "Pick kilograms or pounds." };
  if (!isTrack(track)) return { error: "Pick a track." };
  if (!isTimeZone(timeZone)) return { error: "Pick a time zone from the list." };

  const store = getStore();
  store.setName(user.id, name);
  // Changing the unit re-renders every stored gram; nothing is converted or
  // rewritten, which is the whole reason loads are stored in one unit.
  store.setUnit(user.id, unit);
  // The athlete's own choice: how often they intend to train, and for how
  // long. It shapes the next week written for them, not the ones already up.
  store.setTrack(user.id, track);
  // Decides which day "today" is. Stored dates do not move with it.
  store.setTimeZone(user.id, timeZone);

  revalidatePath("/", "layout");
  revalidatePath("/build");
  return { ok: "Saved. It shapes the next week written for you." };
}
