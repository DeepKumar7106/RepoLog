"use client";

import { ArrowUpRight, CalendarDays, GitCommitHorizontal, FolderGit2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { inputClass, selectClass } from "@/components/ui/form-controls";
import { cn, formatNumber } from "@/lib/ui/format";
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
  title?: string;
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

const levelClasses = [
  "bg-hover",
  "bg-emerald-200 dark:bg-emerald-950",
  "bg-emerald-300 dark:bg-emerald-800",
  "bg-emerald-500 dark:bg-emerald-600",
  "bg-emerald-700 dark:bg-emerald-400",
];

function activityLevel(commitCount: number, max: number): number {
  if (commitCount <= 0) {
    return 0;
  }

  const ratio = commitCount / max;

  if (ratio > 0.75) {
    return 4;
  }

  if (ratio > 0.5) {
    return 3;
  }

  if (ratio > 0.25) {
    return 2;
  }

  return 1;
}

function weekdayOffset(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
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
  title = "Development activity",
}: ActivityTimelineProps) {
  const [view, setView] = useState<"chart" | "list">("chart");
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const rangeDates = dateRangeKeys(from, to);
  const maxCommitCount = Math.max(1, ...days.map((day) => day.commitCount));
  const activeDays = [...days].sort((left, right) => right.date.localeCompare(left.date));
  const totalCommits = days.reduce((sum, day) => sum + day.commitCount, 0);
  const leadingBlanks = rangeDates.length > 0 ? weekdayOffset(rangeDates[0]) : 0;
  const heatmapCells: Array<string | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...rangeDates,
  ];

  return (
    <section className="rounded-lg border border-line bg-canvas">
      <div className="flex flex-col gap-4 border-b border-line p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary">{title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-secondary">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="tabular">
                {from} to {to}
              </span>
              <span className="text-muted">· {timezone}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-secondary">
            <div
              aria-label="Activity view"
              className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
              role="group"
            >
              {(["chart", "list"] as const).map((option) => (
                <button
                  aria-pressed={view === option}
                  className={cn(
                    "h-6 rounded px-2 text-[11px] font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                    view === option ? "bg-canvas text-primary" : "text-muted hover:text-primary",
                  )}
                  key={option}
                  onClick={() => setView(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <span className="tabular flex items-center gap-1.5">
              <GitCommitHorizontal aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
              {formatNumber(totalCommits)} commits
            </span>
            <span className="tabular flex items-center gap-1.5">
              <FolderGit2 aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
              {formatNumber(activeDays.length)} active days
            </span>
          </div>
        </div>

        <form
          action={basePath}
          className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
          method="get"
        >
          {showProjectFilter ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="project">
                Project
              </label>
              <select
                className={cn(selectClass, "h-8 text-xs")}
                defaultValue={projectSlug ?? ""}
                id="project"
                name="project"
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.slug} value={project.slug}>
                    {project.displayTitle}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="from">
              From
            </label>
            <input
              className={cn(inputClass, "h-8 w-full text-xs")}
              defaultValue={from}
              id="from"
              name="from"
              type="date"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor="to">
              To
            </label>
            <input
              className={cn(inputClass, "h-8 w-full text-xs")}
              defaultValue={to}
              id="to"
              name="to"
              type="date"
            />
          </div>
          <button
            className="h-8 rounded-md border border-line bg-surface px-3 text-xs font-medium text-primary transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            type="submit"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="p-5">
        {view === "chart" ? (
          <>
            {rangeDates.length === 0 ? (
              <p className="text-sm text-secondary">No activity range available.</p>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="scrollbar-thin overflow-x-auto pb-1">
                    <div className="grid auto-cols-[0.875rem] grid-flow-col grid-rows-[repeat(7,0.875rem)] gap-1">
                      {heatmapCells.map((date, index) => {
                        if (!date) {
                          return (
                            <span
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                              key={`blank-${index}`}
                            />
                          );
                        }

                        const day = dayByDate.get(date);
                        const commitCount = day?.commitCount ?? 0;
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
                            className={cn(
                              "h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas focus-visible:outline-none",
                              levelClasses[activityLevel(commitCount, maxCommitCount)],
                              isSelected
                                ? "ring-2 ring-accent ring-offset-1 ring-offset-canvas"
                                : "",
                            )}
                            href={href}
                            key={date}
                            title={`${date}: ${commitCount} commit${commitCount === 1 ? "" : "s"}${
                              day
                                ? ` across ${day.projectCount} project${day.projectCount === 1 ? "" : "s"}`
                                : ""
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="hidden shrink-0 flex-col items-end gap-1.5 text-[11px] text-muted sm:flex">
                    <span>Less</span>
                    <div className="flex gap-1">
                      {levelClasses.map((tone, index) => (
                        <span className={cn("h-3 w-3 rounded-[3px]", tone)} key={index} />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span className="tabular">{rangeDates.length} day range</span>
                  <span className="tabular">Timezone {timezone}</span>
                </div>
              </div>
            )}

            {activeDays.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-line bg-surface/60 px-4 py-3 text-sm text-secondary">
                No qualifying activity was recorded in this range. If history is still backfilling,
                this may be incomplete.
              </p>
            ) : (
              <details className="group mt-5 rounded-md border border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-secondary [&::-webkit-details-marker]:hidden">
                  <span>Active days ({activeDays.length})</span>
                  <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <ul className="max-h-64 divide-y divide-line overflow-y-auto border-t border-line">
                  {activeDays.map((day) => (
                    <li key={day.date}>
                      <Link
                        className={cn(
                          "flex items-center justify-between gap-4 px-4 py-2 text-xs transition-colors hover:bg-hover",
                          selectedDate === day.date ? "bg-hover" : "",
                        )}
                        href={buildHref(basePath, { from, to, projectSlug, date: day.date })}
                      >
                        <span className="tabular font-medium text-primary">{day.date}</span>
                        <span className="tabular flex items-center gap-3 text-secondary">
                          <span>
                            {day.commitCount} commit{day.commitCount === 1 ? "" : "s"}
                          </span>
                          <span className="text-muted">
                            {day.projectCount} project{day.projectCount === 1 ? "" : "s"}
                          </span>
                          <ArrowUpRight aria-hidden="true" className="h-3 w-3 text-muted" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : activeDays.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-surface/60 px-4 py-3 text-sm text-secondary">
            No qualifying activity was recorded in this range. If history is still backfilling, this
            may be incomplete.
          </p>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                Active days from {from} to {to}
              </caption>
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="pb-2 font-medium" scope="col">
                    Date
                  </th>
                  <th className="pb-2 font-medium" scope="col">
                    Commits
                  </th>
                  <th className="pb-2 font-medium" scope="col">
                    Projects
                  </th>
                  <th className="pb-2 text-right font-medium" scope="col">
                    Inspect
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activeDays.map((day) => (
                  <tr
                    className={cn(
                      "transition-colors hover:bg-hover",
                      selectedDate === day.date ? "bg-hover" : "",
                    )}
                    key={day.date}
                  >
                    <th className="py-2 pr-4 text-left font-medium text-primary" scope="row">
                      <Link
                        className="rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        href={buildHref(basePath, { from, to, projectSlug, date: day.date })}
                      >
                        {day.date}
                      </Link>
                    </th>
                    <td className="tabular py-2 pr-4 text-secondary">
                      {formatNumber(day.commitCount)}
                    </td>
                    <td className="tabular py-2 pr-4 text-secondary">
                      {formatNumber(day.projectCount)}
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        aria-label={`Inspect ${day.date}`}
                        className="inline-flex items-center gap-1 rounded font-medium text-secondary hover:text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        href={buildHref(basePath, { from, to, projectSlug, date: day.date })}
                      >
                        View
                        <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
