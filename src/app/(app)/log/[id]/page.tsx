import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { shortDate } from "@/lib/dates";

import { LogForm } from "./form";

export const metadata = { title: "Log result - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const store = getStore();
  const assignment = store.findAssignment(Number(id));
  // Someone else's assignment is a 404, not a 403: whether an id exists is not
  // this athlete's business either way.
  if (!assignment || assignment.userId !== user.id) notFound();

  const workout = store.getWorkout(assignment.workoutId)!;
  const result = store.resultFor(assignment.id);

  return (
    <LogForm
      assignmentId={assignment.id}
      date={shortDate(assignment.date)}
      workout={workout}
      unit={user.unit}
      existing={result}
    />
  );
}
