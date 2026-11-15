import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderGit2,
  GitCommitHorizontal,
  Settings,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityDayDetails } from "@/components/activity/activity-day-details";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { DailySummaryCard } from "@/components/activity/daily-summary-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { dateParamSchema, publicActivityQuerySchema } from "@/lib/validation/schemas";
import { env } from "@/lib/validation/env";
import { absolutePublicUrl, publicProjectPath } from "@/lib/urls/public-urls";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/ui/format";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

type PageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
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

  const [connection, counts, activityMetrics, lastSync, projectRecords, summarySettings] =
    await Promise.all([
      services.githubConnection.get(tenant),
      services.userRepositories.counts(tenant),
      services.userRepositories.metrics(tenant),
      services.syncRuns.lastRepositorySync(tenant),
      services.projects.list(tenant),
      services.userSettings.get(tenant),
    ]);
  const projects = projectRecords.map(toProjectDto);
  const publicProjectCount = projects.filter((project) => project.visibility === "PUBLIC").length;
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
  const summary = selectedDate
    ? await services.summaries.getDaySummary(tenant, selectedDate)
    : null;
  const displayName = session.displayName ?? session.githubLogin;
  const syncInProgress = activityMetrics.backfilling > 0 || activityMetrics.running > 0;

  const metrics = [
    {
      label: "Tracked repositories",
      value: formatNumber(counts.tracked),
      detail: `${formatNumber(counts.total)} discovered`,
      icon: FolderGit2,
    },
    {
      label: "Qualifying commits",
      value: formatNumber(activityMetrics.commits),
      detail: "Default branch, authored by you",
      icon: GitCommitHorizontal,
    },
    {
      label: "Active days",
      value: formatNumber(activityMetrics.activeDays),
      detail: "Days with qualifying commits",
      icon: CalendarDays,
    },
    {
      label: "Public projects",
      value: formatNumber(publicProjectCount),
      detail: `${formatNumber(counts.publicDisplay)} public repositories`,
      icon: FolderGit2,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Private workspace"
        title={`Welcome, ${displayName}`}
        description="Your project overview, development timeline and sync health in one place."
        actions={
          <>
            <Link
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-canvas px-3 text-xs font-medium text-primary transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              href="/admin/repositories"
            >
              Repositories
            </Link>
            <Link
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none"
              href="/admin/settings"
            >
              <Settings aria-hidden="true" className="h-3.5 w-3.5" />
              Settings
            </Link>
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {connection.connected ? (
          <Alert
            tone="success"
            action={
              <Link
                className="inline-flex h-8 items-center rounded-md border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-950"
                href="/admin/repositories"
              >
                Manage repositories
              </Link>
            }
          >
            GitHub is connected. Discover repositories, enable tracking, then sync commit history.
          </Alert>
        ) : (
          <Alert
            action={
              <a
                className="inline-flex h-8 items-center rounded-md border border-amber-300/60 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950"
                href="/api/auth/github/start?mode=reconnect"
              >
                Reconnect GitHub
              </a>
            }
            tone="warning"
          >
            GitHub is disconnected. Existing imported data is retained, but syncing is stopped until
            you reconnect.
          </Alert>
        )}
        {syncInProgress ? (
          <Alert
            action={
              <Link
                className="inline-flex h-8 items-center rounded-md border border-line bg-canvas px-3 text-xs font-medium text-primary hover:bg-hover"
                href="/admin/repositories"
              >
                View sync status
              </Link>
            }
            tone="info"
          >
            <span className="mr-2 inline-flex h-2 w-2 align-middle">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-sky-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            {activityMetrics.backfilling > 0
              ? `Backfilling ${formatNumber(activityMetrics.backfilling)} of ${formatNumber(
                  counts.tracked,
                )} repositories`
              : `${formatNumber(activityMetrics.running)} sync${
                  activityMetrics.running === 1 ? "" : "s"
                } running`}
            . Timeline totals may be incomplete until backfill completes.
          </Alert>
        ) : null}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div className="bg-canvas px-4 py-4" key={metric.label}>
              <dt className="flex items-center gap-1.5 text-[11px] text-muted">
                <Icon aria-hidden="true" className="h-3 w-3" />
                {metric.label}
              </dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
                {metric.value}
              </dd>
              <dd className="mt-0.5 truncate text-[11px] text-secondary">{metric.detail}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-primary">Project overview</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                {projects.length} project{projects.length === 1 ? "" : "s"} from tracked
                repositories
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-1 rounded text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              href="/admin/projects"
            >
              Manage
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="p-5">
              <EmptyState
                className="border-0 bg-transparent py-8"
                description="Enable tracking for a repository to create a project automatically."
                icon={<FolderGit2 aria-hidden="true" className="h-4 w-4" />}
                title="No projects yet"
                action={
                  <Link
                    className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg"
                    href="/admin/repositories"
                  >
                    Find repositories
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {projects.map((project) => (
                <li className="px-5 py-3.5" key={project.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        href={`/admin/projects/${project.id}`}
                      >
                        {project.displayTitle}
                      </Link>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                        {project.repository.fullName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <StatusPill status={project.status} />
                      <VisibilityBadge visibility={project.visibility} />
                    </div>
                  </div>
                  {project.shortDescription ? (
                    <p className="mt-1.5 line-clamp-1 text-xs text-secondary">
                      {project.shortDescription}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <GitCommitHorizontal aria-hidden="true" className="h-3 w-3" />
                      {formatNumber(project.commitCount)} commit
                      {project.commitCount === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      Latest commit {formatDateTime(project.latestCommitAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      First commit {formatDateTime(project.firstCommitAt)}
                    </span>
                    {project.visibility === "PUBLIC" && session.profileVisibility === "PUBLIC" ? (
                      <a
                        className="inline-flex items-center gap-1 font-medium text-secondary hover:text-primary"
                        href={absolutePublicUrl(
                          publicProjectPath(session.profileSlug, project.slug),
                          env.APP_BASE_URL,
                        )}
                      >
                        Public page
                        <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-canvas">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold text-primary">Sync health</h2>
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
            <div className="space-y-3 p-5">
              {activityMetrics.backfilling > 0 ? (
                <p className="flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-400">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {activityMetrics.backfilling} tracked{" "}
                  {activityMetrics.backfilling === 1 ? "repository is" : "repositories are"} still
                  backfilling. Timeline totals may be incomplete.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-xs leading-5 text-secondary">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                  />
                  All tracked repositories have completed their initial backfill.
                </p>
              )}

              {activityMetrics.running > 0 ? (
                <p className="text-xs text-secondary">
                  {activityMetrics.running} sync {activityMetrics.running === 1 ? "is" : "are"}{" "}
                  running now.
                </p>
              ) : null}

              {activityMetrics.failed > 0 ? (
                <p className="text-xs leading-5 text-red-600 dark:text-red-400">
                  {activityMetrics.failed} tracked{" "}
                  {activityMetrics.failed === 1 ? "repository has" : "repositories have"} a failed
                  sync. Open repository sync for safe error details.
                </p>
              ) : null}

              <dl className="space-y-2 border-t border-line pt-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Last repository sync</dt>
                  <dd className="text-right font-medium text-primary">
                    {lastSync ? relativeTime(lastSync.finishedAt ?? lastSync.startedAt) : "Never"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Repository</dt>
                  <dd className="max-w-[60%] truncate text-right font-mono text-[11px] text-secondary">
                    {lastSync?.userRepository?.githubRepository.fullName ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <Badge
                      dot
                      tone={
                        lastSync?.status === "SUCCEEDED"
                          ? "success"
                          : lastSync?.status === "FAILED"
                            ? "danger"
                            : lastSync?.status === "PARTIAL"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {lastSync?.status ?? "No runs"}
                    </Badge>
                  </dd>
                </div>
              </dl>

              <Link
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                href="/admin/repositories"
              >
                Review repository sync
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-primary">Next steps</h2>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link
                  className="flex items-center justify-between gap-2 rounded text-secondary hover:text-primary"
                  href="/admin/projects"
                >
                  Refine project titles and visibility
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link
                  className="flex items-center justify-between gap-2 rounded text-secondary hover:text-primary"
                  href={`/u/${session.profileSlug}`}
                >
                  Preview your public profile
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link
                  className="flex items-center justify-between gap-2 rounded text-secondary hover:text-primary"
                  href="/admin/settings"
                >
                  Review privacy and summaries
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              </li>
            </ul>
          </section>
        </div>
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
          {selectedDate ? (
            <DailySummaryCard
              canRegenerate={summarySettings.summariesEnabled}
              date={selectedDate}
              projects={projects.map((project) => ({
                id: project.id,
                displayTitle: project.displayTitle,
                href: `/admin/projects/${project.id}`,
              }))}
              regenerateScope={summarySettings.allowPrivateMetadataForLlm ? "PRIVATE" : "PUBLIC"}
              summary={summary}
              timezone={activity.timezone}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          description="Track a repository and run a sync to start building your timeline."
          icon={<CalendarDays aria-hidden="true" className="h-4 w-4" />}
          title="No activity yet"
        />
      )}
    </div>
  );
}
