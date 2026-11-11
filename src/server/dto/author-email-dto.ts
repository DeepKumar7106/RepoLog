import type { AuthorEmail } from "@/generated/prisma/client";

export type AuthorEmailDto = {
  id: string;
  email: string;
  verifiedByUser: boolean;
  createdAt: string;
};

export function toAuthorEmailDto(record: AuthorEmail): AuthorEmailDto {
  return {
    id: record.id,
    email: record.email,
    verifiedByUser: record.verifiedByUser,
    createdAt: record.createdAt.toISOString(),
  };
}
