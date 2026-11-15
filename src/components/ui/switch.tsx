"use client";

import { cn } from "@/lib/ui/format";

type SwitchProps = Readonly<{
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  id?: string;
  className?: string;
}>;

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  id,
  className,
}: SwitchProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label className="text-sm font-medium text-primary" htmlFor={id}>
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-secondary">{description}</p> : null}
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          checked ? "border-accent bg-accent" : "border-line-strong bg-hover",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
        disabled={disabled}
        id={id}
        onClick={() => onCheckedChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-canvas transition-transform",
            checked ? "translate-x-[1.1rem]" : "translate-x-[0.15rem]",
          )}
        />
      </button>
    </div>
  );
}