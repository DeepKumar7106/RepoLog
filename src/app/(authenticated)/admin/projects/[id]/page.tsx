import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
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

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title={projectDto.displayTitle}
        description={`${projectDto.repository.fullName} \u00b7 One project maps to one tracked repository.`}
        actions={
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
            href="/admin/projects"
          >
            All projects
          </Link>
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
