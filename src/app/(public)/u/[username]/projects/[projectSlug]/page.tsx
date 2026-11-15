import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityDayDetails } from "@/components/activity/activity-day-details";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { MarkdownContent } from "@/components/public/markdown-content";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusPill } from "@/components/ui/status-pill";
import { env } from "@/lib/validation/env";
import { dateParamSchema, publicActivityQuerySchema } from "@/lib/validation/schemas";
import { absolutePublicUrl, publicProfilePath, publicProjectPath } from "@/lib/urls/public-urls";
import { formatDate, formatNumber } from "@/lib/ui/format";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ username: string; projectSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const activityDetailLabels: Record<string, string> = {
  HIDDEN: "Activity hidden",
  AGGREGATED: "Daily counts",
  COMMIT_DETAILS: "Daily counts and commit details",
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, projectSlug } = await params;
  const project = await services.publicProfiles.findProjectBySlugs(username, projectSlug);

  if (!project) {
    return { title: "Project not found", robots: { index: false, follow: false } };
  }

  const title = `${project.displayTitle} by @${project.owner.profileSlug}`;
  const description =
    project.shortDescription ?? `A public project and development timeline by @${username}.`;
  const canonical = absolutePublicUrl(
    publicProjectPath(project.owner.profileSlug, project.slug),
    env.APP_BASE_URL,
  );
  const image = absolutePublicUrl(
    `/api/og?type=project&username=${encodeURIComponent(
      project.owner.profileSlug,
    )}&project=${encodeURIComponent(project.slug)}`,
    env.APP_BASE_URL,
  );

  return {
    title,
    description,
    alternates: { canonical },
    robots: project.searchIndexingEnabled ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicProjectPage({ params, searchParams }: PageProps) {
  const { username, projectSlug } = await params;
  const rawSearchParams = await searchParams;
  const project = await services.publicProfiles.findProjectBySlugs(username, projectSlug);

  if (!project) {
    notFound();
  }

  const parsedQuery = publicActivityQuerySchema.safeParse({
    from: single(rawSearchParams.from),
    to: single(rawSearchParams.to),
  });
  const activityOptions = parsedQuery.success
    ? { from: parsedQuery.data.from, to: parsedQuery.data.to }
    : {};
  const activity = await services.publicProfiles.getActivity(username, {
    ...activityOptions,
    projectSlug: project.slug,
  });

  if (!activity) {
    notFound();
  }

  const rawDate = single(rawSearchParams.date);
  const parsedDate = rawDate ? dateParamSchema.safeParse(rawDate) : null;
  const selectedDate = parsedDate?.success ? parsedDate.data : null;
  const day = selectedDate
    ? await services.publicProfiles.getDay(username, selectedDate, {
        projectSlug: project.slug,
      })
    : null;

  if (selectedDate && !day) {
    notFound();
  }

  const projectUrl = absolutePublicUrl(
    publicProjectPath(project.owner.profileSlug, project.slug),
    env.APP_BASE_URL,
  );
  const ownerName = project.owner.displayName ?? project.owner.githubLogin;

  return (
    <div className="space-y-8">
      <Link
        className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        href={publicProfilePath(project.owner.profileSlug)}
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Back to @{project.owner.profileSlug}
      </Link>

      <header className="border-b border-line pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={project.status} />
          <span className="text-[11px] text-muted">
            {activityDetailLabels[project.activityDetail] ?? "Daily counts"}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
              {project.displayTitle}
            </h1>
            {project.shortDescription ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
                {project.shortDescription}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <CopyButton label="Share project" size="sm" url={projectUrl} />
            {project.demoUrl ? (
              <a
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-canvas px-3 text-xs font-medium text-primary transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                href={project.demoUrl}
                rel="noreferrer"
                target="_blank"
              >
                Live demo
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-secondary">
          <Link
            className="inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            href={publicProfilePath(project.owner.profileSlug)}
          >
            {project.owner.avatarUrl ? (
              <Image
                alt=""
                className="h-5 w-5 rounded-full border border-line"
                height={20}
                src={project.owner.avatarUrl}
                unoptimized
                width={20}
              />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-[9px] font-semibold">
                {ownerName.charAt(0).toUpperCase()}
              </span>
            )}
            @{project.owner.profileSlug}
          </Link>
          {project.repository ? (
            <a
              className="inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              href={project.repository.htmlUrl}
              rel="noreferrer"
              target="_blank"
            >
              <GitBranch aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
              {project.repository.fullName}
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          ) : null}
          {project.firstCommitAt ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
              Started {formatDate(project.firstCommitAt)}
            </span>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <div className="bg-canvas px-4 py-4">
          <dt className="flex items-center gap-1.5 text-[11px] text-muted">
            <CalendarDays aria-hidden="true" className="h-3 w-3" />
            First qualifying commit
          </dt>
          <dd className="mt-1.5 text-base font-semibold tracking-tight text-primary tabular-nums">
            {formatDate(project.firstCommitAt)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="flex items-center gap-1.5 text-[11px] text-muted">
            <CalendarDays aria-hidden="true" className="h-3 w-3" />
            Latest activity
          </dt>
          <dd className="mt-1.5 text-base font-semibold tracking-tight text-primary tabular-nums">
            {formatDate(project.latestCommitAt)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="flex items-center gap-1.5 text-[11px] text-muted">
            <GitCommitHorizontal aria-hidden="true" className="h-3 w-3" />
            Total qualifying commits
          </dt>
          <dd className="mt-1.5 text-base font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(project.totalCommits)}
          </dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.75fr)]">
        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className="text-sm font-semibold text-primary">README</h2>
            <span className="font-mono text-[10px] text-muted">Published excerpt</span>
          </div>
          <div className="p-5">
            {project.readmeMarkdown ? (
              <MarkdownContent markdown={project.readmeMarkdown} />
            ) : (
              <p className="text-sm text-secondary">No public README has been published.</p>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-lg border border-line bg-canvas p-5">
            <h2 className="text-sm font-semibold text-primary">Project details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-secondary">Status</dt>
                <dd>
                  <StatusPill status={project.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <dt className="text-xs text-secondary">First commit</dt>
                <dd className="tabular text-xs font-medium text-primary">
                  {formatDate(project.firstCommitAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <dt className="text-xs text-secondary">Latest commit</dt>
                <dd className="tabular text-xs font-medium text-primary">
                  {formatDate(project.latestCommitAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <dt className="text-xs text-secondary">Activity</dt>
                <dd className="text-right text-xs font-medium text-primary">
                  {activityDetailLabels[project.activityDetail] ?? "Daily counts"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <FolderGit2 aria-hidden="true" className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-primary">Owner</h2>
            </div>
            <p className="mt-3 text-sm font-medium text-primary">{ownerName}</p>
            <Link
              className="mt-1 inline-flex items-center gap-1 rounded font-mono text-xs text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              href={publicProfilePath(project.owner.profileSlug)}
            >
              @{project.owner.profileSlug}
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </section>
        </aside>
      </div>

      <ActivityTimeline
        basePath={publicProjectPath(project.owner.profileSlug, project.slug)}
        days={activity.days}
        from={activity.from}
        projects={activity.projects}
        projectSlug={project.slug}
        selectedDate={selectedDate}
        showProjectFilter={false}
        timezone={activity.timezone}
        title="Project activity"
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
  );
}
