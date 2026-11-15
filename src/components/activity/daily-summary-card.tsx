import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
            <Sparkles aria-hidden="true" className="h-3 w-3" />
            Daily summary
          </p>
          <h2 className="mt-1.5 text-sm font-semibold text-primary">{formatDateKey(date)}</h2>
          <p className="mt-1 text-xs text-secondary">
            <span className="tabular">{timezone}</span>
            {summary ? (
              <>
                <span className="px-1 text-muted">·</span>
                <Badge tone={summary.scope === "PUBLIC" ? "info" : "neutral"} className="ml-1">
                  {summary.scope === "PUBLIC" ? "Public summary" : "Private summary"}
                </Badge>
              </>
            ) : null}
          </p>
        </div>
        {canRegenerate && summary ? (
          <RegenerateSummaryButton date={date} scope={summary.scope} />
        ) : null}
      </div>

      {!summary ? (
        <div className="mt-4">
          <EmptyState
            className="py-8"
            description="No summary is available for this day yet. Summaries are optional and are generated after the local day ends."
            title="No summary yet"
            action={canRegenerate ? <RegenerateSummaryButton date={date} scope={regenerateScope} /> : undefined}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {summary.headline ? (
            <p className="text-base leading-6 font-semibold text-primary">{summary.headline}</p>
          ) : null}
          {summary.summary ? (
            <p className="text-sm leading-6 whitespace-pre-line text-secondary">{summary.summary}</p>
          ) : null}
          {summary.projectHighlights.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {summary.projectHighlights.map((highlight) => {
                const project = projectById.get(highlight.projectId);
                const title = project?.displayTitle ?? "Project";

                return (
                  <li
                    className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-secondary"
                    key={`${highlight.projectId}-${highlight.text}`}
                  >
                    {project?.href ? (
                      <Link
                        className="font-medium text-primary underline decoration-line underline-offset-4 hover:decoration-current"
                        href={project.href}
                      >
                        {title}
                      </Link>
                    ) : (
                      <span className="font-medium text-primary">{title}</span>
                    )}
                    <span className="mt-1 block text-xs leading-5">{highlight.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="font-mono text-[10px] text-muted">
            {summary.provider ?? "Generated summary"}
            {summary.model ? ` · ${summary.model}` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}