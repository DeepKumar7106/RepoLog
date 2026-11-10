import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RepoLog",
    template: "%s | RepoLog",
  },
  description: "Turn your GitHub activity into a clear project portfolio and development timeline.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link className="text-lg font-semibold tracking-tight" href="/">
              RepoLog
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
              <Link className="text-slate-600 hover:text-slate-900" href="/dashboard">
                Dashboard
              </Link>
              <Link className="text-slate-600 hover:text-slate-900" href="/admin">
                Admin
              </Link>
              <a className="font-medium text-slate-900 underline" href="/api/auth/github/start">
                Sign in
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-sm text-slate-500">
          GitHub remains the source of truth for repositories and code.
        </footer>
      </body>
    </html>
  );
}
