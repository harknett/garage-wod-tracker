import Link from "next/link";

import { WorkoutCard } from "@/components/workout-card";
import { Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { shortDate, today } from "@/lib/dates";

export const metadata = { title: "Today - Garage WOD Tracker" };

// A training log is different on every request and per athlete; there is
// nothing here worth caching between them.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const date = today();
  const entries = getStore().entriesBetween(user.id, date, date);

  return (
    <>
      <PageTitle sub={shortDate(date)}>Today</PageTitle>

      {entries.length === 0 ? (
        <Empty>
          Nothing programmed today. That was a decision somebody made.{" "}
          {user.role === "owner" ? (
            <Link href="/build" className="underline">
              Write the week
            </Link>
          ) : (
            "Get on your coach about it."
          )}
        </Empty>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <WorkoutCard key={entry.assignment.id} entry={entry} unit={user.unit} />
          ))}
        </div>
      )}
    </>
  );
}
