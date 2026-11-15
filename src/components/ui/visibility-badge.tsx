import { Globe, Lock } from "lucide-react";
import { cn } from "@/lib/ui/format";

export function VisibilityBadge({
  visibility,
  className,
  showIcon = true,
}: Readonly<{
  visibility: "PUBLIC" | "PRIVATE" | string;
  className?: string;
  showIcon?: boolean;
}>) {
  const isPublic = visibility === "PUBLIC";
  const Icon = isPublic ? Globe : Lock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        isPublic
          ? "border-line bg-canvas text-secondary"
          : "border-line bg-surface text-muted",
        className,
      )}
    >
      {showIcon ? <Icon aria-hidden="true" className="h-3 w-3" /> : null}
      {isPublic ? "Public" : "Private"}
    </span>
  );
}