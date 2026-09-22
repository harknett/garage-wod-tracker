import Link from "next/link";

import { WorkoutCard } from "@/components/workout-card";
import { Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { addDays, dayName, isValidDate, shortDate, today, weekStart } from "@/lib/dates";

export const metadata = { title: "Week - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  // An unparseable ?start= is a stale link or a typed URL, not an error worth
  // a page for; fall back to this week.
  const start =
    params.start && isValidDate(params.start) ? weekStart(params.start) : weekStart(today());
  const end = addDays(start, 6);

  const entries = getStore().entriesBetween(user.id, start, end);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <>
      <PageTitle sub={`${shortDate(start)} – ${shortDate(end)}`}>Week</PageTitle>

      <nav className="mb-5 flex gap-2">
        <Link
          href={`/week?start=${addDays(start, -7)}`}
          className="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          ← Previous
        </Link>
        <Link
          href={`/week?start=${addDays(start, 7)}`}
          className="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Next →
        </Link>
      </nav>

      <div className="space-y-6">
        {days.map((date) => {
          const forDay = entries.filter((e) => e.assignment.date === date);
          return (
            <section key={date}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">
                {dayName(date)} · {shortDate(date)}
              </h2>
              {forDay.length === 0 ? (
                <Empty>Rest. Earn the next one.</Empty>
              ) : (
                <div className="space-y-3">
                  {forDay.map((entry) => (
                    <WorkoutCard key={entry.assignment.id} entry={entry} unit={user.unit} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
