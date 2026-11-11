"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { absolutePublicUrl, publicProjectPath } from "@/lib/urls/public-urls";
import type { ProjectDto } from "@/server/dto/project-dto";

type ProjectEditorProps = Readonly<{
  appBaseUrl: string;
  profileSlug: string;
  profileVisibility: "PUBLIC" | "PRIVATE";
  project: ProjectDto;
}>;

type ErrorPayload = {
  error?: {
    message?: string;
  };
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

const statusOptions: Array<{ label: string; value: ProjectDto["status"] }> = [
  { label: "Ongoing", value: "ONGOING" },
  { label: "Complete", value: "COMPLETE" },
  { label: "On break", value: "ON_BREAK" },
];

const activityOptions: Array<{
  description: string;
  label: string;
  value: ProjectDto["userRepository"]["publicActivityDetail"];
}> = [
  { label: "Hidden", value: "HIDDEN", description: "Do not show commit activity publicly." },
  {
    label: "Aggregated",
    value: "AGGREGATED",
    description: "Show counts and dates without commit messages.",
  },
  {
    label: "Commit details",
    value: "COMMIT_DETAILS",
    description: "Allow public commit messages for this repository.",
  },
];

export function ProjectEditor({
  appBaseUrl,
  profileSlug,
  profileVisibility,
  project,
}: ProjectEditorProps) {
  const router = useRouter();
  const [displayTitle, setDisplayTitle] = useState(project.displayTitle);
  const [shortDescription, setShortDescription] = useState(project.shortDescription ?? "");
  const [status, setStatus] = useState<ProjectDto["status"]>(project.status);
  const [visibility, setVisibility] = useState<ProjectDto["visibility"]>(project.visibility);
  const [demoUrl, setDemoUrl] = useState(project.demoUrl ?? "");
  const [slug, setSlug] = useState(project.slug);
  const [publicReadmeMarkdown, setPublicReadmeMarkdown] = useState(
    project.publicReadmeMarkdown ?? "",
  );
  const [publicActivityDetail, setPublicActivityDetail] = useState<
    ProjectDto["userRepository"]["publicActivityDetail"]
  >(project.userRepository.publicActivityDetail);
  const [publicDisplayEnabled, setPublicDisplayEnabled] = useState(
    project.userRepository.publicDisplayEnabled,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const publicUrl = absolutePublicUrl(
    publicProjectPath(profileSlug, slug.trim() || project.slug),
    appBaseUrl,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const projectResponse = await fetch(`/api/user/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayTitle: displayTitle.trim(),
          shortDescription: shortDescription.trim() || null,
          status,
          visibility,
          demoUrl: demoUrl.trim() || null,
          slug: slug.trim(),
          publicReadmeMarkdown: publicReadmeMarkdown.trim() ? publicReadmeMarkdown : null,
        }),
      });

      if (!projectResponse.ok) {
        const payload = (await projectResponse.json().catch(() => null)) as ErrorPayload | null;
        setError(payload?.error?.message ?? "Could not save the project.");
        return;
      }

      const repositoryChanged =
        publicDisplayEnabled !== project.userRepository.publicDisplayEnabled ||
        publicActivityDetail !== project.userRepository.publicActivityDetail;

      if (repositoryChanged) {
        const repositoryResponse = await fetch(
          `/api/user/repositories/${project.userRepository.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicDisplayEnabled, publicActivityDetail }),
          },
        );

        if (!repositoryResponse.ok) {
          const payload = (await repositoryResponse
            .json()
            .catch(() => null)) as ErrorPayload | null;
          setError(
            payload?.error?.message ??
              "Project saved, but the repository public display settings could not be saved.",
          );
          router.refresh();
          return;
        }
      }

      setNotice("Project saved.");
      router.refresh();
    } catch {
      setError("Could not save the project. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyPublicUrl() {
    setError(null);
    setNotice(null);

    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice("Public URL copied.");
    } catch {
      setError("Could not copy the URL. Copy it from the preview panel instead.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Project details</h2>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="displayTitle">
                Display title
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="displayTitle"
                maxLength={120}
                onChange={(event) => setDisplayTitle(event.target.value)}
                required
                value={displayTitle}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-900"
                htmlFor="shortDescription"
              >
                Short description
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="shortDescription"
                maxLength={280}
                onChange={(event) => setShortDescription(event.target.value)}
                rows={3}
                value={shortDescription}
              />
              <p className="mt-1 text-xs text-slate-500">{shortDescription.length}/280</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-900" htmlFor="status">
                  Status
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  id="status"
                  onChange={(event) => setStatus(event.target.value as ProjectDto["status"])}
                  value={status}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900" htmlFor="visibility">
                  Project visibility
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  id="visibility"
                  onChange={(event) =>
                    setVisibility(event.target.value as ProjectDto["visibility"])
                  }
                  value={visibility}
                >
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
            </div>

            {visibility === "PUBLIC" && profileVisibility === "PRIVATE" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This project is public, but your profile is private. Publish your profile in
                Settings before sharing the public URL.
              </p>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="slug">
                Project slug
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="slug"
                maxLength={39}
                onChange={(event) => setSlug(event.target.value)}
                required
                value={slug}
              />
              <p className="mt-1 text-xs text-slate-500">
                Used in the public URL. Lowercase letters, numbers and single hyphens only.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="demoUrl">
                Demo URL
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="demoUrl"
                onChange={(event) => setDemoUrl(event.target.value)}
                placeholder="https://example.com"
                type="url"
                value={demoUrl}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Public display</h2>
          <p className="mt-1 text-sm text-slate-600">
            Controls what visitors can see for this repository when both the project and your
            profile are public.
          </p>

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              checked={publicDisplayEnabled}
              className="mt-0.5"
              onChange={(event) => setPublicDisplayEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block font-medium text-slate-900">Include this repository</span>
              <span className="block text-slate-600">
                Disable to keep all repository activity private even if the project is public.
              </span>
            </span>
          </label>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-900" htmlFor="publicActivity">
              Public commit activity
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              id="publicActivity"
              onChange={(event) =>
                setPublicActivityDetail(
                  event.target.value as ProjectDto["userRepository"]["publicActivityDetail"],
                )
              }
              value={publicActivityDetail}
            >
              {activityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {activityOptions.find((option) => option.value === publicActivityDetail)?.description}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Public overview</h2>
          <p className="mt-1 text-sm text-slate-600">
            Required for private repositories. This Markdown is stored by RepoLog and is safe to
            show without exposing private repository content.
          </p>
          <textarea
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            id="publicReadmeMarkdown"
            maxLength={100_000}
            onChange={(event) => setPublicReadmeMarkdown(event.target.value)}
            rows={12}
            value={publicReadmeMarkdown}
          />
          <p className="mt-1 text-xs text-slate-500">
            {publicReadmeMarkdown.length}/100000 characters
            {project.publicReadmeUpdatedAt
              ? ` \u00b7 Last saved ${formatDate(project.publicReadmeUpdatedAt)}`
              : ""}
          </p>
        </div>

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving\u2026" : "Save project"}
          </button>
          <Link className="text-sm font-medium text-slate-600 underline" href="/admin/projects">
            Back to projects
          </Link>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Public preview</h2>
          <p className="mt-1 text-sm text-slate-600">
            {visibility === "PUBLIC"
              ? "This is how the project appears to visitors."
              : "This project is private. The preview is only visible to you."}
          </p>

          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {project.repository.fullName}
            </p>
            <h3 className="mt-1 font-semibold text-slate-900">{displayTitle || "Untitled"}</h3>
            {shortDescription ? (
              <p className="mt-2 text-sm text-slate-600">{shortDescription}</p>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              {statusOptions.find((option) => option.value === status)?.label}
            </p>
            {demoUrl ? (
              <a
                className="mt-3 inline-block text-sm font-medium text-slate-900 underline"
                href={demoUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open demo
              </a>
            ) : null}
            {publicReadmeMarkdown ? (
              <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-700">
                {publicReadmeMarkdown}
              </pre>
            ) : null}
          </div>

          <p className="mt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Shareable URL
          </p>
          <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs break-all text-slate-700">
            {publicUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <button
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              onClick={copyPublicUrl}
              type="button"
            >
              Copy URL
            </button>
            <Link
              className="font-medium text-slate-600 underline"
              href={publicUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open preview
            </Link>
          </div>
          {profileVisibility === "PRIVATE" ? (
            <p className="mt-3 text-xs text-amber-800">
              Your profile is private, so this URL is not publicly reachable yet.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
