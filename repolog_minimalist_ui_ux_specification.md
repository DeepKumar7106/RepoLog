# RepoLog — Minimalist UI & UX Design Specification

**Document:** `UI_UX_SPEC.md`  
**Target Stack:** Next.js App Router, React 19, Tailwind CSS v4, TypeScript  
**Design Philosophy:** Minimalist, content-first, high-craft developer portfolio & chronological ledger.  
**Cross-References:** `PROJECT_SPEC_v2.md`, `README.md`

---

## 1. Visual Language & Minimalist Design System

The interface treats developer activity like a clean engineering ledger—removing visual clutter, decorative gradients, and heavy shadows in favor of crisp typography, subtle 1px borders, generous whitespace, and clear data hierarchy.

### 1.1 Color Palette (Light & Dark Mode Tokens)
Use semantic CSS variables / Tailwind v4 theme tokens so the owner can easily adjust or theme later without touching component logic.

| Token / Role | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#FFFFFF` | `#09090B` (Zinc 950) | Main page background |
| `--bg-surface` | `#FAFAFA` | `#121215` | Cards, table headers, subtle containers |
| `--bg-hover` | `#F4F4F5` | `#18181B` (Zinc 900) | Interactive row/card hover states |
| `--border-subtle` | `#E4E4E7` (Zinc 200) | `#27272A` (Zinc 800) | 1px structural dividers, card outlines |
| `--text-primary` | `#09090B` (Zinc 950) | `#FAFAFA` (Zinc 50) | Headings, primary metrics, active labels |
| `--text-secondary` | `#52525B` (Zinc 600) | `#A1A1AA` (Zinc 400) | Descriptions, timestamps, metadata |
| `--text-muted` | `#A1A1AA` (Zinc 400) | `#71717A` (Zinc 500) | Empty states, placeholders, subtle hints |
| `--accent-primary` | `#18181B` (Zinc 900) | `#FAFAFA` (Zinc 50) | High-contrast primary CTAs |

### 1.2 Semantic Status & Activity Indicators
* **Project Status Pills (Minimal 1px border + dot):**
  * `ONGOING`: Emerald dot (`#10B981`), neutral border, label `"Ongoing"`.
  * `COMPLETE`: Blue/Slate dot (`#3B82F6`), neutral border, label `"Complete"`.
  * `ON_BREAK`: Amber dot (`#F59E0B`), neutral border, label `"On Break"`.
* **Visibility Badges:**
  * `PUBLIC`: Crisp outline badge with globe/eye icon.
  * `PRIVATE`: Muted surface badge with lock icon.
* **Activity Chart Intensity Scale (Monochrome / Subtle Emerald):**
  * `0 commits`: `--bg-surface` with `--border-subtle`
  * `1–2 commits`: `rgba(16, 185, 129, 0.25)`
  * `3–5 commits`: `rgba(16, 185, 129, 0.55)`
  * `6+ commits`: `rgba(16, 185, 129, 0.90)`

### 1.3 Typography & Spacing
* **Primary Sans:** `Inter` or `Geist Sans` — clean geometric sans-serif with `tracking-tight` (`-0.02em`) on headings.
* **Monospace:** `JetBrains Mono` or `Geist Mono` — mandatory for commit SHAs (`7-char` truncated), branch names (`main`), repository slugs (`owner/repo`), timestamps, and numeric metrics (`tabular-nums`).
* **Grid & Rhythm:** Max container width `max-w-5xl` (`1024px`) centered with `px-4 sm:px-6`. Generous vertical section spacing (`space-y-12` on public pages, `space-y-8` on admin/dashboard views).

---

## 2. Navigation & Layout Shells

### 2.1 Public Layout Shell (`(marketing)` & `(public)`)
* **Header (`h-14 border-b`):**
  * Left: Minimal wordmark `RepoLog` (or user breadcrumb `/u/[username]` on profile pages).
  * Right: Single contextual action (`Sign in with GitHub` if logged out, `Dashboard →` if logged in, or `Copy Profile Link` on public profiles).
* **Footer (`border-t py-8`):**
  * Minimal text: `"GitHub remains the source of truth."` + links to privacy/self-host info. No multi-column bloat.

### 2.2 Authenticated Workspace Shell (`(authenticated)`)
* **Top Navigation Bar (`h-14 border-b`):**
  * Left: `RepoLog` mark + workspace switcher/breadcrumbs.
  * Center/Left Tabs (clean underline indicator):
    * `Dashboard` (`/dashboard`)
    * `Repositories` (`/admin/repositories`)
    * `Projects` (`/admin/projects`)
    * `Settings` (`/admin/settings`)
    * `Overview` (`/admin`)
  * Right: Quick link to `View Public Profile ↗` (if published) + User Avatar dropdown (`Sign Out`).

---

## 3. Page-by-Page & Endpoint Mapping

Every route in `README.md` and `PROJECT_SPEC_v2.md` is mapped below with its layout, UX flow, and exact API integrations.

---

### 3.1 Marketing / Landing Page (`/`)
* **Auth State:** Unauthenticated (redirects to `/dashboard` or `/onboarding` if session exists).
* **API Integration:** Checks auth config state (handles `?auth=not-configured` banner gracefully).
* **Layout & Sections:**
  1. **Hero Section (Centered, single-column):**
     * Headline: *"Your GitHub history, distilled into a living project timeline."*
     * Subheadline: *"Connect your repositories, curate what you share, and turn daily commits into a chronological developer portfolio."*
     * Primary CTA: `Continue with GitHub` (triggers `GET /api/auth/github/start`) + secondary link to sample public profile.
  2. **Interactive Sample Preview:**
     * Clean framed preview box clearly badged `"Sample Data Preview"` showcasing a minimalist activity bar/heatmap, 3 project cards (`ONGOING`, `COMPLETE`, `ON_BREAK`), and a sample daily summary card.
  3. **3-Column Value Grid (1px borders, no icons bloat):**
     * *Source of Truth:* GitHub holds your code; RepoLog visualizes your default-branch progress.
     * *Privacy by Default:* Profiles and private repos stay hidden until you explicitly publish them.
     * *Deterministic Metrics:* Exact commit counts and timelines backed by optional AI daily narratives.

---

### 3.2 First-Run Onboarding (`/onboarding`)
* **Auth State:** Authenticated (redirects to `/dashboard` if already onboarded).
* **API Endpoints:**
  * `POST /api/user/repositories/discover`
  * `GET /api/user/repositories`
  * `PATCH /api/user/repositories`
  * `POST /api/onboarding`
* **UX Flow (Minimalist 3-Step Stepper):**
  * **Step 1: Repository Discovery & Selection**
    * Auto-triggers discovery on mount with a clean linear progress indicator.
    * Searchable, filterable checklist of personal & organization repos (`Owner`, `Repo Name`, `Visibility badge`, `Default Branch`).
    * Note callout: *"Organization repos may require org admin approval."*
    * Bulk actions: `Select All`, `Clear`.
  * **Step 2: Privacy Posture**
    * Radio cards with clear defaults:
      * **Private Profile (Default):** Only visible to you in `/dashboard`.
      * **Public Profile:** Accessible at `/u/[username]` (selected repos still start as private projects).
    * Editable `profileSlug` input with live URL preview (`repolog.app/u/your-slug`).
  * **Step 3: Confirm & Start Historical Backfill**
    * Summary of selected repositories to track.
    * CTA: `Complete Setup & Start Sync` → calls `POST /api/onboarding` and routes to `/dashboard`.

---

### 3.3 Private Dashboard (`/dashboard`)
* **Auth State:** Authenticated (`USER`).
* **API Endpoints:**
  * `GET /api/user/me`
  * `GET /api/user/projects`
  * `GET /api/user/repositories` (for sync/backfill status)
  * `POST /api/user/summaries/[date]/regenerate`
* **Layout & Sections:**
  1. **Sync & Backfill Status Banner (Conditional):**
     * Shown whenever any tracked repository has `backfillStatus !== 'COMPLETE'` or `syncStatus === 'RUNNING'`.
     * Displays subtle animated pulse dot, repo count syncing (e.g., *"Backfilling 2 of 5 repositories..."*), and link to `/admin`.
  2. **Top KPI Strip (4 Minimal Metric Cards in a `grid-cols-2 md:grid-cols-4` border grid):**
     * `Tracked Repositories`
     * `Qualifying Commits` (default branch, author-matched)
     * `Active Days`
     * `Public Projects`
  3. **Personal Activity Timeline & Chart:**
     * Interactive date-range selector (`30d`, `90d`, `1y`) + Project filter dropdown.
     * Minimalist SVG/Recharts bar or contribution grid + **Accessible Table/List View Toggle** (per Section 15 accessibility mandate).
  4. **Selected Day Inspector & Daily Summary (Below Chart):**
     * Displays deterministic stats for the clicked/selected calendar day (or most recent active day).
     * **Daily Summary Card:** Shows `headline`, `summary`, and `projectHighlights`. Includes a subtle `Regenerate` button (`POST /api/user/summaries/[date]/regenerate`) and scope badge (`PRIVATE` / `PUBLIC`).
     * **Commit Ledger:** Chronological list of qualifying commits on that day (`SHA`, `message`, `repo`, `timestamp in user timezone`).
  5. **Projects Grid:**
     * Cards for all tracked projects showing status pill, visibility badge (`PUBLIC`/`PRIVATE`), commit count, and first/last commit dates. Clicking navigates to `/admin/projects/[id]`.

---

### 3.4 Public Profile (`/u/[username]`)
* **Auth State:** Public (unauthenticated visitors). Returns `404` if profile is `PRIVATE`.
* **API Endpoints:**
  * `GET /api/public/users/[username]`
  * `GET /api/public/users/[username]/activity?from=&to=&project=`
  * `GET /api/public/users/[username]/days/[date]`
* **Layout & Sections:**
  1. **Minimalist Profile Header:**
     * Avatar (`48x48` rounded-full grayscale-hover or crisp), `displayName`, `@username`, optional `bio`.
     * Right-aligned `Share Profile` button (copies canonical `/u/[username]` URL with `"Copied"` toast feedback).
  2. **Public Projects Grid (`grid-cols-1 md:grid-cols-2`):**
     * Only displays projects where `visibility === 'PUBLIC'` and `publicDisplayEnabled === true`.
     * Card shows: `displayTitle`, `StatusPill`, `shortDescription`, active date range (`Jan 2025 – Present`), and `View Project →` link.
     * *Privacy Rule:* Never displays GitHub repo link on the card if the underlying GitHub repository is `PRIVATE`.
  3. **Activity Visualization & Filter Bar:**
     * Filter by public project dropdown & date range (`90d` default, up to `366d`).
     * Clean minimalist bar/heatmap chart + `List View` toggle for keyboard/screen-reader accessibility.
  4. **Daily Summary & Selected Date Breakdown (Below Chart):**
     * Clicking any active bar/day fetches `GET /api/public/users/[username]/days/[date]`.
     * Shows `PUBLIC` daily summary (if enabled) and per-project activity breakdown:
       * If `publicActivityDetail === 'AGGREGATED'` (or private repo): Shows `"4 commits in Project Name"` only.
       * If `publicActivityDetail === 'COMMIT_DETAILS'` (public repo only): Lists sanitized commit messages and external GitHub commit links.

---

### 3.5 Public Project Detail (`/u/[username]/projects/[projectSlug]`)
* **Auth State:** Public. Returns `404` if profile is `PRIVATE` or project is `PRIVATE`.
* **API Endpoints:**
  * `GET /api/public/users/[username]/projects/[slug]`
  * `GET /api/public/users/[username]/activity?project=[slug]`
* **Layout & Sections:**
  1. **Breadcrumb & Header:**
     * `← Back to [Display Name] (/u/[username])`
     * Title (`displayTitle`), `StatusPill`, `shortDescription`.
     * **Action Bar:**
       * `Copy Link` button (canonical project URL).
       * `Live Demo ↗` button (if `demoUrl` is set).
       * `View on GitHub ↗` button (**strictly rendered only if underlying GitHub repository is `PUBLIC`**).
  2. **Project Metrics Strip:**
     * `First Qualifying Commit` date, `Latest Activity` date, `Total Qualifying Commits`.
  3. **Project-Specific Activity Chart:**
     * Scoped timeline for this project alone, with accessible text alternative.
  4. **Approved Overview / README Section:**
     * Clean prose typography (`prose-zinc max-w-none`) rendering sanitized `publicReadmeMarkdown`.
     * For private GitHub repos, renders *only* the manually authored public overview.
  5. **Recent Activity Feed (Conditional):**
     * Rendered only when `publicActivityDetail` permits (`AGGREGATED` counts or `COMMIT_DETAILS` links for public repos).

---

### 3.6 Admin Overview (`/admin`)
* **Auth State:** Authenticated.
* **API Endpoints:**
  * `GET /api/user/me`
  * `GET /api/user/sync-runs` (or sync run logs)
  * `POST /api/auth/github/disconnect`
* **Layout & Sections:**
  1. **System Health Grid (4 Cards):**
     * *GitHub Connection:* Connected as `@login` + `Disconnect GitHub` button (with confirmation modal explaining data retention).
     * *Discovery Status:* Last discovered timestamp + `Discover Now` trigger.
     * *Tracked & Public Counts:* e.g., `8 Tracked / 3 Public`.
     * *Summary Engine:* Active provider (`mock` / `openai`) & daily status.
  2. **Recent Sync Runs Ledger (Minimal Table):**
     * Columns: `Timestamp`, `Repository`, `Trigger` (`ADMIN`, `WEBHOOK`, `SCHEDULED`), `Status` (`COMPLETE`, `RUNNING`, `FAILED`), `Pages / Commits`, `Error Details` (sanitized error code/message if failed).

---

### 3.7 Admin Repositories (`/admin/repositories`)
* **Auth State:** Authenticated.
* **API Endpoints:**
  * `GET /api/user/repositories` (supports `page`, `pageSize`, `q`, `tracking`, `visibility`, `ownerType`, `publicDisplay`)
  * `POST /api/user/repositories/discover`
  * `PATCH /api/user/repositories` (bulk update)
  * `PATCH /api/user/repositories/[id]` (single update)
  * `POST /api/user/repositories/[id]/sync` (manual backfill/sync)
* **Layout & Sections:**
  1. **Header & Discovery Action:**
     * Title: `Repositories` + `Refresh from GitHub` primary button (`POST /api/user/repositories/discover`).
  2. **Filter & Search Toolbar:**
     * Search input (`q`), Dropdowns for `Tracking` (All/Tracked/Untracked), `GitHub Visibility` (All/Public/Private), `Owner Type` (All/Personal/Organization), `Public Display` (All/Enabled/Hidden).
  3. **Bulk Action Bar (Appears when rows are checked):**
     * `Enable Tracking`, `Disable Tracking`, `Enable Public Display`, `Disable Public Display`.
  4. **Minimalist Repository Table:**
     * Columns:
       * Checkbox
       * `Repository` (`owner/name`, `Private`/`Public` badge, `Archived`/`Fork` subtle tags, `defaultBranch` in monospace)
       * `Tracking` (Switch toggle → `PATCH /api/user/repositories/[id]`)
       * `Public Display` (Switch toggle)
       * `Sync / Backfill` (Badge: `Complete`, `Backfilling...`, `Never synced` + `Last Synced` relative time)
       * `Actions`: `Sync Now` button (`POST .../sync`), `Edit Project →` link (`/admin/projects/[id]`).
  5. **Pagination Footer:** `Previous` / `Next` with page count.

---

### 3.8 Admin Projects List (`/admin/projects`) & Project Editor (`/admin/projects/[id]`)

#### A. Projects List (`/admin/projects`)
* **API Endpoints:** `GET /api/user/projects`, `POST /api/user/projects`
* **UX:** Clean list of all tracked repositories and their linked project cards. If a tracked repo lacks a project record, shows an `Initialize Project` action (`POST /api/user/projects`).

#### B. Project Editor (`/admin/projects/[id]`)
* **API Endpoints:**
  * `GET /api/user/projects/[id]`
  * `PATCH /api/user/projects/[id]`
  * `POST /api/user/projects/[id]/readme`
  * `PATCH /api/user/repositories/[id]` (for `publicActivityDetail`)
* **Layout (2-Column Split: Form on Left, Live Privacy & Preview Card on Right):**
  * **Left Column (Editor Form):**
    1. *Identity & Metadata:* `Display Title`, `Project Slug` (with `/u/[username]/projects/[slug]` preview & `409` conflict inline error), `Short Description`, `Demo / Live URL`.
    2. *Manual Status Control:* Segmented control for `ONGOING`, `COMPLETE`, `ON_BREAK`.
    3. *Visibility & Activity Granularity:*
       * Toggle: `Project Visibility` (`PUBLIC` / `PRIVATE`). Warning banner if parent profile is currently `PRIVATE`.
       * Radio group for `publicActivityDetail`:
         * `HIDDEN`: Do not show activity on public timeline.
         * `AGGREGATED`: Show commit counts only (default for private repos).
         * `COMMIT_DETAILS`: Show commit messages & GitHub links *(disabled/locked if underlying GitHub repo is `PRIVATE`)*.
    4. *Public Overview / README Markdown Editor:*
       * Clean monospace textarea with `Write` / `Preview` tabs + `Save Overview` button (`POST /api/user/projects/[id]/readme`).
       * Explicit helper text for private repos: *"This manually approved text is the only description visitors will see. Your private GitHub README is never fetched."*
  * **Right Column (Sticky Preview & Share Panel):**
    * Live preview of how the project card looks publicly.
    * `Copy Public Project URL` button + `Open Public Page ↗` link.

---

### 3.9 Admin Settings (`/admin/settings`)
* **Auth State:** Authenticated.
* **API Endpoints:**
  * `PATCH /api/user/profile`
  * `GET /api/user/settings` & `PATCH /api/user/settings`
  * `GET /api/user/author-emails`, `POST /api/user/author-emails`, `PATCH/DELETE /api/user/author-emails/[id]`
  * `POST /api/auth/github/disconnect`
* **Layout (Single-Column Stacked Sections with `border-b pb-8` dividers):**
  1. **Public Profile & Visibility:**
     * `Profile Visibility` toggle (`PRIVATE` vs `PUBLIC`) with prominent status indicator.
     * `Profile Slug` (`@username` editable input with `409` conflict validation).
     * `Display Name` & `Bio` textarea.
     * `Search Engine Indexing` checkbox (`index` vs `noindex` — with helper note explaining `noindex` does not restrict direct URL access).
     * `Timezone` searchable select (defaults to `Asia/Kolkata`).
  2. **Verified Author Emails (Fallback Commit Attribution):**
     * Explains how commits are matched by GitHub User ID first, then verified emails.
     * Input + `Add Email` button (`POST /api/user/author-emails`).
     * List of added emails with `Verified` toggle (`PATCH`) and `Remove` icon button (`DELETE`).
  3. **Daily AI Summaries Configuration:**
     * Master toggle: `Enable Daily Summaries`.
     * Privacy Opt-In checkbox (unchecked by default): `Allow private repository metadata in private summaries` — accompanied by explicit privacy warning.
     * Optional `Provider` (`mock` / `openai`) and `Model` override inputs.
  4. **Danger / Account Zone:**
     * `Disconnect GitHub Account` (`POST /api/auth/github/disconnect`) — explains sync will pause while preserving imported history.

---

## 4. Reusable Component Architecture (`src/components/`)

Organize components cleanly to match `PROJECT_SPEC_v2.md` Section 6.1 and keep business logic out of presentational UI:

```text
src/components/
  ui/
    Button.tsx              # Minimalist variants: primary, secondary, ghost, danger
    Badge.tsx               # 1px bordered pill badges
    StatusPill.tsx          # ONGOING, COMPLETE, ON_BREAK with colored dot
    Switch.tsx              # Accessible keyboard toggle switch
    CopyButton.tsx          # Copies canonical URL, swaps icon to checkmark for 2s
    EmptyState.tsx          # Clean border-dashed empty state with single action
    Skeleton.tsx            # Subtle pulse placeholders for loading states
  layout/
    PublicHeader.tsx        # Minimal top bar for marketing & /u/[username]
    AppShell.tsx            # Authenticated top nav + container
  timeline/
    ActivityChart.tsx       # Lightweight bar/heatmap chart + interactive day click
    ActivityListAlt.tsx     # Accessible tabular/list view alternative to chart
    DayInspector.tsx        # Selected date metrics, summary card, and commit list
  projects/
    ProjectCard.tsx         # Shared card used on /u/[username] & /dashboard
    MarkdownRenderer.tsx    # Sanitized Markdown display for public READMEs
  summaries/
    DailySummaryCard.tsx    # Renders headline, summary, projectHighlights, regenerate CTA
  admin/
    RepoTable.tsx           # Filterable, paginated repository table with bulk select
    SyncStatusBanner.tsx    # Non-intrusive backfill progress indicator
    PrivacyGuardNotice.tsx  # Explains profile vs. project visibility inheritance
```

---

## 5. UX Guardrails & Privacy-by-Design Rules

1. **Zero Accidental Leakage in UI States:**
   * If a user sets their Profile to `PRIVATE` while projects are `PUBLIC`, display a clear non-blocking banner on `/admin/projects` and `/admin/settings`: *"Your profile is currently private. Public projects will return 404 to visitors until you publish your profile."*
   * Never render a GitHub repository URL, branch name, or commit SHA on public components when `repository.visibility === 'PRIVATE'`.
2. **Optimistic Feedback & Clear Error Handling:**
   * Surface API error codes cleanly in inline alerts:
     * `409 PROFILE_SLUG_CONFLICT` / `PROJECT_SLUG_CONFLICT` → Inline field error: *"This slug is already taken."*
     * `409 GITHUB_NOT_CONNECTED` → Banner with direct `Reconnect GitHub` CTA.
     * `429 RATE_LIMITED` → Calm notice showing retry window without breaking page layout.
3. **Honest Empty & Partial States:**
   * Distinguish **0 commits on a synced day** from **days prior to historical backfill completion**. Show a subtle `"Historical backfill in progress"` indicator until `backfillStatus === 'COMPLETE'`.
4. **Accessibility & Keyboard First:**
   * Every chart must offer a one-click `Chart / List` toggle.
   * All switches, modals, and copy buttons must have clear `aria-label` attributes and visible focus rings (`focus-visible:ring-2 focus-visible:ring-zinc-900`).