import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";

export const metadata: Metadata = {
  title: "Projects",
};

export default function AdminProjectsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Projects"
        description="One project maps to one tracked repository for this user. Status and visibility are controlled here."
      />
      <PlaceholderPanel title="Project management" milestone="Milestone 5">
        Status, display title, description, slug, demo URL and privacy controls are implemented in
        Milestone 5. New projects remain private by default.
      </PlaceholderPanel>
    </div>
  );
}
