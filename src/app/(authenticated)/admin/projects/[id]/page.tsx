import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";

export const metadata: Metadata = {
  title: "Project",
};

export default async function AdminProjectDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Project editor"
        description="Project details will be loaded through a tenant-scoped service using the authenticated user."
      />
      <PlaceholderPanel title={`Project ${id}`} milestone="Milestone 5">
        This route exists so the project editor can be added without changing the URL structure.
      </PlaceholderPanel>
    </div>
  );
}
