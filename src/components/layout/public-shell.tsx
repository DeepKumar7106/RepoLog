import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { GithubIcon } from "@/components/ui/github-icon";

export async function PublicShell({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="hidden sm:inline-flex" />
            {session ? (
              <Link className={buttonVariants({ size: "sm" })} href="/dashboard">
                Dashboard
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <a className={buttonVariants({ size: "sm" })} href="/api/auth/github/start">
                <GithubIcon aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign in with GitHub</span>
                <span className="sm:hidden">Sign in</span>
              </a>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            GitHub remains the source of truth.{" "}
            <span className="text-secondary">RepoLog visualizes your default-branch progress.</span>
          </p>
          <div className="flex items-center gap-4">
            <ThemeToggle className="sm:hidden" />
            <Link
              className="rounded text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              href="/"
            >
              Home
            </Link>
            <a
              className="rounded text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              href="/api/health"
            >
              Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

