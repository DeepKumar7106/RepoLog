import {
  disconnectGitHub,
  getDecryptedAccessToken,
  getGitHubConnection,
} from "@/lib/auth/github-account";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import type { TenantContext } from "@/lib/tenancy/tenant-context";

export function createGitHubConnectionService(db: AppPrismaClient) {
  return {
    get(tenant: TenantContext) {
      return getGitHubConnection(db, tenant);
    },

    disconnect(tenant: TenantContext) {
      return disconnectGitHub(db, tenant);
    },

    getAccessToken(tenant: TenantContext) {
      return getDecryptedAccessToken(db, tenant);
    },
  };
}

export type GitHubConnectionService = ReturnType<typeof createGitHubConnectionService>;
