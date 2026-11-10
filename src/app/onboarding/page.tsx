import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { services } from "@/server/services";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default async function OnboardingPage() {
  const session = await requireSessionUser();

  if (session.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  const tenant = createTenantContext(session.userId);
  const [user, connection] = await Promise.all([
    services.userProfile.get(tenant),
    services.githubConnection.get(tenant),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="First-run setup"
        title={`Welcome, ${user.displayName ?? user.githubLogin}`}
        description="Connect GitHub, choose your profile privacy, and continue to your private dashboard."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">1. GitHub connection</h2>
          <p className="mt-2 text-sm text-slate-600">
            {connection.connected
              ? "GitHub is connected. OAuth credentials are stored server-side and encrypted at rest."
              : "GitHub is not connected. Reconnect to enable repository discovery and syncing."}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">
                {connection.connected ? "Connected" : "Disconnected"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Scopes</dt>
              <dd className="max-w-[60%] text-right font-medium break-words text-slate-900">
                {connection.scope ?? "—"}
              </dd>
            </div>
          </dl>
          {!connection.connected ? (
            <Link
              className="mt-4 inline-block text-sm font-semibold text-slate-900 underline"
              href="/api/auth/github/start?mode=reconnect"
            >
              Reconnect GitHub
            </Link>
          ) : null}
          <p className="mt-4 text-xs text-slate-500">
            After you finish onboarding, open Admin → Repositories to discover and select the
            personal and organization repositories you want to track.
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">2. Profile and privacy</h2>
          <p className="mt-2 text-sm text-slate-600">
            New profiles are private by default. You can change this later.
          </p>
          <OnboardingForm
            defaultBio={user.profileBio ?? ""}
            defaultDisplayName={user.displayName ?? user.githubLogin}
            defaultSearchIndexing={user.searchIndexingEnabled}
            defaultTimezone={user.timezone}
            defaultVisibility={user.profileVisibility}
            profileSlug={user.profileSlug}
          />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">3. Repository discovery and selection</h2>
        <p className="mt-2 text-sm text-slate-600">
          After you finish onboarding, RepoLog can discover the personal and organization
          repositories your GitHub connection can access. You choose which ones to track; nothing is
          published automatically. Initial commit backfill arrives in the next milestone.
        </p>
      </Card>
    </div>
  );
}
