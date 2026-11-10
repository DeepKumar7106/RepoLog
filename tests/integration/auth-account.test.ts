import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashSessionToken, isEncryptedSecret } from "@/lib/auth/crypto";
import {
  disconnectGitHub,
  getDecryptedAccessToken,
  getGitHubConnection,
  GitHubNotConnectedError,
  upsertGitHubIdentity,
  type GitHubIdentityInput,
} from "@/lib/auth/github-account";
import {
  createSessionRecord,
  deleteSessionByToken,
  findSessionByToken,
} from "@/lib/auth/session-store";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { createTenantContext, TenantAccessDeniedError } from "@/lib/tenancy/tenant-context";
import { createUserProfileService } from "@/server/services/user-profile-service";
import { getTestPrisma, resetTestDatabase } from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

function identity(input: { id: number; login: string; accessToken: string }): GitHubIdentityInput {
  return {
    githubUser: {
      id: input.id,
      login: input.login,
      name: `User ${input.login}`,
      avatar_url: `https://avatars.githubusercontent.com/u/${input.id}?v=4`,
    },
    emails: [{ email: `${input.login}@example.com`, primary: true, verified: true }],
    token: {
      access_token: input.accessToken,
      token_type: "bearer",
      scope: "read:user user:email repo",
      expires_in: 3600,
    },
  };
}

describe.skipIf(!hasTestDatabase)("GitHub account lifecycle", () => {
  let prisma: AppPrismaClient;

  beforeAll(() => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a user and stores encrypted tokens", async () => {
    const { user, isNewUser } = await upsertGitHubIdentity(
      prisma,
      identity({ id: 583231, login: "octocat", accessToken: "gho_plain_token" }),
    );

    expect(isNewUser).toBe(true);
    expect(user.githubUserId).toBe("583231");
    expect(user.profileSlug).toBe("octocat");

    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } });

    expect(account.provider).toBe("github");
    expect(account.providerAccountId).toBe("583231");
    expect(account.access_token).not.toBe("gho_plain_token");
    expect(account.access_token && isEncryptedSecret(account.access_token)).toBe(true);
    expect(account.disconnectedAt).toBeNull();

    const email = await prisma.authorEmail.findFirstOrThrow({ where: { userId: user.id } });

    expect(email.email).toBe("octocat@example.com");
    expect(email.verifiedByUser).toBe(true);
  });

  it("updates the same user on later sign-ins and preserves the profile slug", async () => {
    const first = await upsertGitHubIdentity(
      prisma,
      identity({ id: 1, login: "octocat", accessToken: "token-one" }),
    );
    const second = await upsertGitHubIdentity(
      prisma,
      identity({ id: 1, login: "octocat-renamed", accessToken: "token-two" }),
    );

    expect(second.user.id).toBe(first.user.id);
    expect(second.isNewUser).toBe(false);
    expect(second.user.githubLogin).toBe("octocat-renamed");
    expect(second.user.profileSlug).toBe(first.user.profileSlug);
    expect(await getDecryptedAccessToken(prisma, createTenantContext(second.user.id))).toBe(
      "token-two",
    );
  });

  it("generates a unique profile slug when logins collide", async () => {
    const first = await upsertGitHubIdentity(
      prisma,
      identity({ id: 10, login: "same-login", accessToken: "token-a" }),
    );
    const second = await upsertGitHubIdentity(
      prisma,
      identity({ id: 11, login: "same-login", accessToken: "token-b" }),
    );

    expect(second.user.profileSlug).not.toBe(first.user.profileSlug);
    expect(second.user.profileSlug.startsWith("same-login")).toBe(true);
  });

  it("disconnects without deleting data and reconnects with new credentials", async () => {
    const { user } = await upsertGitHubIdentity(
      prisma,
      identity({ id: 20, login: "disconnect-me", accessToken: "token-one" }),
    );
    const tenant = createTenantContext(user.id);

    await disconnectGitHub(prisma, tenant);

    const disconnected = await getGitHubConnection(prisma, tenant);

    expect(disconnected.connected).toBe(false);
    expect(disconnected.disconnectedAt).toBeInstanceOf(Date);
    await expect(getDecryptedAccessToken(prisma, tenant)).rejects.toBeInstanceOf(
      GitHubNotConnectedError,
    );
    expect(await prisma.user.count()).toBe(1);

    await upsertGitHubIdentity(
      prisma,
      identity({ id: 20, login: "disconnect-me", accessToken: "token-two" }),
    );

    const reconnected = await getGitHubConnection(prisma, tenant);

    expect(reconnected.connected).toBe(true);
    expect(reconnected.disconnectedAt).toBeNull();
    expect(await getDecryptedAccessToken(prisma, tenant)).toBe("token-two");
  });

  it("keeps tokens scoped to the owning tenant", async () => {
    const first = await upsertGitHubIdentity(
      prisma,
      identity({ id: 30, login: "tenant-a", accessToken: "token-a" }),
    );
    const second = await upsertGitHubIdentity(
      prisma,
      identity({ id: 31, login: "tenant-b", accessToken: "token-b" }),
    );

    const tenantA = createTenantContext(first.user.id);
    const tenantB = createTenantContext(second.user.id);

    expect(await getDecryptedAccessToken(prisma, tenantA)).toBe("token-a");
    expect(await getDecryptedAccessToken(prisma, tenantB)).toBe("token-b");
    expect((await getGitHubConnection(prisma, tenantB)).providerAccountId).toBe("31");

    await expect(
      disconnectGitHub(prisma, createTenantContext("missing-user")),
    ).rejects.toBeInstanceOf(GitHubNotConnectedError);
  });

  it("stores only a hash of the session token and rejects expired sessions", async () => {
    const { user } = await upsertGitHubIdentity(
      prisma,
      identity({ id: 40, login: "session-user", accessToken: "token" }),
    );
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await createSessionRecord(prisma, user.id, {
      token: "fixed-session-token",
      now: createdAt,
      ttlSeconds: 60,
    });

    const session = await findSessionByToken(prisma, token, new Date("2026-01-01T00:00:30.000Z"));

    expect(session?.user.id).toBe(user.id);

    const stored = await prisma.session.findFirstOrThrow();

    expect(stored.sessionToken).toBe(hashSessionToken(token));
    expect(stored.sessionToken).not.toBe(token);

    expect(
      await findSessionByToken(prisma, token, new Date("2026-01-01T00:02:00.000Z")),
    ).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("prunes expired sessions when creating a new session", async () => {
    const { user } = await upsertGitHubIdentity(
      prisma,
      identity({ id: 55, login: "prune-user", accessToken: "token" }),
    );

    await createSessionRecord(prisma, user.id, {
      now: new Date("2020-01-01T00:00:00.000Z"),
      ttlSeconds: 60,
    });

    expect(await prisma.session.count()).toBe(1);

    await createSessionRecord(prisma, user.id);

    const sessions = await prisma.session.findMany({ orderBy: { expires: "asc" } });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].expires.getTime()).toBeGreaterThan(Date.now());
  });

  it("deletes a session token", async () => {
    const { user } = await upsertGitHubIdentity(
      prisma,
      identity({ id: 50, login: "signout-user", accessToken: "token" }),
    );
    const { token } = await createSessionRecord(prisma, user.id);

    await deleteSessionByToken(prisma, token);

    expect(await findSessionByToken(prisma, token)).toBeNull();
  });

  it("marks onboarding complete and scopes the update to the tenant", async () => {
    const { user } = await upsertGitHubIdentity(
      prisma,
      identity({ id: 60, login: "onboarding-user", accessToken: "token" }),
    );
    const tenant = createTenantContext(user.id);
    const profiles = createUserProfileService(prisma);

    const updated = await profiles.completeOnboarding(tenant, {
      profileVisibility: "PUBLIC",
      displayName: "Public Name",
      profileBio: "Bio",
      timezone: "UTC",
      searchIndexingEnabled: true,
    });

    expect(updated.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(updated.profileVisibility).toBe("PUBLIC");
    expect(updated.displayName).toBe("Public Name");

    await expect(
      profiles.completeOnboarding(createTenantContext("missing-user"), {
        profileVisibility: "PRIVATE",
      }),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });
});
