"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type RegenerateSummaryButtonProps = Readonly<{
  date: string;
  scope: "PUBLIC" | "PRIVATE";
}>;

export function RegenerateSummaryButton({ date, scope }: RegenerateSummaryButtonProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/user/summaries/${encodeURIComponent(date)}/regenerate?scope=${scope}`,
        { method: "POST" },
      );

      if (!response.ok) {
        setError("Could not regenerate the summary.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not regenerate the summary.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button loading={isBusy} onClick={regenerate} size="sm" variant="secondary">
        {isBusy ? null : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
        {isBusy ? "Regenerating…" : "Regenerate"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}