import { ArrowRight, CalendarDays, GitCommitHorizontal, Globe2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill, type StatusValue } from "@/components/ui/status-pill";
import { isGitHubAuthConfigured } from "@/lib/auth/github";
import { publicProfilePath } from "@/lib/urls/public-urls";
import { services } from "@/server/services";
import { GithubIcon } from "@/components/ui/github-icon";

export const dynamic = "force-dynamic";

const sampleProjects: Array<{ title: string; status: StatusValue; commits: number; meta: string }> =
  [
    { title: "Task Manager", status: "ONGOING", commits: 128, meta: "Updated today" },
    { title: "Auth Toolkit", status: "COMPLETE", commits: 64, meta: "Finished in March" },
    { title: "CLI Notes", status: "ON_BREAK", commits: 31, meta: "Paused last week" },
  ];

const sampleActivity = [
  0, 1, 2, 0, 3, 1, 0, 2, 4, 1, 0, 2, 1, 3, 0, 4, 2, 1, 0, 3, 2, 4, 1, 0, 2, 3, 1, 4, 2, 0, 1, 3, 2,
  4, 1,
];

const activityTone = [
  "bg-hover",
  "bg-emerald-200 dark:bg-emerald-950",
  "bg-emerald-300 dark:bg-emerald-800",
  "bg-emerald-500 dark:bg-emerald-600",
  "bg-emerald-700 dark:bg-emerald-400",
];

function authMessage(auth: string | undefined, reason: string | undefined): string | null {
  if (auth === "required") {
    return "Sign in with GitHub to access your private workspace.";
  }

  if (auth === "not-configured") {
    return "GitHub sign-in is not configured in this environment. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env.";
  }

  if (auth === "error") {
    if (reason === "account-mismatch") {
      return "That GitHub account does not match the account you are signed in as.";
    }

    if (reason === "access_denied") {
      return "GitHub sign-in was cancelled. You can try again whenever you are ready.";
    }

    return "GitHub sign-in could not be completed. Please try again.";
  }

  return null;
}

export default async function MarketingPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ auth?: string; reason?: string }> }>) {
  const params = await searchParams;
  const configured = isGitHubAuthConfigured();
  const message = authMessage(params.auth, params.reason);
  const featuredProfile = await services.publicProfiles.findFeaturedProfile().catch(() => {
    console.warn("[marketing] Featured profile is unavailable; rendering without it.");
    return null;
  });

  return (
    <PublicShell>
      <div className="space-y-16">
        {message ? (
          <Alert tone={params.auth === "error" ? "danger" : "warning"}>{message}</Alert>
        ) : null}

        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="mb-4 font-mono text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
              Project portfolio · Development timeline
            </p>
            <h1 className="max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight text-primary sm:text-5xl">
              Your GitHub history, distilled into a living project timeline.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
              Connect your repositories, curate what you share, and turn daily commits into a
              chronological developer portfolio.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {configured ? (
                <a className={buttonVariants({ size: "lg" })} href="/api/auth/github/start">
                  <GithubIcon aria-hidden="true" className="h-4 w-4" />
                  Continue with GitHub
                </a>
              ) : (
                <button className={buttonVariants({ size: "lg" })} disabled type="button">
                  <GithubIcon aria-hidden="true" className="h-4 w-4" />
                  Continue with GitHub
                </button>
              )}
              {featuredProfile ? (
                <Link
                  className={buttonVariants({ size: "lg", variant: "secondary" })}
                  href={publicProfilePath(featuredProfile.profileSlug)}
                >
                  See a sample profile
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              {configured
                ? "Your profile starts private. Publish only when you are ready."
                : "Add GitHub OAuth credentials to .env to enable sign-in."}
            </p>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <dt className="text-xs text-muted">Metric source</dt>
                <dd className="mt-1 text-sm font-medium text-primary">Imported commits</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Default state</dt>
                <dd className="mt-1 text-sm font-medium text-primary">Private</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Source of truth</dt>
                <dd className="mt-1 text-sm font-medium text-primary">GitHub</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-line bg-surface p-2">
            <div className="rounded-md border border-line bg-canvas">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold">
                    JD
                  </span>
                  <div>
                    <p className="text-sm font-medium text-primary">Jordan Davis</p>
                    <p className="font-mono text-[11px] text-muted">@jordan · 3 projects</p>
                  </div>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
                  Sample Data Preview
                </span>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                      <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                      Last 5 weeks
                    </p>
                    <p className="tabular text-[11px] text-muted">223 commits</p>
                  </div>
                  <div className="grid grid-cols-[repeat(7,1fr)] gap-1">
                    {sampleActivity.map((level, index) => (
                      <span
                        className={`aspect-square rounded-[3px] ${activityTone[level]}`}
                        key={index}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {sampleProjects.map((project) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
                      key={project.title}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">{project.title}</p>
                        <p className="text-[11px] text-muted">{project.meta}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular hidden text-[11px] text-secondary sm:inline">
                          {project.commits}
                        </span>
                        <StatusPill status={project.status} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                      Daily summary
                    </p>
                    <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-muted uppercase">
                      Public
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-primary">
                    Shipped the first working timeline view.
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-secondary">
                    Eleven qualifying commits across two projects, focused on rendering activity
                    data and tightening the project card layout.
                  </p>
                </div>
              </div>
            </div>
            <p className="px-2 py-2 text-center text-[11px] text-muted">
              Illustrative preview. Not a real user&apos;s activity.
            </p>
          </div>
        </section>

        {featuredProfile ? (
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-canvas">
                <Globe2 aria-hidden="true" className="h-4 w-4 text-secondary" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                  Featured public profile
                </p>
                <p className="text-sm font-medium text-primary">
                  {featuredProfile.displayName ?? featuredProfile.githubLogin}
                </p>
              </div>
            </div>
            <Link
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              href={publicProfilePath(featuredProfile.profileSlug)}
            >
              @{featuredProfile.profileSlug}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </section>
        ) : null}

        <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {[
            {
              icon: GithubIcon,
              title: "GitHub stays the source of truth",
              body: "Repositories, code, issues and pull requests stay on GitHub. RepoLog only visualizes imported history.",
            },
            {
              icon: ShieldCheck,
              title: "Private by default",
              body: "Profiles and projects start private. Publishing is an explicit choice at the profile and project level.",
            },
            {
              icon: GitCommitHorizontal,
              title: "Deterministic metrics",
              body: "Commit counts and daily activity come from imported data. Summaries never invent numbers.",
            },
          ].map((feature) => {
            const Icon = feature.icon;

            return (
              <div className="bg-canvas p-6" key={feature.title}>
                <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
                <h2 className="mt-3 text-sm font-semibold text-primary">{feature.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-secondary">{feature.body}</p>
              </div>
            );
          })}
        </section>
      </div>
    </PublicShell>
  );
}
