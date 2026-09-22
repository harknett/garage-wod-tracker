import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Garage WOD Tracker",
  description: "A training log for the garage gym.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-chalk text-iron dark:bg-iron dark:text-chalk antialiased">
        {children}
      </body>
    </html>
  );
}
