"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DiscoveryResult = {
  discovered: number;
  created: number;
  updated: number;
  pages: number;
  lastDiscoveredAt: string;
};

type ErrorPayload = {
  error?: {
    message?: string;
  };
};

type DiscoveryControlsProps = {
  connected: boolean;
  total: number;
};

export function DiscoveryControls({ connected, total }: DiscoveryControlsProps) {
  const router = useRouter();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function discover() {
    setIsDiscovering(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/user/repositories/discover", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        data?: DiscoveryResult;
        error?: ErrorPayload["error"];
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Repository discovery failed.");
        return;
      }

      const result = payload?.data;

      if (result) {
        setMessage(
          `Discovered ${result.discovered} repositories (${result.created} new, ${result.updated} existing) across ${result.pages} page(s).`,
        );
      }

      router.refresh();
    } catch {
      setError("Repository discovery failed. Please try again.");
    } finally {
      setIsDiscovering(false);
    }
  }

  async function setAllTracking(trackingEnabled: boolean) {
    if (
      !trackingEnabled &&
      !window.confirm(
        "Stop tracking all discovered repositories? Existing imported data is retained.",
      )
    ) {
      return;
    }

    setIsBulkSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/user/repositories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingEnabled }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { updated?: number };
        error?: ErrorPayload["error"];
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not update repositories.");
        return;
      }

      setMessage(
        `${trackingEnabled ? "Tracking" : "Stopped tracking"} ${payload?.data?.updated ?? 0} repositories.`,
      );
      router.refresh();
    } catch {
      setError("Could not update repositories. Please try again.");
    } finally {
      setIsBulkSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={!connected || isDiscovering}
          onClick={discover}
          type="button"
        >
          {isDiscovering ? "Discovering…" : "Refresh repositories"}
        </button>
        <button
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
          disabled={!connected || isBulkSaving || total === 0}
          onClick={() => setAllTracking(true)}
          type="button"
        >
          Track all discovered
        </button>
        <button
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
          disabled={!connected || isBulkSaving || total === 0}
          onClick={() => setAllTracking(false)}
          type="button"
        >
          Untrack all
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
