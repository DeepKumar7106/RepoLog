"use client";

import { ArrowUpRight, FolderGit2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { relativeTime } from "@/lib/ui/format";
import type { UserRepositoryDto } from "@/server/dto/user-repository-dto";
import { GithubIcon } from "@/components/ui/github-icon";

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

function syncTone(status: UserRepositoryDto["syncStatus"]): BadgeTone {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "danger";
    case "PARTIAL":
      return "warning";
    case "RUNNING":
    case "PENDING":
      return "info";
    default:
      return "neutral";
  }
}

function syncLabel(status: UserRepositoryDto["syncStatus"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "Synced";
    case "FAILED":
      return "Failed";
    case "PARTIAL":
      return "Partial";
    case "RUNNING":
      return "Syncing";
    case "PENDING":
      return "Pending";
    default:
      return "Idle";
  }
}

function backfillLabel(status: UserRepositoryDto["backfillStatus"]): string {
  return status.toLowerCase().replaceAll("_", " ");
}

export function RepositoryTable({ repositories }: RepositoryTableProps) {
  const router = useRouter();
  const [rows, applyOptimistic] = useOptimistic(
    repositories,
    (current, update: { ids: string[]; patch: RepositoryPatch }) =>
      current.map((row) => (update.ids.includes(row.id) ? { ...row, ...update.patch } : row)),
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const selectedCount = selectedIds.size;

  function markSaving(ids: string[], saving: boolean) {
    setSavingIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (saving) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function update(repository: UserRepositoryDto, patch: RepositoryPatch) {
    applyUpdate([repository.id], patch);
  }

  function applyUpdate(ids: string[], patch: RepositoryPatch) {
    if (ids.length === 0) return;
    setError(null);
    markSaving(ids, true);

    startTransition(async () => {
      applyOptimistic({ ids, patch });

      try {
        const response =
          ids.length === 1
            ? await fetch(`/api/user/repositories/${ids[0]}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
              })
            : await fetch("/api/user/repositories", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, ...patch }),
              });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
          throw new Error(payload?.error?.message ?? "Could not update the repository.");
        }

        if (ids.length > 1) {
          setSelectedIds(new Set());
        }
        router.refresh();
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : "Could not update the repository.",
        );
      } finally {
        markSaving(ids, false);
      }
    });
  }

  function bulkUpdate(patch: RepositoryPatch) {
    applyUpdate([...selectedIds], patch);
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
    <div className="overflow-hidden rounded-lg border border-line bg-canvas">
      {error ? (
        <div className="border-b border-line p-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      {syncNotice ? (
        <div className="border-b border-line p-3">
          <Alert tone="success">{syncNotice}</Alert>
        </div>
      ) : null}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2.5">
          <p className="mr-1 text-[11px] font-medium text-secondary">{selectedCount} selected</p>
          <Button
            onClick={() => bulkUpdate({ trackingEnabled: true })}
            size="xs"
            variant="secondary"
          >
            Enable tracking
          </Button>
          <Button
            onClick={() => bulkUpdate({ trackingEnabled: false })}
            size="xs"
            variant="secondary"
          >
            Disable tracking
          </Button>
          <Button
            onClick={() => bulkUpdate({ publicDisplayEnabled: true })}
            size="xs"
            variant="secondary"
          >
            Enable public display
          </Button>
          <Button
            onClick={() => bulkUpdate({ publicDisplayEnabled: false })}
            size="xs"
            variant="secondary"
          >
            Disable public display
          </Button>
          <button
            className="ml-auto rounded px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onClick={() => setSelectedIds(new Set())}
            type="button"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[980px] divide-y divide-line text-sm">
          <thead className="bg-surface text-left text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
            <tr>
              <th className="w-10 px-4 py-2.5 font-medium">
                <input
                  aria-label="Select all repositories"
                  checked={allSelected}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-line accent-accent"
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Repository</th>
              <th className="px-4 py-2.5 font-medium">Access</th>
              <th className="px-4 py-2.5 font-medium">Tracking</th>
              <th className="px-4 py-2.5 font-medium">Public display</th>
              <th className="px-4 py-2.5 font-medium">Sync</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const isSaving = savingIds.has(row.id);
              const isSyncing = syncingIds.has(row.id);

              return (
                <tr className="align-top transition-colors hover:bg-hover/40" key={row.id}>
                  <td className="px-4 py-3.5">
                    <input
                      aria-label={`Select ${row.repository.name}`}
                      checked={selectedIds.has(row.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-line accent-accent"
                      onChange={() => toggleOne(row.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="w-[34%] px-4 py-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-surface">
                        <FolderGit2 aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-xs font-medium text-primary">
                            {row.repository.name}
                          </p>
                          {row.repository.isArchived ? (
                            <span className="rounded border border-line px-1 text-[9px] text-muted">
                              archived
                            </span>
                          ) : null}
                          {row.repository.isFork ? (
                            <span className="rounded border border-line px-1 text-[9px] text-muted">
                              fork
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate font-mono text-[10px] text-muted">
                          {row.repository.ownerLogin} ·{" "}
                          {row.repository.ownerType === "ORGANIZATION"
                            ? "Organization"
                            : "Personal"}
                        </p>
                        {row.repository.description ? (
                          <p className="mt-1 line-clamp-2 max-w-sm text-[11px] leading-5 text-secondary">
                            {row.repository.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-muted">
                          Discovered {relativeTime(row.lastDiscoveredAt)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col items-start gap-1.5">
                      <VisibilityBadge visibility={row.repository.visibility} />
                      <span className="font-mono text-[10px] text-muted">
                        {row.repository.defaultBranch}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Switch
                      checked={row.trackingEnabled}
                      className="min-w-32"
                      disabled={isSaving}
                      label={row.trackingEnabled ? "Tracked" : "Not tracked"}
                      onCheckedChange={(checked) => update(row, { trackingEnabled: checked })}
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <Switch
                      checked={row.publicDisplayEnabled}
                      className="min-w-32"
                      disabled={isSaving || !row.trackingEnabled}
                      label={row.publicDisplayEnabled ? "Enabled" : "Disabled"}
                      onCheckedChange={(checked) => update(row, { publicDisplayEnabled: checked })}
                    />
                    <p className="mt-1 max-w-[10rem] text-[10px] leading-4 text-muted">
                      Only appears after the project is published.
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col items-start gap-1">
                      <Badge dot tone={syncTone(row.syncStatus)}>
                        {syncLabel(row.syncStatus)}
                      </Badge>
                      <span className="text-[10px] text-muted">
                        {row.lastSyncedAt ? relativeTime(row.lastSyncedAt) : "Never synced"}
                      </span>
                      <span className="text-[10px] text-muted">
                        Backfill: {backfillLabel(row.backfillStatus)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        disabled={
                          isSaving ||
                          isSyncing ||
                          !row.trackingEnabled ||
                          row.syncStatus === "RUNNING"
                        }
                        loading={isSyncing}
                        onClick={() => syncRepository(row)}
                        size="xs"
                        title={
                          !row.trackingEnabled
                            ? "Enable tracking before syncing this repository"
                            : "Fetch commit history from GitHub"
                        }
                        variant="secondary"
                      >
                        {isSyncing ? null : <RefreshCw aria-hidden="true" className="h-3 w-3" />}
                        {isSyncing ? "Syncing…" : row.syncStatus === "RUNNING" ? "Running" : "Sync"}
                      </Button>
                      <Link
                        className="inline-flex items-center gap-1 rounded text-[10px] font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        href={row.project ? `/admin/projects/${row.project.id}` : "/admin/projects"}
                      >
                        {row.project ? "Edit project" : "Project details"}
                        <ArrowUpRight aria-hidden="true" className="h-2.5 w-2.5" />
                      </Link>
                      <a
                        className="inline-flex items-center gap-1 rounded text-[10px] font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        href={row.repository.htmlUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <GithubIcon aria-hidden="true" className="h-2.5 w-2.5" />
                        GitHub
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
