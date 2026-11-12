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

function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
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

export function ActivityDayDetails({
  date,
  totalCommits,
  projects,
  commits,
  timezone,
}: ActivityDayDetailsProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{formatDateKey(date)}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {totalCommits} qualifying commit{totalCommits === 1 ? "" : "s"}
        </p>
      </div>

      {projects.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
          <ul className="mt-2 space-y-2">
            {projects.map((project) => {
              const changeSummary = formatChangeSummary(project);

              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  key={project.slug}
                >
                  <span className="font-medium text-slate-900">{project.displayTitle}</span>
                  <span className="text-slate-500">
                    {project.commitCount} commit{project.commitCount === 1 ? "" : "s"}
                    {changeSummary ? ` · ${changeSummary}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {commits.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Commits</h3>
          <ol className="mt-2 space-y-3">
            {commits.map((commit) => (
              <li className="rounded-xl border border-slate-200 p-3" key={commit.sha}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                  <span>{commit.projectTitle || commit.projectSlug}</span>
                  <span>{commit.authorName}</span>
                  <time dateTime={commit.authorDate}>
                    {formatDateTime(commit.authorDate, timezone)}
                  </time>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line text-slate-900">{commit.message}</p>
                {commit.htmlUrl ? (
                  <a
                    className="mt-2 inline-block text-xs font-semibold text-slate-700 underline"
                    href={commit.htmlUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View on GitHub
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : totalCommits > 0 ? (
        <p className="text-sm text-slate-500">
          Commit details are hidden for this activity. Aggregate counts remain visible.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          No qualifying activity was recorded for this day. If history is still backfilling, this
          may be incomplete.
        </p>
      )}
    </section>
  );
}
