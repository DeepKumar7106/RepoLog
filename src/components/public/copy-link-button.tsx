"use client";

import { useState } from "react";

type CopyLinkButtonProps = Readonly<{
  label?: string;
  url: string;
}>;

export function CopyLinkButton({ label = "Copy link", url }: CopyLinkButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Copied");
    } catch {
      setMessage("Could not copy");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
        onClick={copy}
        type="button"
      >
        {label}
      </button>
      {message ? (
        <span className="text-xs text-slate-500" role="status">
          {message}
        </span>
      ) : null}
    </span>
  );
}
