import type { ReactNode } from "react";
import { cn } from "@/lib/ui/format";

export type BadgeTone = "neutral" | "outline" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface text-secondary",
  outline: "border-line bg-transparent text-secondary",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-400",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: Readonly<{
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}