import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityDayDetails } from "@/components/activity/activity-day-details";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { DailySummaryCard } from "@/components/activity/daily-summary-card";
import { CopyLinkButton } from "@/components/public/copy-link-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { env } from "@/lib/validation/env";
import { dateParamSchema, publicActivityQuerySchema } from "@/lib/validation/schemas";
import { absolutePublicUrl, publicProfilePath, publicProjectPath } from "@/lib/urls/public-urls";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ username: string }>;
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
      <PageHeader
        eyebrow="Public profile"
        title={profileTitle(profile)}
        description={description}
        actions={<CopyLinkButton url={profileUrl} />}
      />

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        {profile.avatarUrl ? (
          <Image
            alt=""
            className="h-16 w-16 rounded-full border border-slate-200"
            height={64}
            src={profile.avatarUrl}
            unoptimized
            width={64}
          />
        ) : null}
        <div>
          <p className="text-sm text-slate-500">@{profile.profileSlug}</p>
          <p className="mt-1 text-sm text-slate-600">
            {activity.totals.commits} qualifying commits · {activity.totals.activeDays} active days
            · {activity.totals.projectCount} active projects in the selected range
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
        {profile.projects.length === 0 ? (
          <Card className="mt-3">
            <p className="text-sm text-slate-500">No public projects yet.</p>
          </Card>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {profile.projects.map((project) => (
              <Link href={publicProjectPath(profile.profileSlug, project.slug)} key={project.slug}>
                <Card className="h-full transition hover:border-slate-400">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{project.displayTitle}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusStyles[project.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabels[project.status] ?? project.status}
                    </span>
                  </div>
                  {project.shortDescription ? (
                    <p className="mt-2 text-sm text-slate-600">{project.shortDescription}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-slate-500">
                    {project.latestCommitAt
                      ? `Latest commit ${new Date(project.latestCommitAt).toISOString().slice(0, 10)}`
                      : "No qualifying commits yet"}
                  </p>
                </Card>
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
