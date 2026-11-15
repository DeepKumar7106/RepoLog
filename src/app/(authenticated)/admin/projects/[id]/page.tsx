import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { absolutePublicUrl, publicProjectPath } from "@/lib/urls/public-urls";
import { env } from "@/lib/validation/env";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";
import { ProjectEditor } from "./project-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project",
};

export default async function AdminProjectDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const { id } = await params;
  const project = await services.projects.find(tenant, id);

  if (!project) {
    notFound();
  }

  const projectDto = toProjectDto(project);
  const publicUrl = absolutePublicUrl(
    publicProjectPath(session.profileSlug, projectDto.slug),
    env.APP_BASE_URL,
  );

  return (
    <div>
      <Link
        className="mb-5 inline-flex items-center gap-1.5 rounded text-xs font-medium text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        href="/admin/projects"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        All projects
      </Link>

      <PageHeader
        eyebrow="Project"
        title={projectDto.displayTitle}
        description={`${projectDto.repository.fullName} · One project maps to one tracked repository.`}
        actions={
          <>
            <Link
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              href="/admin/repositories"
            >
              Repositories
            </Link>
            <a
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              href={publicUrl}
              rel="noreferrer"
              target="_blank"
            >
              Public preview
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          </>
        }
      />

      <ProjectEditor
        appBaseUrl={env.APP_BASE_URL}
        profileSlug={session.profileSlug}
        profileVisibility={session.profileVisibility}
        project={projectDto}
      />
    </div>
  );
}