import { Filter, FolderGit2, RotateCcw, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Input, Select } from "@/components/ui/form-controls";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { userRepositoryListQuerySchema } from "@/lib/validation/schemas";
import { formatDateTime, formatNumber } from "@/lib/ui/format";
import { toUserRepositoryDto } from "@/server/dto/user-repository-dto";
import type { UserRepositoryListOptions } from "@/server/services/user-repository-service";
import { services } from "@/server/services";
import { DiscoveryControls } from "./discovery-controls";
import { RepositoryTable } from "./repository-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Repositories",
};

type SearchParams = Record<string, string | string[] | undefined>;

function normalizeQuery(raw: SearchParams): Record<string, string> {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;

    if (first !== undefined && first !== "") {
      query[key] = first;
    }
  }

  return query;
}

function pageHref(page: number, options: UserRepositoryListOptions): string {
  const params = new URLSearchParams();

  if (options.owner) {
    params.set("owner", options.owner);
  }

  if (options.ownerType) {
    params.set("ownerType", options.ownerType);
  }

  if (options.visibility) {
    params.set("visibility", options.visibility);
  }

  if (options.archived !== undefined) {
    params.set("archived", String(options.archived));
  }

  if (options.tracking !== undefined) {
    params.set("tracking", String(options.tracking));
  }

  if (options.publicDisplay !== undefined) {
    params.set("publicDisplay", String(options.publicDisplay));
  }

  if (options.q) {
    params.set("q", options.q);
  }

  if (options.perPage && options.perPage !== 50) {
    params.set("perPage", String(options.perPage));
  }

  params.set("page", String(page));

  return `/admin/repositories?${params.toString()}`;
}

function filterLabel(name: string, value: string): string {
  return `${name}: ${value}`;
}

export default async function AdminRepositoriesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const session = await requireOnboardedSessionUser();
  const tenant = createTenantContext(session.userId);
  const rawQuery = await searchParams;
  const parsedQuery = userRepositoryListQuerySchema.safeParse(normalizeQuery(rawQuery));
  const options: UserRepositoryListOptions = parsedQuery.success ? parsedQuery.data : {};

  const [repositoryPage, counts, lastDiscovery, connection] = await Promise.all([
    services.userRepositories.listPage(tenant, options),
    services.userRepositories.counts(tenant),
    services.syncRuns.lastDiscovery(tenant),
    services.githubConnection.get(tenant),
  ]);

  const repositories = repositoryPage.records.map(toUserRepositoryDto);
  const activeFilters = [
    options.q ? filterLabel("Search", options.q) : null,
    options.owner ? filterLabel("Owner", options.owner) : null,
    options.ownerType ? filterLabel("Owner type", options.ownerType) : null,
    options.visibility ? filterLabel("Visibility", options.visibility) : null,
    options.archived !== undefined ? filterLabel("Archived", String(options.archived)) : null,
    options.tracking !== undefined ? filterLabel("Tracking", String(options.tracking)) : null,
    options.publicDisplay !== undefined
      ? filterLabel("Public display", String(options.publicDisplay))
      : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Repositories"
        description="Discover repositories your GitHub connection can access, then choose what RepoLog tracks and what can appear publicly."
      />

      {!connection.connected ? (
        <Alert
          action={
            <a
              className="inline-flex h-8 items-center rounded-md border border-amber-300/60 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
              href="/api/auth/github/start?mode=reconnect"
            >
              Reconnect GitHub
            </a>
          }
          className="mb-6"
          tone="warning"
        >
          GitHub is disconnected. Reconnect before discovering or refreshing repositories.
        </Alert>
      ) : null}

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Discovered</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(counts.total)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Tracked</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(counts.tracked)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Public display enabled</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-primary tabular-nums">
            {formatNumber(counts.publicDisplay)}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-4">
          <dt className="text-[11px] text-muted">Last discovery</dt>
          <dd className="mt-1.5 truncate text-sm font-medium text-primary">
            {lastDiscovery
              ? formatDateTime(lastDiscovery.finishedAt ?? lastDiscovery.startedAt)
              : "Never"}
          </dd>
          {lastDiscovery ? (
            <dd className="mt-0.5 text-[11px] text-muted">
              {lastDiscovery.status} · {lastDiscovery.pagesProcessed} page
              {lastDiscovery.pagesProcessed === 1 ? "" : "s"}
            </dd>
          ) : null}
          {lastDiscovery?.status === "FAILED" && lastDiscovery.errorMessage ? (
            <dd className="mt-1 line-clamp-2 text-[11px] text-red-600 dark:text-red-400">
              {lastDiscovery.errorMessage}
            </dd>
          ) : null}
        </div>
      </dl>

      <div className="mb-6">
        <DiscoveryControls connected={connection.connected} total={counts.total} />
      </div>

      <section className="mb-4 rounded-lg border border-line bg-canvas">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Filter aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
          <h2 className="text-xs font-semibold text-primary">Filters</h2>
          {activeFilters.length > 0 ? (
            <span className="rounded-full border border-line px-1.5 text-[10px] text-muted">
              {activeFilters.length}
            </span>
          ) : null}
        </div>
        <form className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="q">
              Search
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              />
              <Input
                className="pl-8 text-xs"
                defaultValue={options.q ?? ""}
                id="q"
                name="q"
                placeholder="Name or description"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="owner">
              Owner login
            </label>
            <Input
              className="text-xs"
              defaultValue={options.owner ?? ""}
              id="owner"
              name="owner"
              placeholder="octocat"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="ownerType">
              Owner type
            </label>
            <Select
              className="text-xs"
              defaultValue={options.ownerType ?? ""}
              id="ownerType"
              name="ownerType"
            >
              <option value="">All owners</option>
              <option value="USER">Personal</option>
              <option value="ORGANIZATION">Organization</option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="visibility">
              Visibility
            </label>
            <Select
              className="text-xs"
              defaultValue={options.visibility ?? ""}
              id="visibility"
              name="visibility"
            >
              <option value="">All visibility</option>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="archived">
              Archived
            </label>
            <Select
              className="text-xs"
              defaultValue={options.archived === undefined ? "" : String(options.archived)}
              id="archived"
              name="archived"
            >
              <option value="">All states</option>
              <option value="false">Active</option>
              <option value="true">Archived</option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="tracking">
              Tracking
            </label>
            <Select
              className="text-xs"
              defaultValue={options.tracking === undefined ? "" : String(options.tracking)}
              id="tracking"
              name="tracking"
            >
              <option value="">All</option>
              <option value="true">Tracked</option>
              <option value="false">Not tracked</option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="publicDisplay">
              Public display
            </label>
            <Select
              className="text-xs"
              defaultValue={
                options.publicDisplay === undefined ? "" : String(options.publicDisplay)
              }
              id="publicDisplay"
              name="publicDisplay"
            >
              <option value="">All</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </div>

          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              type="submit"
            >
              Apply filters
            </button>
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              href="/admin/repositories"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Reset
            </Link>
            {activeFilters.length > 0 ? (
              <span className="ml-auto hidden text-[11px] text-muted sm:inline">
                {activeFilters.join(" · ")}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {repositories.length === 0 ? (
        <EmptyState
          description={
            counts.total === 0
              ? "Run discovery to load the personal and organization repositories your GitHub connection can access."
              : "No repositories match the current filters. Reset the filters or search for a different repository."
          }
          icon={<FolderGit2 aria-hidden="true" className="h-4 w-4" />}
          title="No repositories found"
        />
      ) : (
        <RepositoryTable repositories={repositories} />
      )}

      {repositoryPage.totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-2 text-xs text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular">
            Page {repositoryPage.page} of {repositoryPage.totalPages} · {repositoryPage.total}{" "}
            repositories
          </p>
          <div className="flex gap-2">
            {repositoryPage.page > 1 ? (
              <Link
                className="inline-flex h-8 items-center rounded-md border border-line bg-canvas px-3 font-medium text-primary hover:bg-hover"
                href={pageHref(repositoryPage.page - 1, options)}
              >
                Previous
              </Link>
            ) : null}
            {repositoryPage.page < repositoryPage.totalPages ? (
              <Link
                className="inline-flex h-8 items-center rounded-md border border-line bg-canvas px-3 font-medium text-primary hover:bg-hover"
                href={pageHref(repositoryPage.page + 1, options)}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}