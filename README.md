# RepoLog

Multi-tenant GitHub project portfolio and development timeline.

This repository currently implements **Milestone 1: Foundation and tenancy**,
**Milestone 2: GitHub authentication and onboarding**, and **Milestone 3:
Repository discovery and selection** from `PROJECT_SPEC_v2.md`.

## What is implemented

- Next.js App Router, TypeScript strict mode and Tailwind CSS.
- PostgreSQL + Prisma with a user-scoped multi-tenant schema.
- Migrations for users, GitHub repositories, user repository connections,
  projects, commits, daily activity, daily summaries, sync runs, author emails
  and user settings.
- Zod environment validation and `.env.example`.
- GitHub OAuth 2.0 sign-in with PKCE, first-run onboarding, protected
  dashboard/admin routes and GitHub disconnect/reconnect.
- Encrypted GitHub OAuth token storage and hashed server-side sessions.
- GitHub repository discovery with `Link`-header pagination, rate-limit
  handling, idempotent upserts and per-user tracking/public-display selection.
- Tenant-scoped service factories whose queries always include the authenticated
  user id.
- Unit tests for tenancy/visibility/URL/auth helpers and integration tests that
  attempt cross-tenant reads and writes against PostgreSQL.
- ESLint and Prettier configuration.

Commit backfill, public profile data, summaries and webhooks are intentionally
left for later milestones.

## Requirements

- Node.js 24 or newer
- PostgreSQL 16 or newer
- npm

## Local setup

1. Install dependencies. This also runs `prisma generate`:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set `DATABASE_URL` in `.env` to a database you can access, for example:

   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reporlog?schema=public"
   ```

4. Generate a strong `AUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

   Set the result as `AUTH_SECRET` in `.env`. It is required for GitHub sign-in
   and in production. Keep it stable: changing it makes previously encrypted
   GitHub tokens unreadable.

5. Create a GitHub OAuth App:

   - Open <https://github.com/settings/developers> and create a new OAuth App.
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL:
     `http://localhost:3000/api/auth/github/callback`
   - Copy the Client ID and Client Secret into `.env` as `GITHUB_CLIENT_ID` and
     `GITHUB_CLIENT_SECRET`.
   - Keep `APP_BASE_URL=http://localhost:3000` unless you use a different host.
     The callback URL must exactly match the one registered with GitHub.

6. Create the database if it does not exist:

   ```bash
   createdb reporlog
   ```

   Or create it with pgAdmin/your managed PostgreSQL provider.

7. Apply the Prisma migrations:

   ```bash
   npm run db:migrate
   ```

   `prisma migrate dev` creates the migration history and applies it. On a fresh
   clone where migrations already exist, `npm run db:deploy` is also valid.

   Prisma 7 does not run `prisma generate` automatically after `migrate dev`. If
   you change the schema, run:

   ```bash
   npm run db:generate
   ```

8. Start the development server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` and choose **Continue with GitHub**.

9. Verify database connectivity:

   ```bash
   curl http://localhost:3000/api/health
   ```

   A healthy response is `{"status":"ok","database":"reachable",...}`.

## Tests

Create a separate test database and set `TEST_DATABASE_URL` in `.env`:

```env
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reporlog_test?schema=public"
```

Then run:

```bash
npm test
```

The test global setup applies Prisma migrations to `TEST_DATABASE_URL` before the
integration tests run. Integration tests are skipped when `TEST_DATABASE_URL` is
not set.

## Authentication and security

- **OAuth:** GitHub OAuth 2.0 authorization-code flow with PKCE. The flow is
  implemented in route handlers rather than an auth adapter so it works with the
  Prisma 7 client and keeps token storage explicit. The `Account` and `Session`
  models remain Auth.js-compatible.
- **Identity:** `User.githubUserId` is the immutable GitHub identity key. Users
  are created or updated by that ID, not by login name or email.
- **Sessions:** a random 32-byte token is sent in an `HttpOnly`, `SameSite=Lax`
  cookie (`Secure` in production). Only a SHA-256 hash is stored in the
  `Session` table. Sessions expire after 30 days.
- **Tokens:** GitHub access and refresh tokens are encrypted with AES-256-GCM
  before being stored. The encryption key is derived from `AUTH_SECRET` using
  HKDF-SHA256. Tokens are never sent to the browser, public APIs or logs.
- **CSRF:** OAuth state plus PKCE protect the login callback. State-changing
  POST/PATCH routes (`sign-out`, `disconnect`, onboarding, profile and
  repository updates) also check the request origin.
- **Route protection:** `/dashboard` and `/admin` require a session.
  `/onboarding` requires a session and redirects completed users to the
  dashboard. API routes derive the tenant from the session only.
- **Disconnect:** disconnecting clears the stored tokens, marks the account
  disconnected and stops syncing. Imported repositories, projects and commits are
  retained. Reconnecting restores syncing.
- **Scopes:** the default OAuth scopes are `read:user user:email repo`. The
  `repo` scope is needed to read private repositories for the authenticated
  owner. A GitHub App with fine-grained read permissions is recommended for
  organization/private access in production.

Production additionally requires `AUTH_SECRET` and `JOB_SECRET`.
`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are required for GitHub sign-in;
without them the app still builds and serves public pages, but sign-in is
disabled and the landing page shows setup guidance.

## Repository discovery

- **Discovery:** `POST /api/user/repositories/discover` lists repositories the
  connected GitHub account can access (`owner`, `collaborator` and
  `organization_member` affiliations), following GitHub's `Link` pagination.
  Results are deduplicated by GitHub repository id.
- **Storage:** shared repository metadata is stored once in
  `GitHubRepository`; each user gets a `UserRepository` connection with their
  own tracking and public-display settings. Discovery never enables tracking
  automatically.
- **Idempotency:** rerunning discovery upserts metadata, creates only new
  connections, refreshes `lastDiscoveredAt` and preserves existing tracking,
  public-display, project and sync state.
- **Audit:** each discovery run writes a tenant-scoped `SyncRun` with trigger
  `ADMIN` and no `userRepositoryId`.
- **Selection API:** `GET /api/user/repositories` supports `page`, `pageSize`,
  `q`, `tracking`, `visibility`, `ownerType` and `publicDisplay` filters.
  `PATCH /api/user/repositories` updates many connections at once (optionally
  restricted to `ids`), while `PATCH /api/user/repositories/[id]` updates one.
- **GitHub errors:** a GitHub `401` is returned to the app as
  `409 GITHUB_NOT_CONNECTED` and requires reconnecting GitHub. A GitHub `429`
  is returned as `429 RATE_LIMITED`; GitHub `5xx` responses become
  `502 GITHUB_ERROR`. Errors are returned as safe JSON without exposing tokens.

## Useful commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start Next.js in development             |
| `npm run build`        | Production build                         |
| `npm run start`        | Start the production server              |
| `npm run lint`         | Run ESLint                               |
| `npm run format`       | Format with Prettier                     |
| `npm run format:check` | Check formatting                         |
| `npm run typecheck`    | Run TypeScript without emitting          |
| `npm test`             | Run unit and integration tests           |
| `npm run db:generate`  | Regenerate the Prisma client             |
| `npm run db:migrate`   | Create and apply a development migration |
| `npm run db:deploy`    | Apply existing migrations                |
| `npm run db:status`    | Show migration status                    |
| `npm run db:studio`    | Open Prisma Studio                       |

## Tenancy model

- `User.githubUserId` is the immutable external identity.
- Every tenant-owned record is reachable through a `userId` relation.
- `UserRepository` is the per-user connection to an external
  `GitHubRepository`; two users can track the same repository independently.
- `Project` is one-to-one with `UserRepository` and unique per
  `(userId, slug)`.
- `Commit` is unique per `(userRepositoryId, sha)`.
- Daily activity is unique per `(projectId, date, timezone)`.
- Service factories take a `TenantContext` and always include `userId` in reads,
  updates and ownership checks. `updateMany` is used for mutations so a guessed
  id cannot update another tenant's record.
- Public services use explicit `select` allowlists and omit private repository
  metadata from public DTOs.
- Auth helpers resolve the tenant from the session cookie. Client-provided user
  ids are never treated as proof of access.

## Route structure

```text
/                                   Marketing/landing page with GitHub sign-in
/onboarding                         First-run profile/privacy onboarding
/u/[username]                       Public profile scaffold
/u/[username]/projects/[projectSlug] Public project scaffold
/dashboard                          Private dashboard (session required)
/admin                              Private admin (session required)
/admin/repositories                 Repository discovery and selection
/admin/projects                     Project management scaffold
/admin/projects/[id]                Project editor scaffold
/admin/settings                     Profile/settings scaffold
/api/health                         Database health check
/api/auth/github/start              Start GitHub OAuth
/api/auth/github/callback           GitHub OAuth callback
/api/auth/github/disconnect         Disconnect GitHub (POST)
/api/auth/signout                   Sign out (POST)
/api/onboarding                     Complete first-run onboarding (POST)
/api/public/...                     Public API scaffolds
/api/user/repositories              List/search and bulk-update repositories
/api/user/repositories/[id]         Update one repository connection
/api/user/repositories/discover     Discover accessible GitHub repositories
/api/user/...                       Other authenticated user APIs
/api/admin/...                      Admin API scaffold
/api/jobs/...                       Internal job endpoints (bearer secret)
/api/webhooks/github                Webhook scaffold
```

## Troubleshooting

- **`?auth=not-configured`:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` or
  `AUTH_SECRET` is missing from `.env`.
- **GitHub callback error:** the callback URL in the GitHub OAuth App must match
  `${APP_BASE_URL}/api/auth/github/callback` exactly.
- **`AUTH_SECRET` changed:** stored GitHub tokens can no longer be decrypted.
  Reconnect GitHub from `/admin` to replace them.
- **Repository discovery returns `GITHUB_NOT_CONNECTED`:** the stored GitHub
  token is invalid or revoked. Reconnect GitHub from `/admin`.
- **Repository discovery returns 429:** GitHub rate-limited the request. Wait for
  the reset window, then retry; the UI surfaces the safe error message.
- **Database errors:** confirm PostgreSQL is running and `DATABASE_URL` is
  correct, then run `npm run db:deploy`.
