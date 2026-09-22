import Link from "next/link";

import { signOut } from "../../(auth)/actions";
import { Card, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { PHASE_SPECS } from "@/lib/workout/phases";

import { ProfileForm } from "./form";

export const metadata = { title: "You - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageTitle sub={user.email}>You</PageTitle>

      <Card className="mb-4">
        <h2 className="font-semibold">{PHASE_SPECS[user.phase].label}</h2>
        <p className="mt-1 text-sm opacity-80">{PHASE_SPECS[user.phase].summary}</p>
        {/* Read-only on purpose: the phase is a coaching decision, and an
            athlete who can flip themselves into Building on a bad week is an
            athlete with no phase at all. */}
        <p className="mt-3 text-xs opacity-60">
          Your coach sets this. It decides how every week is written for you.
        </p>
      </Card>

      <ProfileForm name={user.name} unit={user.unit} />

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">Account</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/change-password"
            className="inline-flex min-h-11 items-center rounded-lg border border-black/15 px-4 text-sm dark:border-white/20"
          >
            Change password
          </Link>
          <form action={signOut}>
            <button className="inline-flex min-h-11 items-center rounded-lg border border-black/15 px-4 text-sm dark:border-white/20">
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs opacity-60">
          You are {user.role === "owner" ? "the owner of this gym" : "a member of this gym"}.
        </p>
      </Card>
    </>
  );
}
