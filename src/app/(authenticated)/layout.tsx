import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await requireSessionUser();
  const displayName = session.displayName ?? session.githubLogin;

  return (
    <AppShell
      avatarUrl={session.avatarUrl}
      displayName={displayName}
      githubLogin={session.githubLogin}
      onboardingCompleted={session.onboardingCompletedAt !== null}
      profileSlug={session.profileSlug}
      profileVisibility={session.profileVisibility}
    >
      {children}
    </AppShell>
  );
}