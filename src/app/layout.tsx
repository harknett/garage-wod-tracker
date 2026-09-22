import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Garage WOD Tracker",
  description: "Discipline, written down.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "WOD", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // `viewport-fit=cover` plus the safe-area padding in the app layout keeps the
  // bottom nav clear of the home indicator on a phone.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#17181a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-chalk text-iron antialiased dark:bg-iron dark:text-chalk">
        {children}
      </body>
    </html>
  );
}
