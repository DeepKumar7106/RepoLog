import Link from "next/link";
import { dateRangeKeys } from "@/lib/time/dates";

type ActivityProjectOption = {
  slug: string;
  displayTitle: string;
};

type ActivityDay = {
  date: string;
  commitCount: number;
  projectCount: number;
};

type ActivityTimelineProps = {
  basePath: string;
  from: string;
  to: string;
  days: ActivityDay[];
  projects: ActivityProjectOption[];
  projectSlug?: string;
  selectedDate?: string | null;
  showProjectFilter?: boolean;
  timezone: string;
};

function buildHref(
  basePath: string,
  values: { from: string; to: string; projectSlug?: string; date?: string | null },
) {
  const searchParams = new URLSearchParams();

  if (values.projectSlug) {
    searchParams.set("project", values.projectSlug);
  }

  searchParams.set("from", values.from);
  searchParams.set("to", values.to);

  if (values.date) {
    searchParams.set("date", values.date);
  }

  return `${basePath}?${searchParams.toString()}`;
}

export function ActivityTimeline({
  basePath,
  from,
  to,
  days,
  projects,
  projectSlug,
  selectedDate,
  showProjectFilter = true,
  timezone,
}: ActivityTimelineProps) {
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const rangeDates = dateRangeKeys(from, to);
  const maxCommitCount = Math.max(1, ...days.map((day) => day.commitCount));
  const activeDays = [...days].sort((left, right) => right.date.localeCompare(left.date));

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            {from} to {to} in {timezone}
          </p>
        </div>
        <form action={basePath} className="flex flex-wrap items-end gap-3" method="get">
          {showProjectFilter ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Project
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                defaultValue={projectSlug ?? ""}
                name="project"
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.slug} value={project.slug}>
                    {project.displayTitle}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            From
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              defaultValue={from}
              name="from"
              type="date"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            To
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              defaultValue={to}
              name="to"
              type="date"
            />
          </label>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Apply
          </button>
        </form>
      </div>

      {rangeDates.length === 0 ? (
        <p className="text-sm text-slate-500">No activity range available.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex h-36 items-end gap-[2px] overflow-x-auto border-b border-slate-200 pb-1">
            {rangeDates.map((date) => {
              const day = dayByDate.get(date);
              const commitCount = day?.commitCount ?? 0;
              const height =
                commitCount === 0
                  ? 2
                  : Math.max(4, Math.round((commitCount / maxCommitCount) * 100));
              const isSelected = selectedDate === date;
              const href = buildHref(basePath, {
                from,
                to,
                projectSlug,
                date: isSelected ? null : date,
              });

              return (
                <Link
                  aria-label={`${date}: ${commitCount} commit${commitCount === 1 ? "" : "s"}`}
                  className={`min-w-[2px] flex-1 rounded-t-sm ${
                    commitCount === 0 ? "bg-slate-200" : "bg-slate-900"
                  } ${isSelected ? "ring-2 ring-slate-500 ring-offset-1" : ""}`}
                  href={href}
                  key={date}
                  style={{ height: `${height}%` }}
                  title={`${date}: ${commitCount} commit${commitCount === 1 ? "" : "s"}${
                    day
                      ? ` across ${day.projectCount} project${day.projectCount === 1 ? "" : "s"}`
                      : ""
                  }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{from}</span>
            <span>{to}</span>
          </div>
        </div>
      )}

      {activeDays.length === 0 ? (
        <p className="text-sm text-slate-500">
          No qualifying activity was recorded in this range. If history is still backfilling, this
          may be incomplete.
        </p>
      ) : (
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
            Active days ({activeDays.length})
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {activeDays.map((day) => (
              <li key={day.date}>
                <Link
                  className="flex items-center justify-between gap-4 px-4 py-2 text-sm hover:bg-slate-50"
                  href={buildHref(basePath, { from, to, projectSlug, date: day.date })}
                >
                  <span className="font-medium text-slate-900">{day.date}</span>
                  <span className="text-slate-500">
                    {day.commitCount} commit{day.commitCount === 1 ? "" : "s"} · {day.projectCount}{" "}
                    project{day.projectCount === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
