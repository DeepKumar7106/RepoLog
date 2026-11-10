import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { GITHUB_PROVIDER } from "@/lib/auth/constants";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/auth/crypto";
import {
  getPrimaryVerifiedEmail,
  type GitHubEmail,
  type GitHubTokenResponse,
  type GitHubUser,
} from "@/lib/auth/github";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import type { TenantContext } from "@/lib/tenancy/tenant-context";
import { normalizeSlug } from "@/lib/urls/slugs";

type DbClient = AppPrismaClient | Prisma.TransactionClient;

export type GitHubIdentityInput = Readonly<{
  githubUser: GitHubUser;
  emails: GitHubEmail[];
  token: GitHubTokenResponse;
}>;

export type GitHubConnection = Readonly<{
  connected: boolean;
  providerAccountId: string | null;
  scope: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  disconnectedAt: Date | null;
  connectedAt: Date | null;
  updatedAt: Date | null;
}>;

export class GitHubNotConnectedError extends Error {
  readonly code = "GITHUB_NOT_CONNECTED";

  constructor() {
    super("GitHub is not connected for this account");
    this.name = "GitHubNotConnectedError";
  }
}

async function generateUniqueProfileSlug(db: DbClient, login: string): Promise<string> {
  const base = normalizeSlug(login) || `user-${randomBytes(4).toString("hex")}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 35).replace(/-+$/g, "")}-${attempt + 1}`;

    const existing = await db.user.findUnique({
      where: { profileSlug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `user-${randomBytes(8).toString("hex")}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function upsertGitHubIdentity(
  db: AppPrismaClient,
  input: GitHubIdentityInput,
): Promise<{ user: Awaited<ReturnType<AppPrismaClient["user"]["create"]>>; isNewUser: boolean }> {
  const providerAccountId = String(input.githubUser.id);
  const accessToken = encryptSecret(input.token.access_token);
  const refreshToken = input.token.refresh_token ? encryptSecret(input.token.refresh_token) : null;
  const expiresAt = input.token.expires_in
    ? Math.floor(Date.now() / 1000) + input.token.expires_in
    : null;
  const primaryEmail = getPrimaryVerifiedEmail(input.emails);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { githubUserId: providerAccountId },
        });

        let isNewUser = false;
        let user = existingUser;

        if (!user) {
          isNewUser = true;
          user = await tx.user.create({
            data: {
              githubUserId: providerAccountId,
              githubLogin: input.githubUser.login,
              displayName: input.githubUser.name?.trim() || input.githubUser.login,
              avatarUrl: input.githubUser.avatar_url ?? null,
              profileSlug: await generateUniqueProfileSlug(tx, input.githubUser.login),
            },
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              githubLogin: input.githubUser.login,
              displayName: input.githubUser.name?.trim() || input.githubUser.login,
              avatarUrl: input.githubUser.avatar_url ?? null,
            },
          });
        }

        await tx.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: GITHUB_PROVIDER,
              providerAccountId,
            },
          },
          update: {
            userId: user.id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            token_type: input.token.token_type ?? null,
            scope: input.token.scope ?? null,
            disconnectedAt: null,
          },
          create: {
            userId: user.id,
            type: "oauth",
            provider: GITHUB_PROVIDER,
            providerAccountId,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            token_type: input.token.token_type ?? null,
            scope: input.token.scope ?? null,
          },
        });

        if (primaryEmail) {
          await tx.authorEmail.upsert({
            where: {
              userId_email: {
                userId: user.id,
                email: primaryEmail,
              },
            },
            update: { verifiedByUser: true },
            create: {
              userId: user.id,
              email: primaryEmail,
              verifiedByUser: true,
            },
          });
        }

        return { user, isNewUser };
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not create or update the GitHub account");
}

export async function getGitHubConnection(
  db: AppPrismaClient,
  tenant: TenantContext,
): Promise<GitHubConnection> {
  const account = await db.account.findFirst({
    where: { userId: tenant.userId, provider: GITHUB_PROVIDER },
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    return {
      connected: false,
      providerAccountId: null,
      scope: null,
      tokenType: null,
      expiresAt: null,
      disconnectedAt: null,
      connectedAt: null,
      updatedAt: null,
    };
  }

  return {
    connected: Boolean(account.access_token) && !account.disconnectedAt,
    providerAccountId: account.providerAccountId,
    scope: account.scope,
    tokenType: account.token_type,
    expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
    disconnectedAt: account.disconnectedAt,
    connectedAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function disconnectGitHub(db: AppPrismaClient, tenant: TenantContext): Promise<void> {
  const result = await db.account.updateMany({
    where: { userId: tenant.userId, provider: GITHUB_PROVIDER },
    data: {
      access_token: null,
      refresh_token: null,
      expires_at: null,
      disconnectedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new GitHubNotConnectedError();
  }
}

export async function getDecryptedAccessToken(
  db: AppPrismaClient,
  tenant: TenantContext,
): Promise<string> {
  const account = await db.account.findFirst({
    where: { userId: tenant.userId, provider: GITHUB_PROVIDER },
    orderBy: { createdAt: "asc" },
  });

  if (!account?.access_token || account.disconnectedAt) {
    throw new GitHubNotConnectedError();
  }

  if (!isEncryptedSecret(account.access_token)) {
    throw new Error("Stored GitHub access token is not encrypted");
  }

  return decryptSecret(account.access_token);
}
