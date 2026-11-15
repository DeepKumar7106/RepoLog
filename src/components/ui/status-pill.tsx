import { cn } from "@/lib/ui/format";

export type StatusValue = "ONGOING" | "COMPLETE" | "ON_BREAK";

const statusConfig: Record<StatusValue, { label: string; dot: string }> = {
  ONGOING: { label: "Ongoing", dot: "bg-emerald-500" },
  COMPLETE: { label: "Complete", dot: "bg-sky-500" },
  ON_BREAK: { label: "On Break", dot: "bg-amber-500" },
};

export function StatusPill({
  status,
  className,
}: Readonly<{ status: StatusValue | string; className?: string }>) {
  const config = statusConfig[status as StatusValue] ?? {
    label: status.replaceAll("_", " "),
    dot: "bg-zinc-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-secondary whitespace-nowrap",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}