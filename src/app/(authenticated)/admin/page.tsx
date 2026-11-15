import {
  ArrowUpRight,
  CheckCircle2,
  FolderGit2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/ui/format";
import { services } from "@/server/services";
import { GithubIcon } from "@/components/ui/github-icon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function AdminPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ github?: string }> }>) {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const [
    connection,
    counts,
    activityMetrics,
    lastDiscovery,
    lastRepositorySync,
    summaryStatus,
    syncRuns,
  ] = await Promise.all([
    services.githubConnection.get(tenant),
    services.userRepositories.counts(tenant),
    services.userRepositories.metrics(tenant),
    services.syncRuns.lastDiscovery(tenant),
    services.syncRuns.lastRepositorySync(tenant),
    services.summaries.summaryStatus(tenant),
    services.syncRuns.list(tenant, 8),
  ]);
  const params = await searchParams;
  const githubNotice = params.github;

  return (
    <div>
      <PageHeader
        eyebrow="Private control center"
        title="Control center"
        description="Manage your GitHub connection, repositories, projects, privacy and summaries."
        actions={
          <Link
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-canvas px-3 text-xs font-medium text-primary transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            href="/admin/repositories"
          >
            <FolderGit2 aria-hidden="true" className="h-3.5 w-3.5" />
            Repositories
          </Link>
        }
      />

      {githubNotice === "disconnected" ? (
        <Alert className="mb-6" tone="info">
          GitHub was disconnected. Existing imported data is retained and syncing is stopped until
          you reconnect.
        </Alert>
      ) : null}

      {githubNotice === "reconnected" ? (
        <Alert className="mb-6" tone="success">
          GitHub was reconnected successfully.
        </Alert>
      ) : null}

      {githubNotice === "not-connected" ? (
        <Alert className="mb-6" tone="warning">
          There is no GitHub connection to disconnect.
        </Alert>
      ) : null}

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Discovered repositories", value: counts.total },
          { label: "Tracked repositories", value: counts.tracked },
          { label: "Public display", value: counts.publicDisplay },
          { label: "Qualifying commits", value: activityMetrics.commits },
        ].map((stat) => (
          <div className="bg-canvas px-4 py-4" key={stat.label}>
            <dt className="text-[11px] text-muted">{stat.label}</dt>
            <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
              {formatNumber(stat.value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <GithubIcon aria-hidden="true" className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-primary">GitHub connection</h2>
            </div>
            <Badge dot tone={connection.connected ? "success" : "warning"}>
              {connection.connected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm leading-6 text-secondary">
              {connection.connected
                ? "OAuth credentials are stored server-side and encrypted at rest."
                : "Existing data is retained, but syncing is stopped until you reconnect."}
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Account</dt>
                <dd className="font-mono text-secondary">@{session.githubLogin}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Scopes</dt>
                <dd className="max-w-[60%] text-right font-mono text-[11px] break-words text-secondary">
                  {connection.scope ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {connection.connected ? (
                <form action="/api/auth/github/disconnect" method="post">
                  <Button size="sm" type="submit" variant="danger">
                    Disconnect GitHub
                  </Button>
                </form>
              ) : (
                <a
                  className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg"
                  href="/api/auth/github/start?mode=reconnect"
                >
                  Reconnect GitHub
                </a>
              )}
              <span className="text-[11px] text-muted">
                {connection.connected
                  ? "GitHub remains the source of truth."
                  : "Syncing is paused."}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <RefreshCw aria-hidden="true" className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-primary">Repository discovery</h2>
            </div>
            {lastDiscovery?.status === "FAILED" ? (
              <Badge dot tone="danger">
                Failed
              </Badge>
            ) : (
              <Badge dot tone={counts.total > 0 ? "success" : "neutral"}>
                {counts.total > 0 ? "Synced" : "Not run"}
              </Badge>
            )}
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm leading-6 text-secondary">
              Discover personal and organization repositories, then choose which ones to track.
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Discovered</dt>
                <dd className="font-medium text-primary">{formatNumber(counts.total)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Tracked</dt>
                <dd className="font-medium text-primary">{formatNumber(counts.tracked)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Last discovery</dt>
                <dd className="text-right text-secondary">
                  {lastDiscovery
                    ? formatDateTime(lastDiscovery.finishedAt ?? lastDiscovery.startedAt)
                    : "Never"}
                </dd>
              </div>
            </dl>
            {lastDiscovery?.status === "FAILED" && lastDiscovery.errorMessage ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {lastDiscovery.errorMessage}
              </p>
            ) : null}
            <div className="border-t border-line pt-4">
              <Link
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                href="/admin/repositories"
              >
                Manage repositories
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              {activityMetrics.failed > 0 ? (
                <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
              )}
              <h2 className="text-sm font-semibold text-primary">Sync health</h2>
            </div>
            <Badge
              dot
              tone={
                activityMetrics.failed > 0
                  ? "danger"
                  : activityMetrics.backfilling > 0 || activityMetrics.running > 0
                    ? "warning"
                    : "success"
              }
            >
              {activityMetrics.failed > 0
                ? "Needs attention"
                : activityMetrics.backfilling > 0 || activityMetrics.running > 0
                  ? "In progress"
                  : "Healthy"}
            </Badge>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm leading-6 text-secondary">
              Tracked repositories are backfilled from their default branch and synced again as new
              commits arrive.
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Backfilling or queued</dt>
                <dd className="font-medium text-primary">{activityMetrics.backfilling}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Running now</dt>
                <dd className="font-medium text-primary">{activityMetrics.running}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Failed syncs</dt>
                <dd
                  className={
                    activityMetrics.failed > 0
                      ? "font-medium text-red-600 dark:text-red-400"
                      : "font-medium text-primary"
                  }
                >
                  {activityMetrics.failed}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Last repository sync</dt>
                <dd className="text-right text-secondary">
                  {lastRepositorySync
                    ? relativeTime(lastRepositorySync.finishedAt ?? lastRepositorySync.startedAt)
                    : "Never"}
                </dd>
              </div>
            </dl>
            {lastRepositorySync?.status === "FAILED" && lastRepositorySync.errorMessage ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {lastRepositorySync.errorMessage}
              </p>
            ) : null}
            <div className="border-t border-line pt-4">
              <Link
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                href="/admin/repositories"
              >
                Manage repository sync
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-primary">Daily summaries</h2>
            </div>
            <Badge dot tone={summaryStatus.enabled ? "success" : "neutral"}>
              {summaryStatus.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm leading-6 text-secondary">
              Optional narratives are generated after each local day ends. Metrics stay
              deterministic even when summaries are disabled.
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Private metadata opt-in</dt>
                <dd className="font-medium text-primary">
                  {summaryStatus.allowPrivateMetadataForLlm ? "Allowed" : "Not allowed"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Provider</dt>
                <dd className="max-w-[60%] truncate text-right font-mono text-[11px] text-secondary">
                  {summaryStatus.provider || "Not configured"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Succeeded / failed</dt>
                <dd className="font-medium text-primary">
                  {summaryStatus.counts.succeeded} / {summaryStatus.counts.failed}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Last generated</dt>
                <dd className="text-right text-secondary">
                  {summaryStatus.latestGeneratedAt
                    ? formatDateTime(new Date(summaryStatus.latestGeneratedAt))
                    : "Never"}
                </dd>
              </div>
            </dl>
            <div className="border-t border-line pt-4">
              <Link
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                href="/admin/settings"
              >
                Configure summaries
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-canvas">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-primary">Recent sync runs</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Latest discovery and repository backfill attempts.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            href="/admin/repositories"
          >
            Repository sync
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[11px] text-muted">
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Timestamp
                </th>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Repository
                </th>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Trigger
                </th>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Status
                </th>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Pages / Commits
                </th>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {syncRuns.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-secondary" colSpan={6}>
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                syncRuns.map((run) => (
                  <tr className="align-top" key={run.id}>
                    <td className="tabular px-4 py-3 text-secondary">
                      {formatDateTime(run.finishedAt ?? run.startedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-secondary">
                      {run.userRepository?.githubRepository.fullName ?? "Repository discovery"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="outline">{run.trigger}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        dot
                        tone={
                          run.status === "SUCCEEDED"
                            ? "success"
                            : run.status === "FAILED"
                              ? "danger"
                              : run.status === "PARTIAL"
                                ? "warning"
                                : "info"
                        }
                      >
                        {run.status === "SUCCEEDED"
                          ? "Complete"
                          : run.status === "RUNNING"
                            ? "Running"
                            : run.status === "FAILED"
                              ? "Failed"
                              : run.status === "PARTIAL"
                                ? "Partial"
                                : "Queued"}
                      </Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {formatNumber(run.pagesProcessed)} / {formatNumber(run.commitsProcessed)}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-[11px] leading-5 text-secondary">
                      {run.errorCode || run.errorMessage ? (
                        <span className="text-red-600 dark:text-red-400">
                          {run.errorCode ?? run.errorMessage}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <p className="text-xs leading-5 text-secondary">
          The admin UI is never a security boundary. Every query and mutation is enforced in
          server-side tenant-scoped services.
        </p>
      </div>
    </div>
  );
}
