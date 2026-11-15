"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Globe2,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MarkdownContent } from "@/components/public/markdown-content";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
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
    description: "Allow public commit messages for public repositories only.",
  },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

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
  const previewReadme = publicReadmeMarkdown.trim();

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <form className="space-y-4" id="project-form" onSubmit={handleSubmit}>
        <section className="rounded-lg border border-line bg-canvas">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-primary">Project details</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              The story visitors see on your public project page.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Field htmlFor="displayTitle" label="Display title">
                <Input
                  id="displayTitle"
                  maxLength={120}
                  onChange={(event) => setDisplayTitle(event.target.value)}
                  required
                  value={displayTitle}
                />
              </Field>
              <Field
                hint="Lowercase letters, numbers and single hyphens."
                htmlFor="slug"
                label="Project slug"
              >
                <Input
                  className="font-mono text-xs"
                  id="slug"
                  maxLength={39}
                  onChange={(event) => setSlug(event.target.value)}
                  required
                  value={slug}
                />
              </Field>
            </div>

            <Field
              hint={`${shortDescription.length}/280 characters`}
              htmlFor="shortDescription"
              label="Short description"
            >
              <Textarea
                id="shortDescription"
                maxLength={280}
                onChange={(event) => setShortDescription(event.target.value)}
                placeholder="One or two sentences about what this project is and why it matters."
                rows={3}
                value={shortDescription}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="status" label="Status">
                <Select
                  id="status"
                  onChange={(event) => setStatus(event.target.value as ProjectDto["status"])}
                  value={status}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="visibility" label="Project visibility">
                <Select
                  id="visibility"
                  onChange={(event) =>
                    setVisibility(event.target.value as ProjectDto["visibility"])
                  }
                  value={visibility}
                >
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                </Select>
              </Field>
            </div>

            <Field
              hint="Optional. Must be an http or https URL."
              htmlFor="demoUrl"
              label="Live demo URL"
            >
              <Input
                id="demoUrl"
                onChange={(event) => setDemoUrl(event.target.value)}
                placeholder="https://example.com"
                type="url"
                value={demoUrl}
              />
            </Field>

            {visibility === "PUBLIC" && profileVisibility === "PRIVATE" ? (
              <Alert tone="warning">
                This project is public, but your profile is private. Publish your profile in
                Settings before sharing the public URL.
              </Alert>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-primary">Public display</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Applies when both this project and your profile are public.
              </p>
            </div>
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-muted" />
          </div>
          <div className="space-y-5 p-5">
            <Switch
              checked={publicDisplayEnabled}
              description="Disable to keep all repository activity private even if the project is public."
              id="publicDisplayEnabled"
              label="Include this repository"
              onCheckedChange={setPublicDisplayEnabled}
            />

            <fieldset className="border-t border-line pt-4">
              <legend className="mb-2 text-xs font-medium text-primary">
                Public commit activity
              </legend>
              <div className="space-y-2">
                {activityOptions.map((option) => {
                  const active = publicActivityDetail === option.value;

                  return (
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                        active ? "border-accent bg-hover" : "border-line hover:bg-surface"
                      }`}
                      key={option.value}
                    >
                      <input
                        checked={active}
                        className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                        name="publicActivity"
                        onChange={() => setPublicActivityDetail(option.value)}
                        type="radio"
                      />
                      <span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          {option.label}
                          {option.value === "HIDDEN" ? (
                            <Badge tone="neutral" className="text-[9px]">
                              Safest
                            </Badge>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-secondary">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-canvas">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-primary">Public overview</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Required for private repositories. Stored by RepoLog, safe to show without exposing
              private repository content.
            </p>
          </div>
          <div className="p-5">
            <Textarea
              className="font-mono text-xs leading-5"
              id="publicReadmeMarkdown"
              maxLength={100_000}
              onChange={(event) => setPublicReadmeMarkdown(event.target.value)}
              placeholder="## Overview&#10;&#10;Explain the problem, your approach and the outcome."
              rows={14}
              value={publicReadmeMarkdown}
            />
            <p className="mt-1.5 text-[11px] text-muted">
              {publicReadmeMarkdown.length}/100000 characters
              {project.publicReadmeUpdatedAt
                ? ` · Last saved ${formatDate(project.publicReadmeUpdatedAt)}`
                : ""}
            </p>
          </div>
        </section>

        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : null}

        {notice ? (
          <Alert tone="success">{notice}</Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button loading={isSaving} type="submit">
            {isSaving ? null : <Save aria-hidden="true" className="h-4 w-4" />}
            {isSaving ? "Saving…" : "Save project"}
          </Button>
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            href="/admin/projects"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to projects
          </Link>
          {isSaving ? (
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
              Saving changes
            </span>
          ) : null}
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold text-primary">Public preview</h2>
            <VisibilityBadge visibility={visibility} />
          </div>
          <div className="p-4">
            <div className="rounded-md border border-line p-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill status={status} />
                {publicDisplayEnabled ? (
                  <Badge tone="neutral">Activity included</Badge>
                ) : (
                  <Badge tone="neutral">Activity hidden</Badge>
                )}
              </div>
              <h3 className="mt-2 text-sm font-semibold text-primary">
                {displayTitle || "Untitled project"}
              </h3>
              <p className="mt-0.5 font-mono text-[10px] text-muted">
                {project.repository.fullName}
              </p>
              {shortDescription ? (
                <p className="mt-2 text-xs leading-5 text-secondary">{shortDescription}</p>
              ) : (
                <p className="mt-2 text-xs text-muted">No short description yet.</p>
              )}
              {demoUrl ? (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary underline underline-offset-4"
                  href={demoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open demo
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </a>
              ) : null}
              {previewReadme ? (
                <div className="scrollbar-thin mt-3 max-h-48 overflow-y-auto border-t border-line pt-3">
                  <MarkdownContent markdown={previewReadme} />
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
              Shareable URL
            </p>
            <p className="mt-1 rounded border border-line bg-surface p-2 font-mono text-[10px] break-all text-secondary">
              {publicUrl}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CopyButton label="Copy URL" size="xs" url={publicUrl} />
              <a
                className="inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-secondary hover:bg-hover hover:text-primary"
                href={publicUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open preview
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </a>
            </div>

            {profileVisibility === "PRIVATE" ? (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700 dark:text-amber-400">
                <Globe2 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                Your profile is private, so this URL is not publicly reachable yet.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-xs font-semibold text-primary">Repository</h2>
          <dl className="mt-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Visibility</dt>
              <dd className="text-secondary">{project.repository.visibility}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Default branch</dt>
              <dd className="font-mono text-secondary">{project.repository.defaultBranch}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Latest commit</dt>
              <dd className="text-right text-secondary">
                {project.latestCommitAt ? formatDate(project.latestCommitAt) : "—"}
              </dd>
            </div>
          </dl>
          <a
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-primary"
            href={project.repository.htmlUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open on GitHub
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
          </a>
        </section>
      </aside>
    </div>
  );
}