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
  title: "Admin",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export default async function AdminPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ github?: string }> }>) {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const [connection, counts, activityMetrics, lastDiscovery, lastRepositorySync, summaryStatus] =
    await Promise.all([
      services.githubConnection.get(tenant),
      services.userRepositories.counts(tenant),
      services.userRepositories.metrics(tenant),
      services.syncRuns.lastDiscovery(tenant),
      services.syncRuns.lastRepositorySync(tenant),
      services.summaries.summaryStatus(tenant),
    ]);
  const params = await searchParams;
  const githubNotice = params.github;

  return (
    <div>
      <PageHeader
        eyebrow="Private control center"
        title="Admin"
        description="Manage your GitHub connection, repositories, projects, privacy and summaries."
      />

      {githubNotice === "disconnected" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          GitHub was disconnected. Existing imported data is retained and syncing is stopped until
          you reconnect.
        </div>
      ) : null}

      {githubNotice === "reconnected" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          GitHub was reconnected successfully.
        </div>
      ) : null}

      {githubNotice === "not-connected" ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          There is no GitHub connection to disconnect.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">GitHub connection</h2>
          <p className="mt-2 text-sm text-slate-600">
            {connection.connected
              ? "Connected. OAuth credentials are stored server-side and encrypted at rest."
              : "Disconnected. Existing data is retained, but syncing is stopped until you reconnect."}
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">
                {connection.connected ? "Connected" : "Disconnected"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Scopes</dt>
              <dd className="max-w-[60%] text-right font-medium break-words text-slate-900">
                {connection.scope ?? "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {connection.connected ? (
              <form action="/api/auth/github/disconnect" method="post">
                <button className="font-semibold text-red-700 underline" type="submit">
                  Disconnect GitHub
                </button>
              </form>
            ) : (
              <Link
                className="font-semibold text-slate-900 underline"
                href="/api/auth/github/start?mode=reconnect"
              >
                Reconnect GitHub
              </Link>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">Repository discovery</h2>
          <p className="mt-2 text-sm text-slate-600">
            Discover personal and organization repositories, then choose which ones to track.
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Discovered</dt>
              <dd className="font-medium text-slate-900">{counts.total}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Tracked</dt>
              <dd className="font-medium text-slate-900">{counts.tracked}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Public display enabled</dt>
              <dd className="font-medium text-slate-900">{counts.publicDisplay}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last discovery</dt>
              <dd className="text-right font-medium text-slate-900">
                {lastDiscovery
                  ? formatDate(lastDiscovery.finishedAt ?? lastDiscovery.startedAt)
                  : "Never"}
              </dd>
            </div>
          </dl>

          {lastDiscovery?.status === "FAILED" && lastDiscovery.errorMessage ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {lastDiscovery.errorMessage}
            </p>
          ) : null}

          <div className="mt-4 text-sm">
            <Link className="font-semibold text-slate-900 underline" href="/admin/repositories">
              Manage repositories
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">Sync health</h2>
          <p className="mt-2 text-sm text-slate-600">
            Tracked repositories can be backfilled from their default branch and synced again as new
            commits arrive.
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Backfilling or queued</dt>
              <dd className="font-medium text-slate-900">{activityMetrics.backfilling}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Running now</dt>
              <dd className="font-medium text-slate-900">{activityMetrics.running}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Failed syncs</dt>
              <dd className="font-medium text-slate-900">{activityMetrics.failed}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Qualifying commits</dt>
              <dd className="font-medium text-slate-900">{activityMetrics.commits}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last repository sync</dt>
              <dd className="text-right font-medium text-slate-900">
                {lastRepositorySync
                  ? formatDate(lastRepositorySync.finishedAt ?? lastRepositorySync.startedAt)
                  : "Never"}
              </dd>
            </div>
          </dl>

          {lastRepositorySync?.status === "FAILED" && lastRepositorySync.errorMessage ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {lastRepositorySync.errorMessage}
            </p>
          ) : null}

          <div className="mt-4 text-sm">
            <Link className="font-semibold text-slate-900 underline" href="/admin/repositories">
              Manage repository sync
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">Daily summaries</h2>
          <p className="mt-2 text-sm text-slate-600">
            Optional narratives are generated after each local day ends. Activity metrics remain
            deterministic and available even when summaries are disabled.
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">
                {summaryStatus.enabled ? "Enabled" : "Disabled"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Private metadata opt-in</dt>
              <dd className="font-medium text-slate-900">
                {summaryStatus.allowPrivateMetadataForLlm ? "Allowed" : "Not allowed"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Provider</dt>
              <dd className="text-right font-medium text-slate-900">
                {summaryStatus.provider || "Not configured"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Succeeded / failed</dt>
              <dd className="font-medium text-slate-900">
                {summaryStatus.counts.succeeded} / {summaryStatus.counts.failed}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last generated</dt>
              <dd className="text-right font-medium text-slate-900">
                {summaryStatus.latestGeneratedAt
                  ? formatDate(new Date(summaryStatus.latestGeneratedAt))
                  : "Never"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 text-sm">
            <Link className="font-semibold text-slate-900 underline" href="/admin/settings">
              Configure summaries
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <PlaceholderPanel title="Admin security boundary" milestone="Milestone 2">
          The admin UI is never a security boundary. Every query and mutation is enforced in
          server-side tenant-scoped services.
        </PlaceholderPanel>
      </div>
    </div>
  );
}
