import { prisma } from "@/lib/db/prisma";
import { createGitHubConnectionService } from "@/server/services/github-connection-service";
import { createProjectService } from "@/server/services/project-service";
import { createPublicProfileService } from "@/server/services/public-profile-service";
import { createRepositoryDiscoveryService } from "@/server/services/repository-discovery-service";
import { createRepositorySyncService } from "@/server/services/repository-sync-service";
import { createSyncRunService } from "@/server/services/sync-run-service";
import { createUserProfileService } from "@/server/services/user-profile-service";
import { createUserRepositoryService } from "@/server/services/user-repository-service";

/**
 * Server-side service container.
 *
 * Every tenant-owned service method takes a TenantContext as its first
 * argument and includes that tenant's user id in the database query. Routes
 * import this container; tests build the same services against a test client.
 */
export const services = {
  userRepositories: createUserRepositoryService(prisma),
  projects: createProjectService(prisma),
  syncRuns: createSyncRunService(prisma),
  userProfile: createUserProfileService(prisma),
  publicProfiles: createPublicProfileService(prisma),
  githubConnection: createGitHubConnectionService(prisma),
  repositoryDiscovery: createRepositoryDiscoveryService(prisma),
  repositorySync: createRepositorySyncService(prisma),
};
