"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/guard";
import {
  generateTemporaryPassword,
  hashPassword,
} from "@/lib/auth/password";
import { getStore } from "@/lib/db";
import { isUnit } from "@/lib/units";

export interface AthleteState {
  error?: string;
  ok?: string;
  /**
   * The temporary password, shown once.
   *
   * It is never stored in readable form and never emailed - the owner reads it
   * out or writes it down, and the account is forced to replace it at first
   * sign-in. Showing it once is the only moment it exists.
   */
  password?: string;
}

export async function addAthlete(_prev: AthleteState, data: FormData): Promise<AthleteState> {
  await requireOwner();
  const store = getStore();

  const name = String(data.get("name") ?? "").trim();
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const unit = String(data.get("unit") ?? "kg");
  const role = data.get("role") === "owner" ? "owner" : "member";

  if (!name || !email) return { error: "A name and an email are needed." };
  if (!isUnit(unit)) return { error: "Pick kilograms or pounds." };
  if (store.findUserByEmail(email)) return { error: "That email already has an account." };

  const temporary = generateTemporaryPassword();
  store.createUser({
    email,
    name,
    passwordHash: await hashPassword(temporary),
    role,
    unit,
    mustChangePassword: true,
  });

  revalidatePath("/athletes");
  return { ok: `${name} can sign in with ${email}.`, password: temporary };
}

export async function resetPassword(_prev: AthleteState, data: FormData): Promise<AthleteState> {
  await requireOwner();
  const store = getStore();

  const id = Number(data.get("id"));
  const athlete = store.findUser(id);
  if (!athlete) return { error: "No such athlete." };

  const temporary = generateTemporaryPassword();
  store.setPassword(id, await hashPassword(temporary), true);
  // A reset password means the old one is no longer trusted, so every session
  // it opened goes too.
  store.deleteUserSessions(id);

  revalidatePath("/athletes");
  return { ok: `New password for ${athlete.name}.`, password: temporary };
}

export async function removeAthlete(_prev: AthleteState, data: FormData): Promise<AthleteState> {
  const owner = await requireOwner();
  const store = getStore();

  const id = Number(data.get("id"));
  if (id === owner.id) return { error: "You cannot remove your own account." };

  const athlete = store.findUser(id);
  if (!athlete) return { error: "No such athlete." };
  // Deleting cascades through assignments and results. Losing the last owner
  // would leave a gym nobody can program for.
  if (athlete.role === "owner" && store.listUsers().filter((u) => u.role === "owner").length <= 1) {
    return { error: "That is the only owner. Make somebody else an owner first." };
  }

  store.deleteUser(id);
  revalidatePath("/athletes");
  return { ok: `${athlete.name} removed, along with their training history.` };
}
