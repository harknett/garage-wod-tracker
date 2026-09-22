import Link from "next/link";

import { signOut } from "../../(auth)/actions";
import { Card, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";

import { ProfileForm } from "./form";

export const metadata = { title: "You - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageTitle sub={user.email}>You</PageTitle>

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
