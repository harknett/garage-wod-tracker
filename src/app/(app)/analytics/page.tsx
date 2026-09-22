import { BarChart, StatTile } from "@/components/bar-chart";
import { Card, Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { formatLoad } from "@/lib/units";
import { FORMAT_SPECS } from "@/lib/workout/formats";

export const metadata = { title: "Progress - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

/** The window every number on this page is measured over. */
const WEEKS = 12;

export default async function AnalyticsPage() {
  const user = await requireUser();
  const store = getStore();
  const since = addDays(today(), -WEEKS * 7);

  const byWeek = store.sessionsByWeek(user.id, since);
  const mix = store.formatMix(user.id, since);
  const best = store.bestLoads(user.id);
  const results = store.resultsSince(user.id, since);

  const sessions = results.length;
  const rpes = results.map((r) => r.rpe).filter((r): r is number => r !== null);
  const avgRpe = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const scaled = results.filter((r) => r.scaled).length;
  const perWeek = byWeek.length > 0 ? sessions / byWeek.length : 0;

  return (
    <>
      <PageTitle sub={`Last ${WEEKS} weeks. The record does not care how you felt.`}>
        The record
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sessions" value={String(sessions)} caption={`over ${WEEKS} weeks`} />
        <StatTile
          label="Per week"
          value={perWeek === 0 ? "—" : perWeek.toFixed(1)}
          caption="average"
        />
        <StatTile
          label="Avg RPE"
          value={avgRpe === null ? "—" : avgRpe.toFixed(1)}
          caption={rpes.length === 0 ? "none logged" : `from ${rpes.length} session(s)`}
        />
        <StatTile
          label="As prescribed"
          value={sessions === 0 ? "—" : `${Math.round(((sessions - scaled) / sessions) * 100)}%`}
          caption={`${scaled} scaled`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">Sessions per week</h2>
          <p className="mb-4 text-xs text-[#898781]">
            Consistency beats intensity. The gaps are the whole story.
          </p>
          <BarChart
            label="Sessions logged per week"
            data={byWeek.map((w) => ({
              key: w.week.replace(/^\d{4}-/, ""),
              value: w.sessions,
              caption: w.avgRpe === null ? undefined : `RPE ${w.avgRpe}`,
            }))}
            empty="No sessions logged in this window."
          />
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Format mix</h2>
          <p className="mb-4 text-xs text-[#898781]">
            A month of one format is a comfort zone. This is the shape of your training.
          </p>
          <BarChart
            label="Sessions by workout format"
            data={mix.map((m) => ({ key: FORMAT_SPECS[m.format].label, value: m.sessions }))}
            empty="No sessions logged in this window."
          />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-1 font-semibold">Heaviest recorded</h2>
        <p className="mb-4 text-xs text-[#898781]">
          The most you have ever moved. Beat it.
        </p>
        {best.length === 0 ? (
          <Empty>No loads logged. Put weight on the bar and write it down.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-[#898781] dark:border-white/10">
                <th className="py-2 font-medium">Movement</th>
                <th className="py-2 text-right font-medium">Best</th>
                <th className="py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {best.map((row) => (
                <tr key={row.name} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatLoad(row.loadG, user.unit)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[#898781]">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
