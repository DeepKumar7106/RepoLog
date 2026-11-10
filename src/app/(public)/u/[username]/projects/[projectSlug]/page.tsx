import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";

export const metadata: Metadata = {
  title: "Public project",
};

export default async function PublicProjectPage({
  params,
}: Readonly<{ params: Promise<{ username: string; projectSlug: string }> }>) {
  const { username, projectSlug } = await params;

  return (
    <div>
      <PageHeader
        eyebrow="Public project"
        title={`@${username} / ${projectSlug}`}
        description="Public project pages use an explicit allowlist of approved fields."
      />
      <PlaceholderPanel title="Public project page" milestone="Milestone 6">
        Project details, approved README content, activity and share metadata are implemented in
        Milestone 6. Private repository metadata is never rendered here.
      </PlaceholderPanel>
    </div>
  );
}
