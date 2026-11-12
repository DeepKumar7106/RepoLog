import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { DailySummaryDto } from "@/server/services/summary-service";
import { RegenerateSummaryButton } from "./regenerate-summary-button";

type SummaryProject = {
  id: string;
  displayTitle: string;
  href?: string;
};

type DailySummaryCardProps = Readonly<{
  summary: DailySummaryDto | null;
  date: string;
  timezone: string;
  projects?: SummaryProject[];
  canRegenerate?: boolean;
  regenerateScope?: "PUBLIC" | "PRIVATE";
}>;

function formatDateKey(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function DailySummaryCard({
  summary,
  date,
  timezone,
  projects = [],
  canRegenerate = false,
  regenerateScope = "PRIVATE",
}: DailySummaryCardProps) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Daily summary</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateKey(date)} · {timezone}
          </p>
        </div>
        {canRegenerate && summary ? (
          <RegenerateSummaryButton date={date} scope={summary.scope} />
        ) : null}
      </div>

      {!summary ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            No summary is available for this day yet. Summaries are optional and are generated after
            the local day ends.
          </p>
          {canRegenerate ? <RegenerateSummaryButton date={date} scope={regenerateScope} /> : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {summary.headline ? (
            <p className="text-lg font-semibold text-slate-900">{summary.headline}</p>
          ) : null}
          {summary.summary ? (
            <p className="text-sm leading-6 whitespace-pre-line text-slate-700">
              {summary.summary}
            </p>
          ) : null}
          {summary.projectHighlights.length > 0 ? (
            <ul className="space-y-2">
              {summary.projectHighlights.map((highlight) => {
                const project = projectById.get(highlight.projectId);
                const title = project?.displayTitle ?? "Project";

                return (
                  <li
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                    key={`${highlight.projectId}-${highlight.text}`}
                  >
                    {project?.href ? (
                      <Link className="font-semibold text-slate-900 underline" href={project.href}>
                        {title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-900">{title}</span>
                    )}
                    <span className="mt-1 block">{highlight.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="text-xs text-slate-500">
            {summary.scope === "PUBLIC" ? "Public summary" : "Private summary"}
            {summary.provider ? ` · ${summary.provider}` : ""}
            {summary.model ? ` · ${summary.model}` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
