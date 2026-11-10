import type { ReactNode } from "react";

export function PlaceholderPanel({
  title,
  children,
  milestone = "Milestone 1",
}: Readonly<{
  title: string;
  children: ReactNode;
  milestone?: string;
}>) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <div className="mb-2 flex items-center gap-3">
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {milestone}
        </span>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="text-sm text-slate-600">{children}</div>
    </div>
  );
}
