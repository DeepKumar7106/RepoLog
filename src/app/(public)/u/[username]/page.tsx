import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";

export const metadata: Metadata = {
  title: "Public profile",
};

export default async function PublicProfilePage({
  params,
}: Readonly<{ params: Promise<{ username: string }> }>) {
  const { username } = await params;

  return (
    <div>
      <PageHeader
        eyebrow="Public profile"
        title={`@${username}`}
        description="Public profiles show only explicitly published fields and projects."
      />
      <PlaceholderPanel title="Public profile page" milestone="Milestone 6">
        The public profile, activity chart, daily summaries and share metadata are implemented in
        Milestone 6. Access will require both a public profile and public projects.
      </PlaceholderPanel>
    </div>
  );
}
