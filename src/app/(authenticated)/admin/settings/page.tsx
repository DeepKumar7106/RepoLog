import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";

export const metadata: Metadata = {
  title: "Settings",
};

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Profile, privacy, timezone, verified author emails and summary preferences will be managed here."
      />
      <PlaceholderPanel title="Profile and privacy settings" milestone="Milestone 5">
        Profiles start private. Publishing, indexing and project-level visibility are implemented in
        Milestone 5.
      </PlaceholderPanel>
      <div className="mt-4">
        <PlaceholderPanel title="Author emails and summaries" milestone="Milestone 4 / 7">
          Verified author email fallback and optional daily summary settings are implemented in
          later milestones.
        </PlaceholderPanel>
      </div>
    </div>
  );
}
