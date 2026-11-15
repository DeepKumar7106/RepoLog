import type { ReactNode } from "react";
import { cn } from "@/lib/ui/format";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: Readonly<{
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-canvas text-muted">
          {icon}
        </div>
      ) : null}
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      {description ? (
        <div className="mt-1.5 max-w-md text-sm text-secondary">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}