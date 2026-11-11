import type { AuthorMatchMethod } from "@/generated/prisma/enums";

export type CommitAuthorIdentity = {
  githubUserId: string | null;
  email: string | null;
};

export type UserAuthorIdentity = {
  githubUserId: string;
  verifiedEmails: readonly string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function matchCommitAuthor(
  author: CommitAuthorIdentity,
  user: UserAuthorIdentity,
): AuthorMatchMethod {
  if (author.githubUserId && author.githubUserId === user.githubUserId) {
    return "GITHUB_USER";
  }

  if (author.email) {
    const email = normalizeEmail(author.email);
    const verified = user.verifiedEmails.some((candidate) => normalizeEmail(candidate) === email);

    if (verified) {
      return "VERIFIED_EMAIL";
    }
  }

  return "UNMATCHED";
}
