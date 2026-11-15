import type { ReactNode } from "react";
import { cn } from "@/lib/ui/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: Readonly<{
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
        {description ? <p className="mt-1 text-xs text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}