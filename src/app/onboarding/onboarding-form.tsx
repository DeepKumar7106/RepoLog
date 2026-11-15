"use client";

import { ArrowLeft, ArrowRight, Check, Lock, RefreshCw, Search, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { GithubIcon } from "@/components/ui/github-icon";
import { Switch } from "@/components/ui/switch";
import { cn, formatNumber } from "@/lib/ui/format";
import type { UserRepositoryDto } from "@/server/dto/user-repository-dto";

type OnboardingFormProps = Readonly<{
  defaultBio: string;
  defaultDisplayName: string;
  defaultSearchIndexing: boolean;
  defaultTimezone: string;
  defaultVisibility: "PUBLIC" | "PRIVATE";
  profileSlug: string;
  githubLogin: string;
  connected: boolean;
  scope: string | null;
  initialRepositories: UserRepositoryDto[];
}>;

type ErrorPayload = {
  error?: {
    message?: string;
  };
};

const steps = [
  { id: 1, label: "Repositories", hint: "Discovery" },
  { id: 2, label: "Privacy", hint: "Profile setup" },
  { id: 3, label: "Confirm", hint: "Start backfill" },
];

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null;

  return payload?.error?.message ?? fallback;
}

export function OnboardingForm({
  defaultBio,
  defaultDisplayName,
  defaultSearchIndexing,
  defaultTimezone,
  defaultVisibility,
  profileSlug,
  githubLogin,
  connected,
  scope,
  initialRepositories,
}: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [slug, setSlug] = useState(profileSlug);
  const [bio, setBio] = useState(defaultBio);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(defaultVisibility);
  const [searchIndexing, setSearchIndexing] = useState(defaultSearchIndexing);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [repositories, setRepositories] = useState(initialRepositories);
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(initialRepositories.filter((repo) => repo.trackingEnabled).map((repo) => repo.id)),
  );
  const [baselineTracked, setBaselineTracked] = useState<Set<string>>(
    () =>
      new Set(initialRepositories.filter((repo) => repo.trackingEnabled).map((repo) => repo.id)),
  );
  const [repoQuery, setRepoQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoDiscovered = useRef(false);

  const filteredRepositories = useMemo(() => {
    const query = repoQuery.trim().toLowerCase();

    if (!query) {
      return repositories;
    }

    return repositories.filter(
      (repo) =>
        repo.repository.fullName.toLowerCase().includes(query) ||
        (repo.repository.description ?? "").toLowerCase().includes(query),
    );
  }, [repoQuery, repositories]);

  const allFilteredSelected =
    filteredRepositories.length > 0 && filteredRepositories.every((repo) => selected.has(repo.id));
  const selectedRepositories = useMemo(
    () => repositories.filter((repo) => selected.has(repo.id)),
    [repositories, selected],
  );

  function validateProfile(): string | null {
    if (!displayName.trim()) {
      return "Add a display name so people know whose profile this is.";
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      return "Use lowercase letters, numbers and single hyphens for your profile slug.";
    }

    return null;
  }

  function next() {
    setError(null);

    if (step === 2) {
      const validationError = validateProfile();

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (step === 3) {
      void finish();
      return;
    }

    setStep((current) => Math.min(3, current + 1));
  }

  const discover = useCallback(async () => {
    setDiscovering(true);
    setError(null);

    try {
      const discoveryResponse = await fetch("/api/user/repositories/discover", { method: "POST" });

      if (!discoveryResponse.ok) {
        setError(await readError(discoveryResponse, "Repository discovery failed."));
        return;
      }

      const listResponse = await fetch("/api/user/repositories?perPage=100");

      if (!listResponse.ok) {
        setError("Repositories were discovered, but the list could not be loaded.");
        return;
      }

      const payload = (await listResponse.json()) as { data: UserRepositoryDto[] };
      const trackedIds = new Set(
        payload.data.filter((repo) => repo.trackingEnabled).map((repo) => repo.id),
      );
      setRepositories(payload.data);
      setSelected(trackedIds);
      setBaselineTracked(trackedIds);
    } catch {
      setError("Repository discovery failed. Please try again.");
    } finally {
      setDiscovering(false);
    }
  }, []);

  useEffect(() => {
    if (autoDiscovered.current || !connected || initialRepositories.length > 0) {
      return;
    }

    autoDiscovered.current = true;
    void discover();
  }, [connected, discover, initialRepositories.length]);

  function toggleRepository(id: string) {
    setSelected((current) => {
      const nextSelection = new Set(current);

      if (nextSelection.has(id)) {
        nextSelection.delete(id);
      } else {
        nextSelection.add(id);
      }

      return nextSelection;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const nextSelection = new Set(current);

      for (const repo of filteredRepositories) {
        if (allFilteredSelected) {
          nextSelection.delete(repo.id);
        } else {
          nextSelection.add(repo.id);
        }
      }

      return nextSelection;
    });
  }

  async function finish() {
    const validationError = validateProfile();

    if (validationError) {
      setStep(2);
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const profileResponse = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          profileBio: bio.trim() || null,
          profileSlug: slug.trim(),
          profileVisibility: visibility,
          searchIndexingEnabled: searchIndexing,
          timezone: timezone.trim() || undefined,
        }),
      });

      if (!profileResponse.ok) {
        setError(await readError(profileResponse, "Could not save your profile."));
        return;
      }

      const onboardingResponse = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          profileBio: bio.trim() || null,
          profileVisibility: visibility,
          searchIndexingEnabled: searchIndexing,
          timezone: timezone.trim() || undefined,
        }),
      });

      if (!onboardingResponse.ok) {
        setError(await readError(onboardingResponse, "Could not finish onboarding."));
        return;
      }

      const toTrack = [...selected].filter((id) => !baselineTracked.has(id));
      const toUntrack = [...baselineTracked].filter((id) => !selected.has(id));

      if (toTrack.length > 0) {
        const trackResponse = await fetch("/api/user/repositories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: toTrack, trackingEnabled: true }),
        });

        if (!trackResponse.ok) {
          setError(await readError(trackResponse, "Could not save repository selection."));
          return;
        }
      }

      if (toUntrack.length > 0) {
        const untrackResponse = await fetch("/api/user/repositories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: toUntrack, trackingEnabled: false }),
        });

        if (!untrackResponse.ok) {
          setError(await readError(untrackResponse, "Could not save repository selection."));
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not finish onboarding. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-2 sm:gap-4">
        {steps.map((item, index) => {
          const active = step === item.id;
          const complete = step > item.id;

          return (
            <div className="flex flex-1 items-center gap-2 sm:gap-3" key={item.id}>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    complete
                      ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950"
                      : active
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-line bg-surface text-muted",
                  )}
                >
                  {complete ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : item.id}
                </span>
                <div className="hidden sm:block">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      active || complete ? "text-primary" : "text-muted",
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="text-[11px] text-muted">{item.hint}</p>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-px flex-1", complete ? "bg-emerald-600/40" : "bg-line")}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-line bg-canvas">
        <div className="border-b border-line px-5 py-5 sm:px-6">
          {step === 1 ? (
            <div>
              <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                Step 1 of 3
              </p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-primary">
                Discover and select repositories
              </h2>
              <p className="mt-1 text-sm leading-6 text-secondary">
                Choose which repositories RepoLog should track. Organization repos may require org
                admin approval before they appear.
              </p>
            </div>
          ) : step === 2 ? (
            <div>
              <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                Step 2 of 3
              </p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-primary">
                Set up your public identity
              </h2>
              <p className="mt-1 text-sm leading-6 text-secondary">
                Your profile starts private. You can publish it later from settings.
              </p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                Step 3 of 3
              </p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-primary">
                Confirm and start historical backfill
              </h2>
              <p className="mt-1 text-sm leading-6 text-secondary">
                Review your selection. Setup starts an initial sync that walks each
                repository&apos;s commit history.
              </p>
            </div>
          )}
        </div>

        <div className="min-h-72 p-5 sm:p-6">
          {error ? (
            <Alert className="mb-5" tone="danger">
              {error}
            </Alert>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-line bg-surface p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-canvas">
                  <GithubIcon aria-hidden="true" className="h-4 w-4 text-secondary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-primary">@{githubLogin}</p>
                    <Badge tone={connected ? "success" : "warning"} dot>
                      {connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-secondary">
                    {connected
                      ? "OAuth credentials are stored server-side and encrypted at rest."
                      : "Reconnect GitHub to enable repository discovery and syncing."}
                  </p>
                  {connected && scope ? (
                    <p className="mt-2 font-mono text-[10px] break-words text-muted">
                      Scopes: {scope}
                    </p>
                  ) : null}
                </div>
              </div>

              {!connected ? (
                <Alert
                  tone="warning"
                  title="GitHub is disconnected"
                  action={
                    <a
                      className="inline-flex h-8 items-center rounded-md border border-line bg-canvas px-3 text-xs font-medium text-primary hover:bg-hover"
                      href="/api/auth/github/start?mode=reconnect"
                    >
                      Reconnect
                    </a>
                  }
                >
                  You can finish setup now and connect later, but repositories cannot be discovered
                  until GitHub is connected.
                </Alert>
              ) : (
                <ul className="space-y-2 text-xs text-secondary">
                  <li className="flex items-start gap-2">
                    <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                    Read repository metadata, default branches and authored commits.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                    Never write to your repositories or expose private commit details publicly.
                  </li>
                </ul>
              )}

              {connected ? (
                repositories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-surface/50 px-6 py-10 text-center">
                    <RefreshCw aria-hidden="true" className="h-5 w-5 text-muted" />
                    <p className="mt-3 text-sm font-medium text-primary">Find your repositories</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-secondary">
                      RepoLog will list repositories your GitHub connection can access. You choose
                      which ones to track now or later.
                    </p>
                    <Button
                      className="mt-4"
                      loading={discovering}
                      onClick={discover}
                      size="sm"
                      variant="secondary"
                    >
                      {discovering ? "Discovering…" : "Discover repositories"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative flex-1">
                        <Search
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                        />
                        <Input
                          className="h-8 pl-8 text-xs"
                          onChange={(event) => setRepoQuery(event.target.value)}
                          placeholder="Filter repositories"
                          value={repoQuery}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={toggleAll} size="sm" variant="ghost">
                          {allFilteredSelected ? "Clear all" : "Select all"}
                        </Button>
                        <Button
                          loading={discovering}
                          onClick={discover}
                          size="sm"
                          variant="secondary"
                        >
                          {discovering ? null : (
                            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          Refresh
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-secondary">
                      <span className="font-medium text-primary">
                        {formatNumber(selected.size)}
                      </span>{" "}
                      of {formatNumber(repositories.length)} repositories selected
                    </p>

                    <ul className="max-h-72 scrollbar-thin divide-y divide-line overflow-y-auto rounded-md border border-line">
                      {filteredRepositories.length === 0 ? (
                        <li className="px-3 py-6 text-center text-xs text-muted">
                          No repositories match “{repoQuery}”.
                        </li>
                      ) : (
                        filteredRepositories.map((repo) => {
                          const checked = selected.has(repo.id);

                          return (
                            <li key={repo.id}>
                              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-hover/60">
                                <input
                                  checked={checked}
                                  className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                                  onChange={() => toggleRepository(repo.id)}
                                  type="checkbox"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate text-xs font-medium text-primary">
                                      {repo.repository.fullName}
                                    </span>
                                    <span className="rounded border border-line px-1 font-mono text-[9px] text-muted uppercase">
                                      {repo.repository.visibility === "PUBLIC"
                                        ? "public"
                                        : "private"}
                                    </span>
                                    {repo.repository.isArchived ? (
                                      <span className="rounded border border-line px-1 text-[9px] text-muted">
                                        archived
                                      </span>
                                    ) : null}
                                  </span>
                                  {repo.repository.description ? (
                                    <span className="mt-0.5 block truncate text-[11px] text-secondary">
                                      {repo.repository.description}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </>
                )
              ) : null}
            </div>
          ) : step === 2 ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="displayName" label="Display name">
                  <Input
                    id="displayName"
                    maxLength={100}
                    onChange={(event) => setDisplayName(event.target.value)}
                    value={displayName}
                  />
                </Field>
                <Field
                  hint={`Your public URL: /u/${slug || "your-slug"}`}
                  htmlFor="profileSlug"
                  label="Profile slug"
                >
                  <div className="flex items-center">
                    <span className="flex h-9 items-center rounded-l-md border border-r-0 border-line bg-surface px-2.5 font-mono text-xs text-muted">
                      /u/
                    </span>
                    <Input
                      className="rounded-l-none font-mono text-xs"
                      id="profileSlug"
                      maxLength={39}
                      onChange={(event) => setSlug(event.target.value.toLowerCase())}
                      value={slug}
                    />
                  </div>
                </Field>
              </div>

              <Field htmlFor="profileBio" label="Short bio">
                <Textarea
                  id="profileBio"
                  maxLength={500}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="What do you build? What are you learning?"
                  rows={3}
                  value={bio}
                />
              </Field>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-primary">
                  Profile visibility
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      value: "PRIVATE" as const,
                      title: "Private",
                      body: "Only you can see your profile. Publish later.",
                      icon: Lock,
                    },
                    {
                      value: "PUBLIC" as const,
                      title: "Public",
                      body: `Visitors can open /u/${slug || "your-slug"}.`,
                      icon: Eye,
                    },
                  ].map((option) => {
                    const Icon = option.icon;
                    const active = visibility === option.value;

                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                          active
                            ? "border-accent bg-hover"
                            : "border-line bg-canvas hover:bg-surface",
                        )}
                        key={option.value}
                      >
                        <input
                          checked={active}
                          className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                          name="visibility"
                          onChange={() => setVisibility(option.value)}
                          type="radio"
                        />
                        <span>
                          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                            {option.title}
                            {option.value === "PRIVATE" ? (
                              <span className="text-[10px] font-normal text-muted">
                                recommended
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-5 text-secondary">
                            {option.body}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-4 rounded-md border border-line bg-surface p-4">
                <Switch
                  checked={searchIndexing}
                  description="Only applies when your profile is public. Off by default."
                  id="searchIndexing"
                  label="Allow search engine indexing"
                  onCheckedChange={setSearchIndexing}
                />
                <Field
                  className="border-t border-line pt-4"
                  hint="Use an IANA timezone such as Asia/Kolkata. Activity days are grouped in this zone."
                  htmlFor="timezone"
                  label="Timezone"
                >
                  <Input
                    id="timezone"
                    maxLength={64}
                    onChange={(event) => setTimezone(event.target.value)}
                    value={timezone}
                  />
                </Field>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="divide-y divide-line rounded-md border border-line">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-xs text-secondary">Display name</dt>
                  <dd className="text-xs font-medium text-primary">{displayName || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-xs text-secondary">Profile URL</dt>
                  <dd className="font-mono text-xs font-medium text-primary">
                    /u/{slug || "your-slug"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-xs text-secondary">Profile visibility</dt>
                  <dd className="text-xs font-medium text-primary">
                    {visibility === "PUBLIC" ? "Public" : "Private"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-xs text-secondary">Search indexing</dt>
                  <dd className="text-xs font-medium text-primary">
                    {searchIndexing ? "Enabled" : "Disabled"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-xs text-secondary">Timezone</dt>
                  <dd className="font-mono text-xs font-medium text-primary">{timezone}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-xs text-secondary">Repositories to track</dt>
                  <dd className="text-right text-xs font-medium text-primary">
                    {formatNumber(selected.size)}
                  </dd>
                </div>
              </dl>

              {selectedRepositories.length > 0 ? (
                <ul className="max-h-44 scrollbar-thin divide-y divide-line overflow-y-auto rounded-md border border-line">
                  {selectedRepositories.map((repo) => (
                    <li
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                      key={repo.id}
                    >
                      <span className="truncate font-mono text-[11px] text-primary">
                        {repo.repository.fullName}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted uppercase">
                        {repo.repository.visibility === "PUBLIC" ? "public" : "private"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Alert tone="warning" title="No repositories selected">
                  You can finish setup now and enable tracking later from the dashboard.
                </Alert>
              )}

              <p className="text-[11px] leading-5 text-muted">
                Completing setup saves your profile and tracks the selected repositories. Historical
                backfill continues in the background; nothing is published automatically.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
          <div>
            {step > 1 ? (
              <Button
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setStep((current) => Math.max(1, current - 1));
                }}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                Back
              </Button>
            ) : (
              <Link
                className="text-xs font-medium text-secondary hover:text-primary"
                href="/dashboard"
              >
                Skip for now
              </Link>
            )}
          </div>
          <Button loading={saving} onClick={next} size="md">
            {saving ? (
              "Saving…"
            ) : step === 3 ? (
              <>
                Complete setup &amp; start sync
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Check aria-hidden="true" className="h-3 w-3" />
        You can change every setting later from your workspace.
      </p>
    </div>
  );
}
