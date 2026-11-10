import Link from "next/link";
import { Card } from "@/components/ui/card";
import { isGitHubAuthConfigured } from "@/lib/auth/github";

export const dynamic = "force-dynamic";

const sampleProjects = [
  {
    title: "Task Manager",
    status: "Ongoing",
    commits: 128,
    tone: "bg-emerald-100 text-emerald-800",
  },
  { title: "Auth Toolkit", status: "Complete", commits: 64, tone: "bg-sky-100 text-sky-800" },
  { title: "CLI Notes", status: "On break", commits: 31, tone: "bg-amber-100 text-amber-800" },
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

  return (
    <div className="space-y-10">
      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Project portfolio and development timeline
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Show the story behind your GitHub work.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            RepoLog turns your qualifying commits into a clear project portfolio and chronological
            timeline. You choose which repositories to track, which projects to publish, and what
            the public can see.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            {configured ? (
              <a
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                href="/api/auth/github/start"
              >
                Continue with GitHub
              </a>
            ) : (
              <button
                className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white opacity-70"
                disabled
                type="button"
              >
                Continue with GitHub
              </button>
            )}
            <p className="text-sm text-slate-500">
              {configured
                ? "Sign in with GitHub. Your profile starts private."
                : "Add GitHub OAuth credentials to .env to enable sign-in."}
            </p>
          </div>
        </div>

        <Card className="bg-white">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Sample data
            </span>
          </div>
          <div className="space-y-3">
            {sampleProjects.map((project) => (
              <div
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3"
                key={project.title}
              >
                <div>
                  <p className="font-medium text-slate-900">{project.title}</p>
                  <p className="text-xs text-slate-500">{project.commits} qualifying commits</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${project.tone}`}>
                  {project.status}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            This preview is illustrative only. It does not represent a real user&apos;s activity.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <h2 className="font-semibold text-slate-900">GitHub stays the source of truth</h2>
          <p className="mt-2 text-sm text-slate-600">
            RepoLog visualizes project history. Repositories, code, issues and pull requests remain
            on GitHub.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Private by default</h2>
          <p className="mt-2 text-sm text-slate-600">
            New profiles and projects start private. Publishing is an explicit choice at both
            levels.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Deterministic metrics</h2>
          <p className="mt-2 text-sm text-slate-600">
            Commit counts and daily activity are calculated from imported data, never invented by a
            language model.
          </p>
        </Card>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Milestone 3: Repository discovery</h2>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with GitHub, discover accessible personal and organization repositories, and
          choose which ones to track. Repository discovery is tenant-scoped, paginated and
          idempotent; commit backfill arrives in the next milestone.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="font-medium text-slate-900 underline" href="/dashboard">
            Dashboard
          </Link>
          <Link className="font-medium text-slate-900 underline" href="/admin">
            Admin
          </Link>
          <Link className="font-medium text-slate-900 underline" href="/admin/repositories">
            Repositories
          </Link>
        </div>
      </section>
    </div>
  );
}
