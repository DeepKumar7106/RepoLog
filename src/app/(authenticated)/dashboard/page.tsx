import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export default async function DashboardPage() {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const [connection, counts, activityMetrics, lastSync] = await Promise.all([
    services.githubConnection.get(tenant),
    services.userRepositories.counts(tenant),
    services.userRepositories.metrics(tenant),
    services.syncRuns.lastRepositorySync(tenant),
  ]);
  const displayName = session.displayName ?? session.githubLogin;
  const metrics = [
    { label: "Tracked repositories", value: String(counts.tracked) },
    { label: "Qualifying commits", value: String(activityMetrics.commits) },
    { label: "Active days", value: String(activityMetrics.activeDays) },
    { label: "Projects", value: String(activityMetrics.projects) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Private workspace"
        title={`Welcome, ${displayName}`}
        description="Your own project overview, timeline, sync progress and daily activity will live here."
      />

      {connection.connected ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            GitHub is connected. Discover repositories, enable tracking, then sync commit history
            from Admin → Repositories.
          </p>
          <Link className="font-semibold underline" href="/admin/repositories">
            Manage repositories
          </Link>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            GitHub is disconnected. Existing imported data is retained, but syncing is stopped until
            you reconnect.
          </p>
          <Link className="font-semibold underline" href="/api/auth/github/start?mode=reconnect">
            Reconnect GitHub
          </Link>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metric.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlaceholderPanel title="Project overview" milestone="Milestone 5">
          Project cards, statuses and public/private state will be loaded through tenant-scoped
          services.
        </PlaceholderPanel>
        <Card>
          <h2 className="font-semibold text-slate-900">Sync and backfill</h2>
          {activityMetrics.backfilling > 0 ? (
            <p className="mt-2 text-sm text-amber-800">
              {activityMetrics.backfilling} tracked{" "}
              {activityMetrics.backfilling === 1 ? "repository is" : "repositories are"} still
              backfilling. Timeline totals are incomplete until those runs finish.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              All tracked repositories have completed their initial backfill.
            </p>
          )}
          {activityMetrics.running > 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              {activityMetrics.running} sync {activityMetrics.running === 1 ? "is" : "are"} running
              now.
            </p>
          ) : null}
          {activityMetrics.failed > 0 ? (
            <p className="mt-2 text-sm text-red-700">
              {activityMetrics.failed} tracked{" "}
              {activityMetrics.failed === 1 ? "repository has" : "repositories have"} a failed sync.
              Open repository sync for safe error details.
            </p>
          ) : null}
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last repository sync</dt>
              <dd className="text-right font-medium text-slate-900">
                {lastSync ? formatDate(lastSync.finishedAt ?? lastSync.startedAt) : "Never"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Repository</dt>
              <dd className="max-w-[60%] text-right font-medium text-slate-900">
                {lastSync?.userRepository?.githubRepository.fullName ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">{lastSync?.status ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 text-sm">
            <Link className="font-semibold text-slate-900 underline" href="/admin/repositories">
              Review repository sync
            </Link>
          </div>
        </Card>
        <PlaceholderPanel title="Activity timeline" milestone="Milestone 6">
          Deterministic daily aggregates and the accessible text/list alternative will appear here.
        </PlaceholderPanel>
        <PlaceholderPanel title="Daily summaries" milestone="Milestone 7">
          Optional LLM narratives will be stored per user and day without blocking the deterministic
          metrics.
        </PlaceholderPanel>
      </div>
    </div>
  );
}
