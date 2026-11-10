import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedSessionUser } from "@/lib/auth/session";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { userRepositoryListQuerySchema } from "@/lib/validation/schemas";
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

  if (options.q) {
    params.set("q", options.q);
  }

  if (options.perPage && options.perPage !== 50) {
    params.set("perPage", String(options.perPage));
  }

  params.set("page", String(page));

  return `/admin/repositories?${params.toString()}`;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
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

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Repositories"
        description="Discover the repositories your GitHub connection can access, then choose which ones RepoLog should track."
      />

      {!connection.connected ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>GitHub is disconnected. Reconnect before discovering or refreshing repositories.</p>
          <Link className="font-semibold underline" href="/api/auth/github/start?mode=reconnect">
            Reconnect GitHub
          </Link>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Discovered</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.total}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Tracked</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.tracked}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Public display enabled</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.publicDisplay}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Last discovery</p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {lastDiscovery
              ? formatDate(lastDiscovery.finishedAt ?? lastDiscovery.startedAt)
              : "Never"}
          </p>
          {lastDiscovery ? (
            <p className="mt-1 text-xs text-slate-500">
              {lastDiscovery.status} · {lastDiscovery.pagesProcessed} page(s)
            </p>
          ) : null}
          {lastDiscovery?.status === "FAILED" && lastDiscovery.errorMessage ? (
            <p className="mt-1 text-xs text-red-700">{lastDiscovery.errorMessage}</p>
          ) : null}
        </Card>
      </div>

      <div className="mb-6">
        <DiscoveryControls connected={connection.connected} total={counts.total} />
      </div>

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600" htmlFor="q">
              Search
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              defaultValue={options.q ?? ""}
              id="q"
              name="q"
              placeholder="Name or description"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="owner">
              Owner login
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              defaultValue={options.owner ?? ""}
              id="owner"
              name="owner"
              placeholder="octocat"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="ownerType">
              Owner type
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              defaultValue={options.ownerType ?? ""}
              id="ownerType"
              name="ownerType"
            >
              <option value="">All owners</option>
              <option value="USER">Personal</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="visibility">
              Visibility
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              defaultValue={options.visibility ?? ""}
              id="visibility"
              name="visibility"
            >
              <option value="">All visibility</option>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="archived">
              Archived
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              defaultValue={options.archived === undefined ? "" : String(options.archived)}
              id="archived"
              name="archived"
            >
              <option value="">All states</option>
              <option value="false">Active</option>
              <option value="true">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="tracking">
              Tracking
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              defaultValue={options.tracking === undefined ? "" : String(options.tracking)}
              id="tracking"
              name="tracking"
            >
              <option value="">All</option>
              <option value="true">Tracked</option>
              <option value="false">Not tracked</option>
            </select>
          </div>

          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
            <button
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              Apply filters
            </button>
            <Link
              className="text-sm font-medium text-slate-600 underline"
              href="/admin/repositories"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      {repositories.length === 0 ? (
        <Card>
          <h2 className="font-semibold text-slate-900">No repositories found</h2>
          <p className="mt-2 text-sm text-slate-600">
            {counts.total === 0
              ? "Run discovery to load the personal and organization repositories your GitHub connection can access."
              : "No repositories match the current filters. Reset the filters or search for a different repository."}
          </p>
        </Card>
      ) : (
        <RepositoryTable repositories={repositories} />
      )}

      {repositoryPage.totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Page {repositoryPage.page} of {repositoryPage.totalPages} · {repositoryPage.total}{" "}
            repositories
          </p>
          <div className="flex gap-4">
            {repositoryPage.page > 1 ? (
              <Link
                className="font-medium text-slate-900 underline"
                href={pageHref(repositoryPage.page - 1, options)}
              >
                Previous
              </Link>
            ) : null}
            {repositoryPage.page < repositoryPage.totalPages ? (
              <Link
                className="font-medium text-slate-900 underline"
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
