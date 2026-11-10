import { generateSessionToken, hashSessionToken } from "@/lib/auth/crypto";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";

const sessionUserSelect = {
  id: true,
  githubUserId: true,
  githubLogin: true,
  displayName: true,
  avatarUrl: true,
  profileSlug: true,
  profileVisibility: true,
  onboardingCompletedAt: true,
  role: true,
} as const;

export type SessionWithUser = NonNullable<Awaited<ReturnType<typeof findSessionByToken>>>;

export async function createSessionRecord(
  db: AppPrismaClient,
  userId: string,
  options: { token?: string; now?: Date; ttlSeconds?: number } = {},
) {
  const token = options.token ?? generateSessionToken();
  const now = options.now ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? SESSION_TTL_SECONDS;
  const expires = new Date(now.getTime() + ttlSeconds * 1000);

  await db.session.deleteMany({ where: { expires: { lt: now } } });

  const session = await db.session.create({
    data: {
      sessionToken: hashSessionToken(token),
      userId,
      expires,
    },
  });

  return { token, session };
}

export async function findSessionByToken(
  db: AppPrismaClient,
  token: string,
  now: Date = new Date(),
) {
  const session = await db.session.findUnique({
    where: { sessionToken: hashSessionToken(token) },
    include: {
      user: { select: sessionUserSelect },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expires.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function deleteSessionByToken(db: AppPrismaClient, token: string): Promise<void> {
  await db.session.deleteMany({ where: { sessionToken: hashSessionToken(token) } });
}
