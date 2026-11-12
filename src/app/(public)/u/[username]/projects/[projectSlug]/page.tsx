import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityDayDetails } from "@/components/activity/activity-day-details";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { CopyLinkButton } from "@/components/public/copy-link-button";
import { MarkdownContent } from "@/components/public/markdown-content";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { dateParamSchema, publicActivityQuerySchema } from "@/lib/validation/schemas";
import { env } from "@/lib/validation/env";
import { absolutePublicUrl, publicProfilePath, publicProjectPath } from "@/lib/urls/public-urls";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ username: string; projectSlug: string }>;
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

function formatDate(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "Not available";
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

  return (
    <div className="space-y-8">
      <div>
        <Link
          className="text-sm font-medium text-slate-600 underline"
          href={publicProfilePath(project.owner.profileSlug)}
        >
          Back to @{project.owner.profileSlug}
        </Link>
      </div>

      <PageHeader
        eyebrow="Public project"
        title={project.displayTitle}
        description={project.shortDescription ?? undefined}
        actions={<CopyLinkButton url={projectUrl} />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusStyles[project.status] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {statusLabels[project.status] ?? project.status}
            </span>
            <span className="text-xs text-slate-500">
              Activity detail: {project.activityDetail.toLowerCase().replaceAll("_", " ")}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">First qualifying commit</dt>
              <dd className="font-medium text-slate-900">{formatDate(project.firstCommitAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Latest qualifying commit</dt>
              <dd className="font-medium text-slate-900">{formatDate(project.latestCommitAt)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {project.demoUrl ? (
              <a
                className="font-semibold text-slate-900 underline"
                href={project.demoUrl}
                rel="noreferrer"
                target="_blank"
              >
                Live demo
              </a>
            ) : null}
            {project.repository ? (
              <a
                className="font-semibold text-slate-900 underline"
                href={project.repository.htmlUrl}
                rel="noreferrer"
                target="_blank"
              >
                {project.repository.fullName} on GitHub
              </a>
            ) : null}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Owner</h2>
          <p className="mt-2 text-sm text-slate-600">
            {project.owner.displayName ?? project.owner.githubLogin}
          </p>
          <Link
            className="mt-2 inline-block text-sm font-semibold text-slate-900 underline"
            href={publicProfilePath(project.owner.profileSlug)}
          >
            @{project.owner.profileSlug}
          </Link>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">README</h2>
        <div className="mt-3">
          {project.readmeMarkdown ? (
            <MarkdownContent markdown={project.readmeMarkdown} />
          ) : (
            <p className="text-sm text-slate-500">No public README has been published.</p>
          )}
        </div>
      </Card>

      <ActivityTimeline
        basePath={publicProjectPath(project.owner.profileSlug, project.slug)}
        days={activity.days}
        from={activity.from}
        projects={activity.projects}
        projectSlug={project.slug}
        selectedDate={selectedDate}
        showProjectFilter={false}
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
  );
}
