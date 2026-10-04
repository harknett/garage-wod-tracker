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
  const store = getStore();
  const athletes = store.listUsers();

  return (
    <>
      <PageTitle sub="Write the week. Then go do it.">Build</PageTitle>
      <BuildForms
        athletes={athletes.map((a) => ({
          id: a.id,
          name: a.name,
          phase: a.phase,
          track: a.track,
          // The first week with nothing on it, counted in the athlete's own
          // calendar: writing the next block almost always means the next
          // empty week, not another one on top of this one.
          openWeek: store.firstOpenWeek(a.id, weekStart(today(a.timeZone))),
        }))}
        defaultAthleteId={owner.id}
        // The owner's calendar: they are the one choosing the dates.
        today={today(owner.timeZone)}
        unit={owner.unit}
        aiReady={isConfigured()}
      />
    </>
  );
}
