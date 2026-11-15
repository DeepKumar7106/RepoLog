import type { ReactNode } from "react";
import { cn } from "@/lib/ui/format";

export function Card({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section className={cn("rounded-lg border border-line bg-canvas p-5", className)}>
      {children}
    </section>
  );
}