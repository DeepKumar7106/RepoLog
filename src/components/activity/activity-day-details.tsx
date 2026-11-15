import { ArrowUpRight, CalendarDays, GitCommitHorizontal, Lock } from "lucide-react";
import { cn } from "@/lib/ui/format";

type ActivityDayProject = {
  slug: string;
  displayTitle: string;
  commitCount: number;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
};

type ActivityDayCommit = {
  sha: string;
  message: string;
  htmlUrl: string;
  authorDate: string;
  authorName: string;
  projectSlug: string;
  projectTitle: string;
};

type ActivityDayDetailsProps = {
  date: string;
  totalCommits: number;
  projects: ActivityDayProject[];
  commits: ActivityDayCommit[];
  timezone: string;
};

function formatDateKey(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatChangeSummary(project: ActivityDayProject): string | null {
  if (project.additions === null && project.deletions === null && project.changedFiles === null) {
    return null;
  }

  const parts: string[] = [];

  if (project.additions !== null || project.deletions !== null) {
    parts.push(`+${project.additions ?? 0} / -${project.deletions ?? 0}`);
  }

  if (project.changedFiles !== null) {
    parts.push(`${project.changedFiles} file${project.changedFiles === 1 ? "" : "s"}`);
  }

  return parts.join(" · ");
}

function firstLine(message: string): string {
  return message.split("\n")[0]?.trim() || message;
}

export function ActivityDayDetails({
  date,
  totalCommits,
  projects,
  commits,
  timezone,
}: ActivityDayDetailsProps) {
  return (
    <section className="rounded-lg border border-line bg-canvas">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="text-sm font-semibold text-primary">{formatDateKey(date)}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-secondary">
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
            <span className="tabular">{date}</span>
            <span className="text-muted">·</span>
            <GitCommitHorizontal aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
            {totalCommits} qualifying commit{totalCommits === 1 ? "" : "s"}
          </p>
        </div>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">
          {timezone}
        </span>
      </div>

      <div className="space-y-6 p-5">
        {projects.length > 0 ? (
          <div>
            <h3 className="mb-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
              Projects touched
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {projects.map((project) => {
                const changeSummary = formatChangeSummary(project);

                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-hover/60"
                    key={project.slug}
                  >
                    <span className="font-medium text-primary">{project.displayTitle}</span>
                    <span className="tabular text-xs text-secondary">
                      {project.commitCount} commit{project.commitCount === 1 ? "" : "s"}
                      {changeSummary ? (
                        <span className="ml-2 font-mono text-[11px] text-muted">{changeSummary}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {commits.length > 0 ? (
          <div>
            <h3 className="mb-3 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
              Commit ledger
            </h3>
            <ol className="relative space-y-4 border-l border-line pl-4">
              {commits.map((commit) => (
                <li className="relative" key={commit.sha}>
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[1.21rem] h-2 w-2 rounded-full border border-line bg-canvas"
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
                    <span className="rounded border border-line bg-surface px-1 py-0.5 text-secondary">
                      {commit.sha.slice(0, 7)}
                    </span>
                    <span className="text-secondary">
                      {commit.projectTitle || commit.projectSlug}
                    </span>
                    <span>·</span>
                    <span>{commit.authorName}</span>
                    <span>·</span>
                    <time className="tabular" dateTime={commit.authorDate}>
                      {formatTime(commit.authorDate, timezone)}
                    </time>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
                    <p className="max-w-xl text-sm leading-6 whitespace-pre-line text-primary">
                      {firstLine(commit.message)}
                    </p>
                    {commit.htmlUrl ? (
                      <a
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-secondary transition-colors hover:text-primary",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        )}
                        href={commit.htmlUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View
                        <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : totalCommits > 0 ? (
          <div className="flex items-start gap-3 rounded-md border border-line bg-surface p-4">
            <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <p className="text-sm leading-6 text-secondary">
              Commit details are hidden for this activity. Aggregate counts remain visible and
              private repository history is never exposed.
            </p>
          </div>
        ) : (
          <p className="text-sm leading-6 text-secondary">
            No qualifying activity was recorded for this day. If history is still backfilling, this
            may be incomplete.
          </p>
        )}
      </div>
    </section>
  );
}