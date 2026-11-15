import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RepoLog",
    template: "%s | RepoLog",
  },
  description: "Turn your GitHub activity into a clear project portfolio and development timeline.",
};

const THEME_COOKIE = "repolog-theme";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const themeClass = theme === "dark" ? "dark" : theme === "light" ? "light" : undefined;

  return (
    <html className={themeClass} data-scroll-behavior="smooth" lang="en" suppressHydrationWarning>
      <body className="bg-canvas text-primary antialiased">{children}</body>
    </html>
  );
}
