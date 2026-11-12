import type { Metadata } from "next";
import Link from "next/link";
import { ActivityDayDetails } from "@/components/activity/activity-day-details";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { dateParamSchema, publicActivityQuerySchema } from "@/lib/validation/schemas";
import { env } from "@/lib/validation/env";
import { absolutePublicUrl, publicProjectPath } from "@/lib/urls/public-urls";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

type PageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const statusStyles: Record<string, string> = {
  ONGOING: "bg-emerald-100 text-emerald-800",
  COMPLETE: "bg-sky-100 text-sky-800",
  ON_BREAK: "bg-amber-100 text-amber-800",
};

const statusLabels: Record<string, string> = {
  ONGOING: "Ongoing",
  COMPLETE: "Complete",
  ON_BREAK: "On break",
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatDate(value: Date | string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: typeof value === "string" ? undefined : "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const rawSearchParams = await searchParams;
  const parsedQuery = publicActivityQuerySchema.safeParse({
    from: single(rawSearchParams.from),
    to: single(rawSearchParams.to),
    project: single(rawSearchParams.project),
  });
  const activityOptions = parsedQuery.success
    ? {
        from: parsedQuery.data.from,
        to: parsedQuery.data.to,
        projectSlug: parsedQuery.data.project,
      }
    : {};
  const rawDate = single(rawSearchParams.date);
  const parsedDate = rawDate ? dateParamSchema.safeParse(rawDate) : null;
  const selectedDate = parsedDate?.success ? parsedDate.data : null;

  await services.projects.ensureForTrackedRepositories(tenant);

  const [connection, counts, activityMetrics, lastSync, projectRecords] = await Promise.all([
    services.githubConnection.get(tenant),
    services.userRepositories.counts(tenant),
    services.userRepositories.metrics(tenant),
    services.syncRuns.lastRepositorySync(tenant),
    services.projects.list(tenant),
  ]);
  const projects = projectRecords.map(toProjectDto);
  const activity =
    (await services.activity.summary(tenant, activityOptions)) ??
    (await services.activity.summary(tenant));
  const activeProjectSlug = activity?.projects.some(
    (project) => project.slug === activityOptions.projectSlug,
  )
    ? activityOptions.projectSlug
    : undefined;
  const day =
    activity && selectedDate
      ? await services.activity.day(tenant, selectedDate, {
          projectSlug: activeProjectSlug,
        })
      : null;
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
        description="Your project overview, activity timeline and sync progress."
        actions={
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
            href="/admin/settings"
          >
            Settings
          </Link>
        }
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

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Project overview</h2>
            <Link className="text-sm font-semibold text-slate-900 underline" href="/admin/projects">
              Manage projects
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No projects yet. Enable tracking for a repository to create one.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {projects.map((project) => (
                <li className="rounded-xl border border-slate-200 p-3" key={project.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        className="font-semibold text-slate-900 underline"
                        href={`/admin/projects/${project.id}`}
                      >
                        {project.displayTitle}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{project.repository.fullName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          statusStyles[project.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabels[project.status] ?? project.status}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {project.visibility}
                      </span>
                    </div>
                  </div>
                  {project.shortDescription ? (
                    <p className="mt-2 text-sm text-slate-600">{project.shortDescription}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Latest commit: {formatDate(project.latestCommitAt)}</span>
                    {project.visibility === "PUBLIC" && session.profileVisibility === "PUBLIC" ? (
                      <a
                        className="font-semibold text-slate-700 underline"
                        href={absolutePublicUrl(
                          publicProjectPath(session.profileSlug, project.slug),
                          env.APP_BASE_URL,
                        )}
                      >
                        Public page
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

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
      </div>

      {activity ? (
        <div className="space-y-6">
          <ActivityTimeline
            basePath="/dashboard"
            days={activity.days}
            from={activity.from}
            projects={activity.projects}
            projectSlug={activeProjectSlug}
            selectedDate={selectedDate}
            timezone={activity.timezone}
            to={activity.to}
          />
          {day ? (
            <ActivityDayDetails
              commits={day.commits}
              date={day.date}
              projects={day.projects}
              timezone={day.timezone}
              totalCommits={day.totalCommits}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <PlaceholderPanel title="Daily summaries" milestone="Milestone 7">
          Optional LLM narratives will be stored per user and day without blocking the deterministic
          metrics.
        </PlaceholderPanel>
      </div>
    </div>
  );
}
