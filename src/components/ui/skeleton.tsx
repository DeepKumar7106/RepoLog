import { cn } from "@/lib/ui/format";

export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return <div className={cn("animate-pulse rounded-md bg-hover", className)} />;
}