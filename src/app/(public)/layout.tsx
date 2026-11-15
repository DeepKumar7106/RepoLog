import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/public-shell";

export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PublicShell>{children}</PublicShell>;
}