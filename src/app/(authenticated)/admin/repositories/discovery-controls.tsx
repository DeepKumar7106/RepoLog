"use client";

import { CheckCheck, RefreshCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas">
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 text-secondary" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-primary">Repository discovery</h2>
            <p className="mt-0.5 text-xs leading-5 text-secondary">
              Refresh the list from GitHub, then track everything or manage repositories
              individually below.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            disabled={!connected || isDiscovering}
            loading={isDiscovering}
            onClick={discover}
            size="sm"
          >
            {isDiscovering ? null : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
            {isDiscovering ? "Discovering…" : "Refresh repositories"}
          </Button>
          <Button
            disabled={!connected || isBulkSaving || total === 0}
            onClick={() => setAllTracking(true)}
            size="sm"
            variant="secondary"
          >
            <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Track all
          </Button>
          <Button
            disabled={!connected || isBulkSaving || total === 0}
            onClick={() => setAllTracking(false)}
            size="sm"
            variant="secondary"
          >
            <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
            Untrack all
          </Button>
        </div>
      </div>

      {message ? (
        <div className="border-t border-line p-4">
          <Alert tone="success">{message}</Alert>
        </div>
      ) : null}

      {error ? (
        <div className="border-t border-line p-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </section>
  );
}