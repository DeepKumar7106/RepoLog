"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="text-right">
      <button
        className="text-xs font-semibold text-slate-700 underline disabled:opacity-60"
        disabled={isBusy}
        onClick={regenerate}
        type="button"
      >
        {isBusy ? "Regenerating\u2026" : "Regenerate summary"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
