import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole, Visibility } from "@/generated/prisma/client";
import {
  getLegacySessionCookieName,
  getSessionCookieName,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import {
  createSessionRecord,
  deleteSessionByToken,
  findSessionByToken,
  type SessionWithUser,
} from "@/lib/auth/session-store";
import { prisma } from "@/lib/db/prisma";
import { createTenantContext, type TenantContext } from "@/lib/tenancy/tenant-context";

export type SessionUser = Readonly<{
  userId: string;
  githubUserId: string;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileSlug: string;
  profileVisibility: Visibility;
  onboardingCompletedAt: Date | null;
  role: UserRole;
}>;

function toSessionUser(session: SessionWithUser): SessionUser {
  return {
    userId: session.user.id,
    githubUserId: session.user.githubUserId,
    githubLogin: session.user.githubLogin,
    displayName: session.user.displayName,
    avatarUrl: session.user.avatarUrl,
    profileSlug: session.user.profileSlug,
    profileVisibility: session.user.profileVisibility,
    onboardingCompletedAt: session.user.onboardingCompletedAt,
    role: session.user.role,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (!token) {
    return null;
  }

  const session = await findSessionByToken(prisma, token);

  return session ? toSessionUser(session) : null;
}

export async function getSessionTenant(): Promise<TenantContext | null> {
  const session = await getSession();

  return session ? createTenantContext(session.userId) : null;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    redirect("/?auth=required");
  }

  return session;
}

export async function requireSessionTenant(): Promise<TenantContext> {
  const session = await requireSessionUser();

  return createTenantContext(session.userId);
}

export async function requireOnboardedSessionUser(): Promise<SessionUser> {
  const session = await requireSessionUser();

  if (!session.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return session;
}

export async function createSession(userId: string): Promise<void> {
  const cookieStore = await cookies();

  for (const name of [getSessionCookieName(), getLegacySessionCookieName()]) {
    const existingToken = cookieStore.get(name)?.value;

    if (existingToken) {
      await deleteSessionByToken(prisma, existingToken);
    }

    cookieStore.delete(name);
  }

  const { token } = await createSessionRecord(prisma, userId);

  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();

  for (const name of [getSessionCookieName(), getLegacySessionCookieName()]) {
    const token = cookieStore.get(name)?.value;

    if (token) {
      await deleteSessionByToken(prisma, token);
    }

    cookieStore.delete(name);
  }
}
