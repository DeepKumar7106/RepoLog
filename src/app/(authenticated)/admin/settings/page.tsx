import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const [user, authorEmails, settings, projects, connection] = await Promise.all([
    services.userProfile.get(tenant),
    services.authorEmails.list(tenant),
    services.userSettings.get(tenant),
    services.projects.list(tenant),
    services.githubConnection.get(tenant),
  ]);
  const hasPublicProjects = projects.some((project) => project.visibility === "PUBLIC");

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Manage your public profile, privacy, timezone, daily summaries and the verified author emails used for commit matching."
      />

      {user.profileVisibility === "PRIVATE" && hasPublicProjects ? (
        <Alert
          action={
            <Link
              className={buttonVariants({ size: "sm", variant: "secondary" })}
              href="/admin/settings#profile"
            >
              Publish profile
            </Link>
          }
          className="mb-6"
          tone="warning"
        >
          Your profile is currently private. Public projects will return 404 to visitors until you
          publish your profile.
        </Alert>
      ) : null}

      <SettingsForm
        appBaseUrl={env.APP_BASE_URL}
        authorEmails={authorEmails.map(toAuthorEmailDto)}
        profile={toUserProfileDto(user)}
        settings={toUserSettingsDto(settings)}
      />

      <section className="mt-6 rounded-lg border border-red-200 bg-canvas dark:border-red-900/60">
        <div className="border-b border-red-200 px-5 py-3.5 dark:border-red-900/60">
          <h2 className="text-sm font-semibold text-primary">Account</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Disconnecting pauses syncing while preserving imported history.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-xl text-xs leading-5 text-secondary">
            {connection.connected
              ? "Revoke RepoLog's GitHub access. Existing repositories, projects and commits stay in your workspace, but no new activity is imported until you reconnect."
              : "GitHub is not connected. Reconnect from the dashboard to resume discovery and syncing."}
          </p>
          {connection.connected ? (
            <form action="/api/auth/github/disconnect" method="post">
              <Button size="sm" type="submit" variant="danger">
                Disconnect GitHub account
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
