-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "RepositoryVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "BackfillStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'IN_PROGRESS', 'COMPLETE', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ONGOING', 'COMPLETE', 'ON_BREAK');

-- CreateEnum
CREATE TYPE "ActivityDetail" AS ENUM ('HIDDEN', 'AGGREGATED', 'COMMIT_DETAILS');

-- CreateEnum
CREATE TYPE "AuthorMatchMethod" AS ENUM ('GITHUB_USER', 'VERIFIED_EMAIL', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('INITIAL', 'SCHEDULED', 'WEBHOOK', 'ADMIN');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SummaryScope" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "SummaryGenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "profileSlug" TEXT NOT NULL,
    "profileBio" TEXT,
    "profileVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "searchIndexingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "GitHubRepository" (
    "id" TEXT NOT NULL,
    "githubRepositoryId" TEXT NOT NULL,
    "ownerLogin" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "visibility" "RepositoryVisibility" NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "lastMetadataRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRepository" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubRepositoryId" TEXT NOT NULL,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicDisplayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicActivityDetail" "ActivityDetail" NOT NULL DEFAULT 'HIDDEN',
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "backfillStatus" "BackfillStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "syncCursor" TEXT,
    "backfillCursor" TEXT,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRepositoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayTitle" TEXT NOT NULL,
    "shortDescription" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ONGOING',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "demoUrl" TEXT,
    "publicReadmeMarkdown" TEXT,
    "publicReadmeUpdatedAt" TIMESTAMP(3),
    "firstCommitAt" TIMESTAMP(3),
    "latestCommitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRepositoryId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "authorGithubUserId" TEXT,
    "authorLogin" TEXT,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT,
    "authorDate" TIMESTAMP(3) NOT NULL,
    "committerDate" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "additions" INTEGER,
    "deletions" INTEGER,
    "changedFiles" INTEGER,
    "authorMatchMethod" "AuthorMatchMethod" NOT NULL,
    "isOnDefaultBranch" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyProjectActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "additions" INTEGER,
    "deletions" INTEGER,
    "changedFiles" INTEGER,
    "firstCommitAt" TIMESTAMP(3),
    "lastCommitAt" TIMESTAMP(3),
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "scope" "SummaryScope" NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "projectHighlights" JSONB,
    "dataVersion" TEXT NOT NULL,
    "inputHash" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "generationStatus" "SummaryGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRepositoryId" TEXT,
    "trigger" "SyncTrigger" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "commitsProcessed" INTEGER NOT NULL DEFAULT 0,
    "commitsInserted" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verifiedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summariesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowPrivateMetadataForLlm" BOOLEAN NOT NULL DEFAULT false,
    "summaryProvider" TEXT,
    "summaryModel" TEXT,
    "defaultActivityDetail" "ActivityDetail" NOT NULL DEFAULT 'AGGREGATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUserId_key" ON "User"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");

-- CreateIndex
CREATE INDEX "User_githubLogin_idx" ON "User"("githubLogin");

-- CreateIndex
CREATE INDEX "User_profileVisibility_idx" ON "User"("profileVisibility");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubRepository_githubRepositoryId_key" ON "GitHubRepository"("githubRepositoryId");

-- CreateIndex
CREATE INDEX "GitHubRepository_fullName_idx" ON "GitHubRepository"("fullName");

-- CreateIndex
CREATE INDEX "GitHubRepository_ownerLogin_idx" ON "GitHubRepository"("ownerLogin");

-- CreateIndex
CREATE INDEX "UserRepository_userId_idx" ON "UserRepository"("userId");

-- CreateIndex
CREATE INDEX "UserRepository_userId_trackingEnabled_idx" ON "UserRepository"("userId", "trackingEnabled");

-- CreateIndex
CREATE INDEX "UserRepository_githubRepositoryId_idx" ON "UserRepository"("githubRepositoryId");

-- CreateIndex
CREATE INDEX "UserRepository_syncStatus_idx" ON "UserRepository"("syncStatus");

-- CreateIndex
CREATE INDEX "UserRepository_backfillStatus_idx" ON "UserRepository"("backfillStatus");

-- CreateIndex
CREATE UNIQUE INDEX "UserRepository_userId_githubRepositoryId_key" ON "UserRepository"("userId", "githubRepositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userRepositoryId_key" ON "Project"("userRepositoryId");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_userId_visibility_idx" ON "Project"("userId", "visibility");

-- CreateIndex
CREATE INDEX "Project_userId_status_idx" ON "Project"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_slug_key" ON "Project"("userId", "slug");

-- CreateIndex
CREATE INDEX "Commit_userId_authorDate_idx" ON "Commit"("userId", "authorDate");

-- CreateIndex
CREATE INDEX "Commit_userRepositoryId_authorDate_idx" ON "Commit"("userRepositoryId", "authorDate");

-- CreateIndex
CREATE INDEX "Commit_userId_authorGithubUserId_idx" ON "Commit"("userId", "authorGithubUserId");

-- CreateIndex
CREATE INDEX "Commit_userId_isOnDefaultBranch_idx" ON "Commit"("userId", "isOnDefaultBranch");

-- CreateIndex
CREATE UNIQUE INDEX "Commit_userRepositoryId_sha_key" ON "Commit"("userRepositoryId", "sha");

-- CreateIndex
CREATE INDEX "DailyProjectActivity_userId_date_idx" ON "DailyProjectActivity"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyProjectActivity_projectId_date_idx" ON "DailyProjectActivity"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyProjectActivity_projectId_date_timezone_key" ON "DailyProjectActivity"("projectId", "date", "timezone");

-- CreateIndex
CREATE INDEX "DailySummary_userId_date_idx" ON "DailySummary"("userId", "date");

-- CreateIndex
CREATE INDEX "DailySummary_userId_generationStatus_idx" ON "DailySummary"("userId", "generationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_userId_date_timezone_scope_dataVersion_key" ON "DailySummary"("userId", "date", "timezone", "scope", "dataVersion");

-- CreateIndex
CREATE INDEX "SyncRun_userId_createdAt_idx" ON "SyncRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncRun_userRepositoryId_startedAt_idx" ON "SyncRun"("userRepositoryId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_userId_status_idx" ON "SyncRun"("userId", "status");

-- CreateIndex
CREATE INDEX "AuthorEmail_userId_idx" ON "AuthorEmail"("userId");

-- CreateIndex
CREATE INDEX "AuthorEmail_email_idx" ON "AuthorEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorEmail_userId_email_key" ON "AuthorEmail"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRepository" ADD CONSTRAINT "UserRepository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRepository" ADD CONSTRAINT "UserRepository_githubRepositoryId_fkey" FOREIGN KEY ("githubRepositoryId") REFERENCES "GitHubRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userRepositoryId_fkey" FOREIGN KEY ("userRepositoryId") REFERENCES "UserRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_userRepositoryId_fkey" FOREIGN KEY ("userRepositoryId") REFERENCES "UserRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProjectActivity" ADD CONSTRAINT "DailyProjectActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProjectActivity" ADD CONSTRAINT "DailyProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_userRepositoryId_fkey" FOREIGN KEY ("userRepositoryId") REFERENCES "UserRepository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorEmail" ADD CONSTRAINT "AuthorEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
