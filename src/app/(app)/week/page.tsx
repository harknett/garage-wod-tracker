import Link from "next/link";

import { MoveWeek } from "@/components/move-week";
import { WorkoutCard } from "@/components/workout-card";
import { Card, Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import type { Plan } from "@/lib/db/types";
import { addDays, dayName, isValidDate, shortDate, today, weekStart } from "@/lib/dates";
import { PHASE_SPECS } from "@/lib/workout/phases";
import { TRACK_SPECS, trackLength } from "@/lib/workout/tracks";

import { AthletePicker } from "./athlete-picker";

export const metadata = { title: "Week - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; athlete?: string }>;
}) {
  const viewer = await requireUser();
  const params = await searchParams;
  const store = getStore();

  /*
    Whose week is on screen.

    An owner may look at anybody's programming; everyone else only ever sees
    their own, and an athlete id in the query string does nothing for them.
    Somebody else's week is shown read-only: the coach can see what is
    prescribed and what came back, but logging is the athlete's to do and the
    store would refuse it anyway.
  */
  const requested = params.athlete ? Number(params.athlete) : viewer.id;
  const subject =
    viewer.role === "owner" && Number.isInteger(requested)
      ? (store.findUser(requested) ?? viewer)
      : viewer;
  const isSelf = subject.id === viewer.id;
  // A coach may rearrange an athlete's week and drop sessions from it. Logging
  // stays with the athlete: it is theirs to record, and the store would refuse
  // it anyway.
  const canRearrange = isSelf || viewer.role === "owner";

  // An unparseable ?start= is a stale link or a typed URL, not an error worth
  // a page for; fall back to this week.
  const start =
    params.start && isValidDate(params.start) ? weekStart(params.start) : weekStart(today(subject.timeZone));
  const end = addDays(start, 6);

  const entries = store.entriesBetween(subject.id, start, end);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  // Each week written in one go, with its place in the group. Fetched once per
  // plan rather than per card.
  const plans = new Map<number, Plan & { sessions: number }>();
  for (const id of new Set(entries.map((e) => e.workout.planId).filter((id) => id !== null))) {
    const plan = store.findPlan(id);
    if (plan) plans.set(id, plan);
  }
  const positions = new Map<number, number>();
  for (const [planId] of plans) {
    const ofPlan = entries
      .filter((e) => e.workout.planId === planId)
      .sort((a, b) => a.assignment.date.localeCompare(b.assignment.date));
    ofPlan.forEach((e, i) => positions.set(e.assignment.id, i + 1));
  }

  const link = (from: string) =>
    isSelf ? `/week?start=${from}` : `/week?start=${from}&athlete=${subject.id}`;

  return (
    <>
      <PageTitle sub={`${shortDate(start)} – ${shortDate(end)}`}>
        {isSelf ? "Week" : `${subject.name}'s week`}
      </PageTitle>

      {viewer.role === "owner" ? (
        <AthletePicker
          athletes={store.listUsers().map((a) => ({ id: a.id, name: a.name }))}
          selected={subject.id}
          start={start}
          viewerId={viewer.id}
        />
      ) : null}

      {!isSelf ? (
        <p className="mb-4 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
          Looking at {subject.name}&rsquo;s programming. You can move and remove sessions;
          logging them stays with {subject.name}. Removing one deletes their result too.
        </p>
      ) : null}

      <nav className="mb-5 flex flex-wrap gap-2">
        <Link
          href={link(addDays(start, -7))}
          className="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          ← Previous
        </Link>
        <Link
          href={link(addDays(start, 7))}
          className="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Next →
        </Link>
        {/* For a block written into the wrong week: move all of it at once. */}
        {canRearrange && entries.length > 0 ? (
          <MoveWeek athleteId={subject.id} start={start} sessions={entries.length} />
        ) : null}
      </nav>

      {/* What the model was going for, once per week it wrote. */}
      {[...plans.values()].map((plan) => (
        <Card key={plan.id} className="mb-4 border-l-4 border-l-[#2a78d6]">
          <p className="text-xs font-medium uppercase tracking-wide text-[#2a78d6]">
            Written as one week
          </p>
          <p className="mt-1 text-sm opacity-60">
            {plan.sessions} session{plan.sessions === 1 ? "" : "s"}
            {plan.track ? ` · ${TRACK_SPECS[plan.track].label.toLowerCase()}, ${trackLength(plan.track)}` : ""}
            {plan.phase ? ` · ${PHASE_SPECS[plan.phase].label.toLowerCase()}` : ""}
          </p>
          {plan.summary ? <p className="mt-2 text-sm opacity-85">{plan.summary}</p> : null}
        </Card>
      ))}

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
                  {forDay.map((entry) => {
                    const plan = entry.workout.planId ? plans.get(entry.workout.planId) : undefined;
                    const at = positions.get(entry.assignment.id);
                    return (
                      <WorkoutCard
                        key={entry.assignment.id}
                        entry={entry}
                        unit={subject.unit}
                        canLog={isSelf}
                        canMove={canRearrange}
                        canRemove={canRearrange}
                        planLabel={
                          plan && at ? `Session ${at} of ${plan.sessions}` : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
