import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { env } from "@/lib/validation/env";
import { toAuthorEmailDto } from "@/server/dto/author-email-dto";
import { toUserProfileDto } from "@/server/dto/user-dto";
import { toUserSettingsDto } from "@/server/dto/user-settings-dto";
import { services } from "@/server/services";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const [user, authorEmails, settings] = await Promise.all([
    services.userProfile.get(tenant),
    services.authorEmails.list(tenant),
    services.userSettings.get(tenant),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Manage your public profile, privacy, timezone, daily summaries and the verified author emails used for commit matching."
      />

      <SettingsForm
        appBaseUrl={env.APP_BASE_URL}
        authorEmails={authorEmails.map(toAuthorEmailDto)}
        profile={toUserProfileDto(user)}
        settings={toUserSettingsDto(settings)}
      />
    </div>
  );
}
