import { redirect } from "next/navigation";

import { getStore } from "@/lib/db";

import { SetupForm } from "./form";

export const metadata = { title: "Set up - Garage WOD Tracker" };

export default function SetupPage() {
  // Setup is a one-time door. Once an owner exists it closes for good, so a
  // stale bookmark lands on the sign-in form instead.
  if (getStore().countUsers() > 0) redirect("/login");
  return <SetupForm configured={Boolean(process.env.SETUP_TOKEN?.trim())} />;
}
