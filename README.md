# RepoLog

Multi-tenant GitHub project portfolio and development timeline.

This repository currently implements **Milestone 1: Foundation and tenancy**,
**Milestone 2: GitHub authentication and onboarding**, **Milestone 3:
Repository discovery and selection**, **Milestone 4: Historical commit
backfill**, **Milestone 5: Project and profile management**, and **Milestone 6:
Public profiles and activity** from `PROJECT_SPEC_v2.md`.

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
- Default-branch commit backfill with resumable page checkpoints, author
  matching by immutable GitHub user id or verified email, deduplication by
  repository and SHA, project date/activity recalculation and per-repository
  sync logs.
- Project management with one private project per tracked repository, editable
  status/title/description/slug/demo URL, project visibility, public overview
  text for private repositories and shareable public URLs.
- Profile settings with visibility, search indexing, timezone and verified
  author email management.
- Public profile and project pages with privacy-aware project cards, activity
  charts, date/project filters, daily commit lists, copyable share links and
  Open Graph/Twitter metadata. Generated OG images are available at `/api/og`.
- Dashboard project overview and personal activity timeline backed by the same
  deterministic daily aggregates.
- Public activity privacy rules: private profiles are unreachable, private
  projects are omitted, private repositories expose only aggregate counts, and
  commit messages/SHAs require `COMMIT_DETAILS` on a public repository.
- Tenant-scoped service factories whose queries always include the authenticated
  user id.
- Unit tests for tenancy/visibility/URL/auth, GitHub pagination and author
  matching, plus integration tests for repository discovery, resumable commit
  sync, project/profile management, author emails, public profile/activity
  privacy and cross-tenant read/write denial against PostgreSQL.
- ESLint and Prettier configuration.

Daily summaries, webhooks and scheduled sync are intentionally left for later
milestones.

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

## Project and profile management

- **Project creation:** every tracked repository gets exactly one project.
  `POST /api/user/projects` ensures the project for a `userRepositoryId`;
  `GET /api/user/projects` lists projects. New projects are private with
  status `ONGOING`.
- **Project editing:** `PATCH /api/user/projects/[id]` updates display title,
  short description, status, visibility, demo URL and slug. Slugs are unique per
  user and conflicts return `409 PROJECT_SLUG_CONFLICT`.
- **Public overview:** `POST /api/user/projects/[id]/readme` stores
  `publicReadmeMarkdown` and refreshes `publicReadmeUpdatedAt`. This is the only
  repository text exposed publicly for private repositories.
- **Public access:** a project can be public while the profile is private, but
  public services still enforce profile visibility. Publish the profile in
  Settings before sharing project URLs.
- **Profile settings:** `PATCH /api/user/profile` updates display name, bio,
  profile slug, visibility, search indexing and an IANA timezone. Profile slug
  conflicts return `409 PROFILE_SLUG_CONFLICT`.
- **Author emails:** `GET/POST /api/user/author-emails` and
  `PATCH/DELETE /api/user/author-emails/[id]` manage verified email fallbacks
  used during commit matching. Duplicate emails return
  `409 AUTHOR_EMAIL_EXISTS`.
- **Admin UI:** `/admin/projects` lists and creates missing projects,
  `/admin/projects/[id]` edits project/public-display settings with a preview
  and copyable URL, and `/admin/settings` manages profile privacy and author
  emails.

## Public profiles and activity

- **Public profile:** `GET /api/public/users/[username]` returns an allowlisted
  profile and its public projects. Private profiles return `404`.
- **Public project:** `GET /api/public/users/[username]/projects/[slug]` returns
  approved project fields, published README Markdown and repository metadata only
  when the GitHub repository is public.
- **Activity:** `GET /api/public/users/[username]/activity` accepts `from`, `to`
  and `project` query parameters. Ranges default to 90 days and are limited to
  366 days. `GET /api/public/users/[username]/days/[date]` returns the selected
  day's project aggregates and any permitted commit details.
- **Privacy:** public project access requires a public profile, project
  visibility `PUBLIC` and `publicDisplayEnabled`. Activity respects
  `publicActivityDetail`: `HIDDEN` omits the project, `AGGREGATED` exposes counts
  only, and `COMMIT_DETAILS` exposes commit metadata only for public GitHub
  repositories.
- **Pages:** `/u/[username]` and `/u/[username]/projects/[projectSlug]` render
  the public portfolio with an activity chart, accessible active-day list,
  project/date filters, daily details, share links and social metadata.
- **Dashboard:** `/dashboard` shows the authenticated user's project overview
  and personal timeline, including private activity.

## Commit sync

- **Backfill:** `POST /api/user/repositories/[id]/sync` fetches commits from the
  repository's current default branch. A repository must be tracked first.
- **Author matching:** commits qualify when the GitHub author id matches the
  connected user, or when the commit author email matches one of the user's
  verified author emails. Display names are never used for matching.
- **Deduplication:** commits are unique per `(userRepositoryId, sha)`; rerunning
  sync does not duplicate rows.
- **Resumable checkpoints:** each run processes a bounded number of pages and
  stores the next page in `backfillCursor`. Repeating the request resumes the
  backfill; `backfillStatus` becomes `COMPLETE` only after the last page.
- **Incremental sync:** after backfill completes, `syncCursor` and
  `lastSyncedAt` are set. Later runs request commits since the cursor with a
  one-day overlap to catch boundary updates.
- **Aggregates:** when a project exists, sync recalculates the project's first
  and latest commit dates and affected `DailyProjectActivity` rows using the
  user's timezone.
- **Concurrency:** a per-connection lock rejects overlapping syncs with
  `409 SYNC_IN_PROGRESS`. A stale `RUNNING` lock older than 15 minutes can be
  superseded.
- **Audit:** each sync writes a `SyncRun` with trigger, status, page/commit
  counts and a safe error code and message. Previously imported commits are
  retained when a repository becomes inaccessible.

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
/u/[username]                       Public profile and activity timeline
/u/[username]/projects/[projectSlug] Public project detail and activity
/dashboard                          Private dashboard, projects and timeline
/admin                              Private admin (session required)
/admin/repositories                 Repository discovery and selection
/admin/projects                     Project list and ensure projects
/admin/projects/[id]                Project editor, preview and share URL
/admin/settings                     Profile, privacy and author emails
/api/health                         Database health check
/api/auth/github/start              Start GitHub OAuth
/api/auth/github/callback           GitHub OAuth callback
/api/auth/github/disconnect         Disconnect GitHub (POST)
/api/auth/signout                   Sign out (POST)
/api/onboarding                     Complete first-run onboarding (POST)
/api/public/users/[username]        Public profile and public projects
/api/public/users/[username]/projects/[slug] Public project detail
/api/public/users/[username]/activity Public activity range
/api/public/users/[username]/days/[date] Public daily activity and commits
/api/og                             Generated social preview image
/robots.txt                         Crawler rules for private routes
/sitemap.xml                        Indexable public profiles and projects
/api/user/repositories              List/search and bulk-update repositories
/api/user/repositories/[id]         Update one repository connection
/api/user/repositories/[id]/sync    Backfill or incrementally sync commits
/api/user/repositories/discover     Discover accessible GitHub repositories
/api/user/projects                  List and create projects (GET/POST)
/api/user/projects/[id]             Read or update a project (GET/PATCH)
/api/user/projects/[id]/readme      Save the public overview (POST)
/api/user/author-emails             List and add author emails (GET/POST)
/api/user/author-emails/[id]        Update or remove an author email
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
