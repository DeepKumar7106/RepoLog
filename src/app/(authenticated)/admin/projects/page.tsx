import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { absolutePublicUrl, publicProjectPath } from "@/lib/urls/public-urls";
import { env } from "@/lib/validation/env";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Not synced";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function AdminProjectsPage() {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);

  await services.projects.ensureForTrackedRepositories(tenant);

  const [projectRecords, counts] = await Promise.all([
    services.projects.list(tenant),
    services.userRepositories.counts(tenant),
  ]);
  const projects = projectRecords.map(toProjectDto);
  const publicCount = projects.filter((project) => project.visibility === "PUBLIC").length;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Projects"
        description="One project maps to one tracked repository for this user. Status and visibility are controlled here."
        actions={
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
            href="/admin/repositories"
          >
            Manage repositories
          </Link>
        }
      />

      {session.profileVisibility === "PRIVATE" ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Your profile is private. Public project settings are saved, but public URLs stay
            unreachable until you publish your profile.
          </p>
          <Link className="font-semibold underline" href="/admin/settings">
            Open settings
          </Link>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{projects.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Public projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{publicCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Tracked repositories</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.tracked}</p>
        </Card>
      </div>

      {projects.length === 0 ? (
        <Card>
          <h2 className="font-semibold text-slate-900">No projects yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enable tracking for a repository in Admin, then refresh this page. A private project is
            created automatically for every tracked repository.
          </p>
          <Link
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            href="/admin/repositories"
          >
            Track repositories
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const publicUrl = absolutePublicUrl(
              publicProjectPath(session.profileSlug, project.slug),
              env.APP_BASE_URL,
            );

            return (
              <Card key={project.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-slate-900">
                        {project.displayTitle}
                      </h2>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {project.visibility}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {project.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{project.repository.fullName}</p>
                    {project.shortDescription ? (
                      <p className="mt-2 max-w-3xl text-sm text-slate-600">
                        {project.shortDescription}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500">
                      Last commit: {formatDate(project.latestCommitAt)}
                      {project.publicReadmeUpdatedAt
                        ? ` \u00b7 Public overview updated ${formatDate(project.publicReadmeUpdatedAt)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                    <Link
                      className="font-semibold text-slate-900 underline"
                      href={`/admin/projects/${project.id}`}
                    >
                      Edit
                    </Link>
                    <Link
                      className="font-medium text-slate-600 underline"
                      href={publicUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
