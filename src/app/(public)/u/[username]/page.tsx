import { ArrowUpRight, CalendarDays, GitCommitHorizontal, FolderGit2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityDayDetails } from "@/components/activity/activity-day-details";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { DailySummaryCard } from "@/components/activity/daily-summary-card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { env } from "@/lib/validation/env";
import { dateParamSchema, publicActivityQuerySchema } from "@/lib/validation/schemas";
import { absolutePublicUrl, publicProfilePath, publicProjectPath } from "@/lib/urls/public-urls";
import { formatDate, formatRange, formatNumber } from "@/lib/ui/format";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readActivityQuery(searchParams: Record<string, string | string[] | undefined>) {
  return {
    from: single(searchParams.from),
    to: single(searchParams.to),
    project: single(searchParams.project),
  };
}

function profileTitle(profile: { displayName: string | null; githubLogin: string }): string {
  return profile.displayName ?? profile.githubLogin;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await services.publicProfiles.findProfileBySlug(username);

  if (!profile) {
    return { title: "Profile not found", robots: { index: false, follow: false } };
  }

  const title = `${profileTitle(profile)} (@${profile.profileSlug})`;
  const description =
    profile.profileBio ?? `Projects and development activity from @${profile.profileSlug}.`;
  const canonical = absolutePublicUrl(publicProfilePath(profile.profileSlug), env.APP_BASE_URL);
  const image = absolutePublicUrl(
    `/api/og?type=profile&username=${encodeURIComponent(profile.profileSlug)}`,
    env.APP_BASE_URL,
  );

  return {
    title,
    description,
    alternates: { canonical },
    robots: profile.searchIndexingEnabled ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "profile",
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

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const rawSearchParams = await searchParams;
  const profile = await services.publicProfiles.findProfileBySlug(username);

  if (!profile) {
    notFound();
  }

  const query = readActivityQuery(rawSearchParams);
  const parsedQuery = publicActivityQuerySchema.safeParse(query);
  const activityOptions = parsedQuery.success
    ? {
        from: parsedQuery.data.from,
        to: parsedQuery.data.to,
        projectSlug: parsedQuery.data.project,
      }
    : {};
  const activity = await services.publicProfiles.getActivity(username, activityOptions);

  if (!activity) {
    notFound();
  }

  const rawDate = single(rawSearchParams.date);
  const parsedDate = rawDate ? dateParamSchema.safeParse(rawDate) : null;
  const selectedDate = parsedDate?.success ? parsedDate.data : null;
  const day = selectedDate
    ? await services.publicProfiles.getDay(username, selectedDate, {
        projectSlug: activityOptions.projectSlug,
      })
    : null;

  if (selectedDate && !day) {
    notFound();
  }

  const summary = selectedDate
    ? await services.summaries.getPublicDaySummary(profile.profileSlug, selectedDate)
    : null;
  const profileUrl = absolutePublicUrl(publicProfilePath(profile.profileSlug), env.APP_BASE_URL);
  const description =
    profile.profileBio ?? `Projects and development activity from @${profile.profileSlug}.`;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {profile.avatarUrl ? (
            <Image
              alt=""
              className="h-16 w-16 rounded-full border border-line"
              height={64}
              priority
              src={profile.avatarUrl}
              unoptimized
              width={64}
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-lg font-semibold text-secondary">
              {profileTitle(profile).charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
              Public profile
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              {profileTitle(profile)}
            </h1>
            <p className="mt-1 font-mono text-xs text-secondary">@{profile.profileSlug}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton label="Share profile" size="sm" url={profileUrl} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {[
          {
            label: "Qualifying commits",
            value: formatNumber(activity.totals.commits),
            detail: <span>{activity.totals.commits} qualifying commits</span>,
            icon: GitCommitHorizontal,
          },
          {
            label: "Active days",
            value: formatNumber(activity.totals.activeDays),
            detail: "Days with activity",
            icon: CalendarDays,
          },
          {
            label: "Projects",
            value: formatNumber(activity.totals.projectCount),
            detail: "Active in range",
            icon: FolderGit2,
          },
          {
            label: "Range",
            value: formatRange(activity.from, activity.to),
            detail: activity.timezone,
            icon: CalendarDays,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="bg-canvas px-4 py-4" key={stat.label}>
              <dt className="flex items-center gap-1.5 text-[11px] text-muted">
                <Icon aria-hidden="true" className="h-3 w-3" />
                {stat.label}
              </dt>
              <dd className="mt-1.5 truncate text-xl font-semibold tracking-tight text-primary tabular-nums">
                {stat.value}
              </dd>
              <dd className="mt-0.5 truncate text-[11px] text-secondary">{stat.detail}</dd>
            </div>
          );
        })}
      </dl>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary">Projects</h2>
            <p className="mt-1 text-xs text-secondary">
              {profile.projects.length} published project{profile.projects.length === 1 ? "" : "s"}
            </p>
          </div>
          {activity.totals.latestCommitAt ? (
            <p className="hidden text-[11px] text-muted sm:block">
              Latest commit {formatDate(activity.totals.latestCommitAt)}
            </p>
          ) : null}
        </div>

        {profile.projects.length === 0 ? (
          <EmptyState
            description="This profile has no published projects yet."
            icon={<FolderGit2 aria-hidden="true" className="h-4 w-4" />}
            title="No public projects yet"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.projects.map((project) => (
              <Link
                className="group flex h-full flex-col justify-between rounded-lg border border-line bg-canvas p-4 transition-colors hover:border-line-strong hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                href={publicProjectPath(profile.profileSlug, project.slug)}
                key={project.slug}
                prefetch={false}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-primary">{project.displayTitle}</h3>
                    <StatusPill status={project.status} />
                  </div>
                  {project.shortDescription ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-secondary">
                      {project.shortDescription}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-[11px] text-muted">
                    {project.firstCommitAt || project.latestCommitAt
                      ? `Active ${formatRange(project.firstCommitAt, project.latestCommitAt)}`
                      : "No qualifying commits yet"}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary transition-colors group-hover:text-primary">
                    View
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ActivityTimeline
        basePath={publicProfilePath(profile.profileSlug)}
        days={activity.days}
        from={activity.from}
        projects={activity.projects}
        projectSlug={activityOptions.projectSlug}
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

      {selectedDate && summary ? (
        <DailySummaryCard
          date={selectedDate}
          projects={profile.projects.map((project) => ({
            id: project.id,
            displayTitle: project.displayTitle,
            href: publicProjectPath(profile.profileSlug, project.slug),
          }))}
          summary={summary}
          timezone={activity.timezone}
        />
      ) : null}
    </div>
  );
}
