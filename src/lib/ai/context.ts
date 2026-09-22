import "server-only";

import { getStore } from "@/lib/db";
import type { User } from "@/lib/db/types";
import { formatLoad } from "@/lib/units";
import type { Unit } from "@/lib/units";
import { FORMAT_SPECS } from "@/lib/workout/formats";
import { formatScore, scoreFromValue } from "@/lib/workout/score";

/** How far back the model is shown. Eight weeks is about two training blocks. */
export const CONTEXT_WEEKS = 8;

function weeksAgo(weeks: number): string {
  const d = new Date(Date.now() - weeks * 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * What this athlete has actually been doing, as plain text for the prompt.
 *
 * Rendered rather than handed over as JSON: the model reads "12:34" and
 * "7+12" natively, and a table of raw `score_value` integers would need the
 * format catalogue explained before any of it meant anything.
 *
 * An athlete with no history gets a paragraph saying so, which matters - left
 * to infer it, the model tends to write a week for an experienced lifter.
 */
export function trainingContext(user: User): string {
  const store = getStore();
  const since = weeksAgo(CONTEXT_WEEKS);

  const results = store.resultsSince(user.id, since);
  if (results.length === 0) {
    return [
      `${user.name} has no logged training in the last ${CONTEXT_WEEKS} weeks.`,
      "Treat them as returning to training: start conservative, prioritise movement quality",
      "and range of motion over load, and leave obvious room to add weight next week.",
    ].join(" ");
  }

  const lines: string[] = [];
  lines.push(`Training history for ${user.name}, last ${CONTEXT_WEEKS} weeks.`);
  lines.push(`Loads are shown in ${user.unit}, which is the unit they log in.`);
  lines.push("");

  lines.push("Sessions per week, with average RPE where recorded:");
  for (const week of store.sessionsByWeek(user.id, since)) {
    const rpe = week.avgRpe === null ? "no RPE logged" : `avg RPE ${week.avgRpe}`;
    lines.push(`  ${week.week}: ${week.sessions} session(s), ${rpe}`);
  }
  lines.push("");

  const mix = store.formatMix(user.id, since);
  if (mix.length > 0) {
    lines.push("Format mix:");
    for (const row of mix) {
      lines.push(`  ${FORMAT_SPECS[row.format].label}: ${row.sessions}`);
    }
    lines.push("");
  }

  const best = store.bestLoads(user.id);
  if (best.length > 0) {
    lines.push("Heaviest load recorded per movement:");
    for (const row of best) {
      lines.push(`  ${row.name}: ${formatLoad(row.loadG, user.unit)} (${row.date})`);
    }
    lines.push("");
  }

  lines.push("Recent sessions, newest first:");
  for (const r of results.slice(0, 30)) {
    const spec = FORMAT_SPECS[r.format];
    const score =
      r.scoreValue === null
        ? "not finished"
        : formatScore(scoreFromValue(spec.score, r.scoreValue), user.unit);
    const bits = [`${r.date}`, r.title, `[${spec.label}]`, score];
    if (r.scaled) bits.push("(scaled)");
    if (r.rpe !== null) bits.push(`RPE ${r.rpe}`);
    lines.push(`  ${bits.join(" - ")}`);
    if (r.notes.trim()) lines.push(`      note: ${r.notes.trim()}`);
  }

  return lines.join("\n");
}

/**
 * What the gym owns, as a hard constraint for the prompt.
 *
 * Kit marked out of action is left out entirely rather than listed as
 * unavailable: naming a rower at all invites the model to program one, and a
 * broken rower is indistinguishable from no rower on the day.
 *
 * An empty inventory is reported as unknown rather than as "nothing". Told the
 * gym owns nothing, the model writes a week of burpees; told the inventory is
 * simply not recorded, it programs conservatively and names substitutions.
 */
export function equipmentContext(unit: Unit): string {
  const kit = getStore().availableEquipment();

  if (kit.length === 0) {
    return [
      "No equipment inventory has been recorded for this gym.",
      "Assume very little: bodyweight, a single barbell and some space.",
      "For every movement needing kit, name a bodyweight substitution in its notes.",
    ].join(" ");
  }

  const lines = ["Equipment available in this gym. Program only with what is on this list:"];
  for (const item of kit) {
    const bits = [`  - ${item.name}`];
    if (item.detail.trim()) bits.push(`(${item.detail.trim()})`);
    if (item.maxLoadG !== null) bits.push(`— loads to ${formatLoad(item.maxLoadG, unit)}`);
    lines.push(bits.join(" "));
  }
  lines.push("");
  lines.push(
    "If a movement you want needs kit that is not listed, substitute something that is, " +
      "and say in that movement's notes what you substituted and why.",
  );
  return lines.join("\n");
}
