"use client";

import { useRouter } from "next/navigation";

/**
 * Whose week the owner is looking at.
 *
 * Navigates rather than posting: which athlete you are viewing belongs in the
 * URL, so the back button works and a coach can keep a tab open on somebody.
 * The week being viewed is carried across, because changing athlete should not
 * silently jump you back to today.
 */
export function AthletePicker({
  athletes,
  selected,
  start,
  viewerId,
}: {
  athletes: Array<{ id: number; name: string }>;
  selected: number;
  start: string;
  viewerId: number;
}) {
  const router = useRouter();
  if (athletes.length < 2) return null;

  return (
    <label className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm opacity-70">Viewing</span>
      <select
        value={selected}
        onChange={(e) => {
          const id = Number(e.target.value);
          router.push(
            id === viewerId ? `/week?start=${start}` : `/week?start=${start}&athlete=${id}`,
          );
        }}
        className="min-h-11 rounded-lg border border-black/15 bg-white px-3 text-sm dark:border-white/20 dark:bg-iron dark:text-chalk"
      >
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id === viewerId ? `${a.name} (you)` : a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
