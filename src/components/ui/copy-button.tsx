"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

type CopyButtonProps = Readonly<{
  url: string;
  label?: string;
  copiedLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showLabel?: boolean;
}>;

export function CopyButton({
  url,
  label = "Copy link",
  copiedLabel = "Copied",
  variant = "secondary",
  size = "sm",
  className,
  showLabel = true,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    setError(false);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
      window.setTimeout(() => setError(false), 3000);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        aria-label={label}
        className={className}
        onClick={copy}
        size={size}
        variant={variant}
      >
        {copied ? (
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {showLabel ? <span>{copied ? copiedLabel : error ? "Copy failed" : label}</span> : null}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : error ? "Copy failed" : ""}
      </span>
    </span>
  );
}