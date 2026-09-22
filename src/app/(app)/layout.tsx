import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "../(auth)/actions";
import { requireUser } from "@/lib/auth/guard";

/**
 * The signed-in shell.
 *
 * Navigation sits at the bottom on a phone, where a thumb reaches, and at the
 * top on a laptop, where a mouse expects it. One list of links, two positions,
 * rather than two navigations to keep in step.
 */
const LINKS = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/leaderboard", label: "Board" },
  { href: "/analytics", label: "Record" },
] as const;

const OWNER_LINKS = [
  { href: "/build", label: "Build" },
  { href: "/equipment", label: "Kit" },
  { href: "/athletes", label: "Athletes" },
] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const links = user.role === "owner" ? [...LINKS, ...OWNER_LINKS] : LINKS;

  return (
    <div className="min-h-screen">
      <header className="hidden border-b border-black/10 sm:block dark:border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
          <Link href="/" className="mr-4 font-semibold tracking-tight">
            Garage WOD
          </Link>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              {l.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Link href="/settings" className="text-sm opacity-70 hover:opacity-100">
              {user.name}
            </Link>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-2 text-sm opacity-70 hover:opacity-100">
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>

      {/* pb-28 on small screens keeps the last card clear of the fixed nav. */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:pb-12">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 border-t border-black/10 bg-chalk/95 backdrop-blur sm:hidden dark:border-white/10 dark:bg-iron/95"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex">
          {[...links, { href: "/settings", label: "You" }].map((l) => (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                className="flex min-h-14 flex-col items-center justify-center text-xs font-medium"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
