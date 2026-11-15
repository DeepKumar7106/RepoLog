import { ArrowUpRight, FolderGit2, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { absolutePublicUrl, publicProjectPath } from "@/lib/urls/public-urls";
import { env } from "@/lib/validation/env";
import { formatDate, formatNumber } from "@/lib/ui/format";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
};

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
        eyebrow="Workspace"
        title="Projects"
        description="Each project maps to one tracked repository. Control the public story, status and visibility here."
        actions={
          <Link
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            href="/admin/repositories"
          >
            <FolderGit2 aria-hidden="true" className="h-3.5 w-3.5" />
            Repositories
          </Link>
        }
      />

      {session.profileVisibility === "PRIVATE" ? (
        <Alert
          action={
            <Link
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
              href="/admin/settings"
            >
              <Settings aria-hidden="true" className="h-3.5 w-3.5" />
              Open settings
            </Link>
          }
          className="mb-6"
          tone="warning"
        >
          Your profile is currently private. Public projects will return 404 to visitors until you
          publish your profile.
        </Alert>
      ) : null}

      <dl className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Projects</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(projects.length)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Public projects</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(publicCount)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Tracked repositories</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(counts.tracked)}
          </dd>
        </div>
      </dl>

      {projects.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonVariants({ size: "sm" })} href="/admin/repositories">
              Track repositories
            </Link>
          }
          description="Enable tracking for a repository, then refresh this page. A private project is created automatically for every tracked repository."
          icon={<FolderGit2 aria-hidden="true" className="h-4 w-4" />}
          title="No projects yet"
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">All projects</h2>
            <span className="tabular text-[11px] text-muted">
              {projects.length} total · {publicCount} public
            </span>
          </div>
          <ul className="divide-y divide-line">
            {projects.map((project) => {
              const publicUrl = absolutePublicUrl(
                publicProjectPath(session.profileSlug, project.slug),
                env.APP_BASE_URL,
              );

              return (
                <li
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-hover/30 sm:flex-row sm:items-start sm:justify-between"
                  key={project.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        className="truncate text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        href={`/admin/projects/${project.id}`}
                      >
                        {project.displayTitle}
                      </Link>
                      <StatusPill status={project.status} />
                      <VisibilityBadge visibility={project.visibility} />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted">
                      {project.repository.fullName}
                    </p>
                    {project.shortDescription ? (
                      <p className="mt-1.5 line-clamp-2 max-w-2xl text-xs leading-5 text-secondary">
                        {project.shortDescription}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted">
                        No short description yet — add one to shape the public card.
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-muted">
                      Last commit: {formatDate(project.latestCommitAt)}
                      {project.publicReadmeUpdatedAt
                        ? ` · Public overview updated ${formatDate(project.publicReadmeUpdatedAt)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      href={`/admin/projects/${project.id}`}
                    >
                      Edit
                    </Link>
                    <Link
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      href={publicUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Preview
                      <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
