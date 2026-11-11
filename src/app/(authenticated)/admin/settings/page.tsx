import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { env } from "@/lib/validation/env";
import { toAuthorEmailDto } from "@/server/dto/author-email-dto";
import { toUserProfileDto } from "@/server/dto/user-dto";
import { services } from "@/server/services";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const [user, authorEmails] = await Promise.all([
    services.userProfile.get(tenant),
    services.authorEmails.list(tenant),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Manage your public profile, privacy, timezone and the verified author emails used for commit matching."
      />

      <SettingsForm
        appBaseUrl={env.APP_BASE_URL}
        authorEmails={authorEmails.map(toAuthorEmailDto)}
        profile={toUserProfileDto(user)}
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Daily summary preferences are planned for a later milestone. Deterministic activity and
        project data do not depend on them.
      </div>
    </div>
  );
}
