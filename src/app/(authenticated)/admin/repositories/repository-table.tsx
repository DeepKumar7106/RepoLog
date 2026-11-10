"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import type { UserRepositoryDto } from "@/server/dto/user-repository-dto";

type RepositoryTableProps = {
  repositories: UserRepositoryDto[];
};

type RepositoryPatch = {
  trackingEnabled?: boolean;
  publicDisplayEnabled?: boolean;
};

type ErrorPayload = {
  error?: {
    message?: string;
  };
};

type SyncPayload = ErrorPayload & {
  data?: {
    hasMore?: boolean;
    commitsInserted?: number;
  };
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function RepositoryTable({ repositories }: RepositoryTableProps) {
  const router = useRouter();
  const [rows, applyOptimistic] = useOptimistic(
    repositories,
    (current, update: { id: string; patch: RepositoryPatch }) =>
      current.map((row) => (row.id === update.id ? { ...row, ...update.patch } : row)),
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  function update(repository: UserRepositoryDto, patch: RepositoryPatch) {
    setError(null);
    setSavingIds((current) => {
      const next = new Set(current);
      next.add(repository.id);
      return next;
    });

    startTransition(async () => {
      applyOptimistic({ id: repository.id, patch });

      try {
        const response = await fetch(`/api/user/repositories/${repository.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
          throw new Error(payload?.error?.message ?? "Could not update the repository.");
        }

        router.refresh();
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : "Could not update the repository.",
        );
      } finally {
        setSavingIds((current) => {
          const next = new Set(current);
          next.delete(repository.id);
          return next;
        });
      }
    });
  }

  async function syncRepository(repository: UserRepositoryDto) {
    setError(null);
    setSyncNotice(null);
    setSyncingIds((current) => {
      const next = new Set(current);
      next.add(repository.id);
      return next;
    });

    try {
      const response = await fetch(`/api/user/repositories/${repository.id}/sync`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as SyncPayload | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Could not sync the repository.");
      }

      const inserted = payload?.data?.commitsInserted ?? 0;
      setSyncNotice(
        payload?.data?.hasMore
          ? `Backfill progress saved with ${inserted} new commit(s). Run sync again to continue.`
          : `Sync complete with ${inserted} new commit(s).`,
      );
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not sync the repository.");
    } finally {
      setSyncingIds((current) => {
        const next = new Set(current);
        next.delete(repository.id);
        return next;
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      {error ? (
        <p className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : null}
      {syncNotice ? (
        <p className="border-b border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {syncNotice}
        </p>
      ) : null}

      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3">Repository</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Visibility</th>
            <th className="px-4 py-3">Default branch</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Tracking</th>
            <th className="px-4 py-3">Public display</th>
            <th className="px-4 py-3">Sync</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const isSaving = savingIds.has(row.id);
            const isSyncing = syncingIds.has(row.id);

            return (
              <tr className="align-top" key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{row.repository.name}</p>
                  <p className="text-xs text-slate-500">{row.repository.fullName}</p>
                  {row.repository.description ? (
                    <p className="mt-1 max-w-xs text-xs text-slate-600">
                      {row.repository.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">
                    Last discovered {formatDate(row.lastDiscoveredAt)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-900">{row.repository.ownerLogin}</p>
                  <p className="text-xs text-slate-500">
                    {row.repository.ownerType === "ORGANIZATION" ? "Organization" : "Personal"}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {row.repository.visibility === "PUBLIC" ? "Public" : "Private"}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.repository.defaultBranch}</td>
                <td className="px-4 py-3 text-slate-700">
                  {row.repository.isArchived ? "Archived" : "Active"}
                  {row.repository.isFork ? " · Fork" : ""}
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      checked={row.trackingEnabled}
                      disabled={isSaving}
                      onChange={(event) => update(row, { trackingEnabled: event.target.checked })}
                      type="checkbox"
                    />
                    <span className="text-slate-700">
                      {row.trackingEnabled ? "Tracked" : "Not tracked"}
                    </span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      checked={row.publicDisplayEnabled}
                      disabled={isSaving}
                      onChange={(event) =>
                        update(row, { publicDisplayEnabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <span className="text-slate-700">
                      {row.publicDisplayEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                  <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
                    Only appears publicly after the project is published.
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">
                    {row.lastSyncedAt ? formatDate(row.lastSyncedAt) : "Never"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.syncStatus} · {row.backfillStatus}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <a
                      className="font-medium text-slate-900 underline"
                      href={row.repository.htmlUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open on GitHub
                    </a>
                    <Link
                      className="font-medium text-slate-900 underline"
                      href={row.project ? `/admin/projects/${row.project.id}` : "/admin/projects"}
                    >
                      {row.project ? "Edit project details" : "Project details"}
                    </Link>
                    <button
                      className="text-left font-medium text-slate-900 underline disabled:text-slate-400 disabled:no-underline"
                      disabled={isSaving || isSyncing || !row.trackingEnabled || row.syncStatus === "RUNNING"}
                      onClick={() => syncRepository(row)}
                      title={
                        !row.trackingEnabled
                          ? "Enable tracking before syncing this repository"
                          : "Fetch commit history from GitHub"
                      }
                      type="button"
                    >
                      {isSyncing
                        ? "Syncing..."
                        : row.syncStatus === "RUNNING"
                          ? "Sync running"
                          : "Sync now"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
