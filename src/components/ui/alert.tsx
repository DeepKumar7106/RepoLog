import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/format";

export type AlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AlertTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  danger:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: Readonly<{
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  const Icon = icons[tone];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-start sm:justify-between",
        toneClasses[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? <div className={title ? "mt-1 opacity-90" : undefined}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pl-4">{action}</div> : null}
    </div>
  );
}