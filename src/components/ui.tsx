import type { ComponentProps, ReactNode } from "react";

/**
 * The handful of primitives every screen is built from.
 *
 * Deliberately small: a shared Card and Button keep the phone and desktop
 * views consistent without a component library, and each one is a plain
 * server component so it costs nothing on the client.
 */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-slate/60 ${className}`}
    >
      {children}
    </section>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{children}</h1>
      {sub ? <p className="mt-1 text-sm opacity-70">{sub}</p> : null}
    </header>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "quiet" | "danger" };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-iron text-chalk hover:opacity-90 dark:bg-chalk dark:text-iron",
    quiet: "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
    danger: "bg-rust text-white hover:opacity-90",
  }[variant];
  return (
    <button
      {...props}
      // min-h-11 is roughly the 44px tap target a thumb can actually hit.
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-medium transition disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs opacity-60">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-lg border border-black/15 bg-white px-3 " +
  "dark:border-white/20 dark:bg-iron dark:text-chalk";

export function Notice({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  if (!children) return null;
  const styles =
    kind === "error"
      ? "border-rust/40 bg-rust/10 text-rust dark:text-orange-300"
      : "border-lime/40 bg-lime/10 text-lime dark:text-lime-300";
  return (
    <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm opacity-70 dark:border-white/15">{children}</p>;
}
