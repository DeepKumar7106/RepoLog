"use client";

import {
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/ui/format";

type AppShellProps = Readonly<{
  children: ReactNode;
  displayName: string;
  githubLogin: string;
  avatarUrl: string | null;
  profileSlug: string;
  profileVisibility: "PUBLIC" | "PRIVATE";
  onboardingCompleted: boolean;
}>;

const navigation = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/admin/repositories", label: "Repositories", exact: false },
  { href: "/admin/projects", label: "Projects", exact: false },
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/settings", label: "Settings", exact: false },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  displayName,
  githubLogin,
  avatarUrl,
  profileSlug,
  profileVisibility,
  onboardingCompleted,
}: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Logo href="/dashboard" />

          <nav aria-label="Workspace" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href, item.exact);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active
                      ? "bg-hover text-primary"
                      : "text-secondary hover:bg-hover hover:text-primary",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {onboardingCompleted ? (
              <Link
                className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
                href={`/u/${profileSlug}`}
                rel="noreferrer"
                target="_blank"
              >
                <span>View public profile</span>
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                className={buttonVariants({ variant: "secondary", size: "sm" })}
                href="/onboarding"
              >
                Finish setup
              </Link>
            )}

            <ThemeToggle className="hidden sm:inline-flex" />

            <details className="group relative hidden md:block">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                {avatarUrl ? (
                  <Image
                    alt=""
                    className="h-7 w-7 rounded-full border border-line"
                    height={28}
                    src={avatarUrl}
                    unoptimized
                    width={28}
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-line bg-canvas p-1 shadow-lg">
                <div className="border-b border-line px-3 py-2">
                  <p className="truncate text-sm font-medium text-primary">{displayName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="truncate font-mono text-xs text-muted">@{githubLogin}</p>
                    <Badge tone={profileVisibility === "PUBLIC" ? "success" : "neutral"}>
                      {profileVisibility === "PUBLIC" ? "Published" : "Private"}
                    </Badge>
                  </div>
                </div>
                <Link
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-secondary hover:bg-hover hover:text-primary"
                  href="/dashboard"
                >
                  <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-secondary hover:bg-hover hover:text-primary"
                  href="/admin/settings"
                >
                  <Settings aria-hidden="true" className="h-4 w-4" />
                  Settings
                </Link>
                <form action="/api/auth/signout" method="post">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary"
                    type="submit"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            </details>

            <button
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              aria-label="Open navigation"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>GitHub remains the source of truth.</p>
          <p className="font-mono">
            @{githubLogin} · {onboardingCompleted ? "Workspace ready" : "Setup incomplete"}
          </p>
        </div>
      </footer>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 h-full w-full bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
          <div
            aria-label="Navigation"
            aria-modal="true"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-line bg-canvas"
            id="mobile-navigation"
            role="dialog"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Logo href="/dashboard" />
              <button
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-secondary hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-line px-4 py-4">
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <Image
                    alt=""
                    className="h-8 w-8 rounded-full border border-line"
                    height={32}
                    src={avatarUrl}
                    unoptimized
                    width={32}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate font-mono text-xs text-muted">@{githubLogin}</p>
                </div>
              </div>
            </div>

            <nav aria-label="Mobile workspace" className="flex-1 overflow-y-auto p-2">
              {navigation.map((item) => {
                const active = isActive(pathname, item.href, item.exact);

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium",
                      active ? "bg-hover text-primary" : "text-secondary hover:bg-hover",
                    )}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-hover"
                href={`/u/${profileSlug}`}
                onClick={() => setMenuOpen(false)}
                rel="noreferrer"
                target="_blank"
              >
                Public profile
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </nav>

            <div className="space-y-3 border-t border-line p-4">
              <ThemeToggle />
              <form action="/api/auth/signout" method="post">
                <button
                  className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
                  type="submit"
                >
                  <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}