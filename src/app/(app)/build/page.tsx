import { PageTitle } from "@/components/ui";
import { isConfigured } from "@/lib/ai/generate";
import { requireOwner } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { today, weekStart } from "@/lib/dates";

import { BuildForms } from "./forms";

export const metadata = { title: "Build - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const owner = await requireOwner();
  const athletes = getStore().listUsers();

  return (
    <>
      <PageTitle sub="Write the week. Then go do it.">Build</PageTitle>
      <BuildForms
        athletes={athletes.map((a) => ({ id: a.id, name: a.name, phase: a.phase }))}
        defaultAthleteId={owner.id}
        weekStart={weekStart(today())}
        today={today()}
        unit={owner.unit}
        aiReady={isConfigured()}
      />
    </>
  );
}
