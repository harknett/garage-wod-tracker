import { Card, Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { shortDate } from "@/lib/dates";
import { FORMAT_SPECS, compareScores } from "@/lib/workout/formats";
import { formatScore, scoreFromValue } from "@/lib/workout/score";

export const metadata = { title: "Leaderboard - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await requireUser();
  const store = getStore();
  const workouts = store.contestedWorkouts();

  return (
    <>
      <PageTitle sub="Same workout. Same standard. Nowhere to hide.">Leaderboard</PageTitle>

      {workouts.length === 0 ? (
        <Empty>
          Nothing to compare. Two people have to do the same work first.
        </Empty>
      ) : (
        <div className="space-y-4">
          {workouts.map((workout) => {
            const spec = FORMAT_SPECS[workout.format];
            // Only the format knows which direction wins, so ranking happens
            // here rather than in SQL.
            const rows = store
              .leaderboard(workout.id)
              .sort((a, b) => compareScores(workout.format, a.scoreValue, b.scoreValue));

            return (
              <Card key={workout.id}>
                <h2 className="font-semibold">{workout.title}</h2>
                <p className="mb-3 text-xs uppercase tracking-wide opacity-60">
                  {spec.label} · {spec.lowerIsBetter ? "fastest wins" : "most wins"}
                </p>

                <ol className="space-y-1">
                  {rows.map((row, index) => (
                    <li
                      key={`${row.userId}-${row.date}`}
                      className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                        row.userId === user.id ? "bg-lime/10" : ""
                      }`}
                    >
                      <span className="w-6 text-sm tabular-nums opacity-60">{index + 1}</span>
                      <span className="flex-1 text-sm font-medium">
                        {row.name}
                        {/* A scaled result is ranked, but never silently: it is
                            not the same workout as the prescribed one. */}
                        {row.scaled ? (
                          <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-xs font-normal dark:bg-white/15">
                            scaled
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {row.scoreValue === null
                          ? "—"
                          : formatScore(scoreFromValue(spec.score, row.scoreValue), user.unit)}
                      </span>
                      <span className="hidden w-24 text-right text-xs opacity-55 sm:block">
                        {shortDate(row.date)}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
