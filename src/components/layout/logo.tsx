import Link from "next/link";
import { GitBranch } from "lucide-react";
import { cn } from "@/lib/ui/format";

export function Logo({ className, href = "/" }: Readonly<{ className?: string; href?: string }>) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        className,
      )}
      href={href}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface">
        <GitBranch aria-hidden="true" className="h-4 w-4" />
      </span>
      <span>RepoLog</span>
    </Link>
  );
}