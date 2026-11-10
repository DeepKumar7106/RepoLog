import Link from "next/link";
import type { ReactNode } from "react";
import { requireSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await requireSessionUser();
  const displayName = session.displayName ?? session.githubLogin;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
          >
            {initial}
          </span>
          <div>
            <p className="font-medium text-slate-900">{displayName}</p>
            <p className="text-sm text-slate-500">@{session.githubLogin}</p>
          </div>
        </div>

        <nav aria-label="Workspace" className="flex flex-wrap items-center gap-4 text-sm">
          <Link className="text-slate-600 hover:text-slate-900" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-slate-600 hover:text-slate-900" href="/admin">
            Admin
          </Link>
          <Link className="text-slate-600 hover:text-slate-900" href={`/u/${session.profileSlug}`}>
            Public profile
          </Link>
          {!session.onboardingCompletedAt ? (
            <Link className="font-medium text-slate-900 underline" href="/onboarding">
              Finish onboarding
            </Link>
          ) : null}
          <form action="/api/auth/signout" method="post">
            <button className="font-medium text-slate-900 underline" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </div>

      {children}
    </div>
  );
}
