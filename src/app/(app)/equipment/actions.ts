"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { UnitParseError, parseLoad } from "@/lib/units";

export interface EquipmentState {
  error?: string;
  ok?: string;
}

export async function addEquipment(
  _prev: EquipmentState,
  data: FormData,
): Promise<EquipmentState> {
  const owner = await requireOwner();
  const store = getStore();

  const name = String(data.get("name") ?? "").trim();
  if (!name) return { error: "Name the kit." };

  try {
    const maxRaw = String(data.get("maxLoad") ?? "").trim();
    store.saveEquipment({
      name,
      detail: String(data.get("detail") ?? ""),
      // Entered in the owner's unit, stored in grams like every other load.
      maxLoadG: maxRaw === "" ? null : parseLoad(maxRaw, owner.unit),
      available: true,
    });
  } catch (err) {
    if (err instanceof UnitParseError) return { error: err.message };
    throw err;
  }

  revalidatePath("/equipment");
  return { ok: `${name} is on the list.` };
}

export async function toggleEquipment(
  _prev: EquipmentState,
  data: FormData,
): Promise<EquipmentState> {
  await requireOwner();
  const id = Number(data.get("id"));
  const available = data.get("available") === "1";

  getStore().setEquipmentAvailable(id, available);
  revalidatePath("/equipment");
  return {
    ok: available ? "Back in the rotation." : "Out of action. It will not be programmed.",
  };
}

export async function removeEquipment(
  _prev: EquipmentState,
  data: FormData,
): Promise<EquipmentState> {
  await requireOwner();
  getStore().deleteEquipment(Number(data.get("id")));
  revalidatePath("/equipment");
  return { ok: "Off the list." };
}
