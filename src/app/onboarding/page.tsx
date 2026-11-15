import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { requireSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { toUserRepositoryDto } from "@/server/dto/user-repository-dto";
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
  const [user, connection, repositories] = await Promise.all([
    services.userProfile.get(tenant),
    services.githubConnection.get(tenant),
    services.userRepositories.list(tenant),
  ]);
  const displayName = user.displayName ?? user.githubLogin;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-muted sm:inline">
              @{user.githubLogin}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
            First-run setup
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Welcome, {displayName}
          </h1>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Connect GitHub, shape your public identity, and choose the repositories that become
            projects. Everything can be changed later.
          </p>
        </div>

        <OnboardingForm
          connected={connection.connected}
          defaultBio={user.profileBio ?? ""}
          defaultDisplayName={displayName}
          defaultSearchIndexing={user.searchIndexingEnabled}
          defaultTimezone={user.timezone}
          defaultVisibility={user.profileVisibility}
          githubLogin={user.githubLogin}
          initialRepositories={repositories.map(toUserRepositoryDto)}
          profileSlug={user.profileSlug}
          scope={connection.scope}
        />

        <p className="mt-8 text-center text-[11px] leading-5 text-muted">
          RepoLog never invents commit counts. Metrics come from imported default-branch commits you
          authored. GitHub remains the source of truth.
        </p>
      </main>
    </div>
  );
}