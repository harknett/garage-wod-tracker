import { PageTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";

import { AthleteAdmin } from "./admin";

export const metadata = { title: "Athletes - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function AthletesPage() {
  const owner = await requireOwner();
  const athletes = getStore().listUsers();

  return (
    <>
      <PageTitle sub="Everyone who shows up.">Athletes</PageTitle>
      <AthleteAdmin
        ownerId={owner.id}
        athletes={athletes.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          unit: a.unit,
          phase: a.phase,
          mustChangePassword: a.mustChangePassword,
        }))}
      />
    </>
  );
}
