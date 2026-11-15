"use client";

import {
  CheckCircle2,
  Globe2,
  Lock,
  Mail,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { absolutePublicUrl, publicProfilePath } from "@/lib/urls/public-urls";
import type { AuthorEmailDto } from "@/server/dto/author-email-dto";
import type { UserProfileDto } from "@/server/dto/user-dto";
import type { UserSettingsDto } from "@/server/dto/user-settings-dto";

type SettingsFormProps = Readonly<{
  appBaseUrl: string;
  authorEmails: AuthorEmailDto[];
  profile: UserProfileDto;
  settings: UserSettingsDto;
}>;

type ErrorPayload = {
  error?: {
    message?: string;
  };
};

export function SettingsForm({ appBaseUrl, authorEmails, profile, settings }: SettingsFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [profileBio, setProfileBio] = useState(profile.profileBio ?? "");
  const [profileSlug, setProfileSlug] = useState(profile.profileSlug);
  const [profileVisibility, setProfileVisibility] = useState<"PUBLIC" | "PRIVATE">(
    profile.profileVisibility,
  );
  const [searchIndexingEnabled, setSearchIndexingEnabled] = useState(profile.searchIndexingEnabled);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [emails, setEmails] = useState(authorEmails);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailVerified, setNewEmailVerified] = useState(true);
  const [summariesEnabled, setSummariesEnabled] = useState(settings.summariesEnabled);
  const [allowPrivateMetadataForLlm, setAllowPrivateMetadataForLlm] = useState(
    settings.allowPrivateMetadataForLlm,
  );
  const [summaryProvider, setSummaryProvider] = useState(settings.summaryProvider ?? "");
  const [summaryModel, setSummaryModel] = useState(settings.summaryModel ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSummaries, setIsSavingSummaries] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);

  const publicProfileUrl = absolutePublicUrl(
    publicProfilePath(profileSlug.trim() || profile.profileSlug),
    appBaseUrl,
  );

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          profileBio: profileBio.trim() || null,
          profileSlug: profileSlug.trim(),
          profileVisibility,
          searchIndexingEnabled,
          timezone: timezone.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        setError(payload?.error?.message ?? "Could not save settings.");
        return;
      }

      setNotice("Profile settings saved.");
      router.refresh();
    } catch {
      setError("Could not save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSummarySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSummaries(true);
    setSummaryError(null);
    setSummaryNotice(null);

    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summariesEnabled,
          allowPrivateMetadataForLlm,
          summaryProvider: summaryProvider.trim() || null,
          summaryModel: summaryModel.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        setSummaryError(payload?.error?.message ?? "Could not save summary settings.");
        return;
      }

      setSummaryNotice("Summary settings saved.");
      router.refresh();
    } catch {
      setSummaryError("Could not save summary settings. Please try again.");
    } finally {
      setIsSavingSummaries(false);
    }
  }

  async function addEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/user/author-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          verifiedByUser: newEmailVerified,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        (ErrorPayload & { data?: AuthorEmailDto }) | null;

      if (!response.ok || !payload?.data) {
        setError(payload?.error?.message ?? "Could not add the author email.");
        return;
      }

      const added = payload.data;
      setEmails((current) =>
        [...current, added].sort((a, b) =>
          a.verifiedByUser === b.verifiedByUser
            ? a.email.localeCompare(b.email)
            : a.verifiedByUser
              ? -1
              : 1,
        ),
      );
      setNewEmail("");
      setNewEmailVerified(true);
      setNotice("Author email added.");
      router.refresh();
    } catch {
      setError("Could not add the author email. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function setVerified(email: AuthorEmailDto, verifiedByUser: boolean) {
    setEmailBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/user/author-emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifiedByUser }),
      });
      const payload = (await response.json().catch(() => null)) as
        (ErrorPayload & { data?: AuthorEmailDto }) | null;

      if (!response.ok || !payload?.data) {
        setError(payload?.error?.message ?? "Could not update the author email.");
        return;
      }

      const updated = payload.data;
      setEmails((current) => current.map((item) => (item.id === email.id ? updated : item)));
      router.refresh();
    } catch {
      setError("Could not update the author email. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function removeEmail(email: AuthorEmailDto) {
    if (!window.confirm(`Remove ${email.email} from author matching?`)) {
      return;
    }

    setEmailBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/user/author-emails/${email.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        setError(payload?.error?.message ?? "Could not remove the author email.");
        return;
      }

      setEmails((current) => current.filter((item) => item.id !== email.id));
      setNotice("Author email removed.");
      router.refresh();
    } catch {
      setError("Could not remove the author email. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={saveProfile}>
        <section className="rounded-lg border border-line bg-canvas" id="profile">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <UserRound aria-hidden="true" className="h-4 w-4 text-muted" />
            <div>
              <h2 className="text-sm font-semibold text-primary">Profile</h2>
              <p className="mt-0.5 text-[11px] text-muted">Your name, URL and public bio.</p>
            </div>
          </div>
          <div className="space-y-4 p-5">
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
                hint="Lowercase letters, numbers and single hyphens."
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
                    onChange={(event) => setProfileSlug(event.target.value.toLowerCase())}
                    required
                    value={profileSlug}
                  />
                </div>
              </Field>
            </div>

            <Field
              hint={`${profileBio.length}/500 characters`}
              htmlFor="profileBio"
              label="Short bio"
            >
              <Textarea
                id="profileBio"
                maxLength={500}
                onChange={(event) => setProfileBio(event.target.value)}
                rows={3}
                value={profileBio}
              />
            </Field>

            <Field
              hint="Use an IANA timezone such as Asia/Kolkata. Activity days are grouped in this zone."
              htmlFor="timezone"
              label="Timezone"
            >
              <Input
                id="timezone"
                maxLength={64}
                onChange={(event) => setTimezone(event.target.value)}
                required
                value={timezone}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-secondary">
                {publicProfileUrl}
              </span>
              <CopyButton label="Copy URL" size="xs" url={publicProfileUrl} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <Globe2 aria-hidden="true" className="h-4 w-4 text-muted" />
            <div>
              <h2 className="text-sm font-semibold text-primary">Privacy and discovery</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Publishing is an explicit choice. New profiles start private.
              </p>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-primary">Profile visibility</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: "PRIVATE" as const,
                    title: "Private",
                    body: "Only you can access your profile and project URLs.",
                    icon: Lock,
                  },
                  {
                    value: "PUBLIC" as const,
                    title: "Public",
                    body: "Visitors can open your profile and any public projects.",
                    icon: Globe2,
                  },
                ].map((option) => {
                  const Icon = option.icon;
                  const active = profileVisibility === option.value;

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
                        name="profileVisibility"
                        onChange={() => setProfileVisibility(option.value)}
                        type="radio"
                      />
                      <span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                          {option.title}
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

            <div className="border-t border-line pt-4">
              <Switch
                checked={searchIndexingEnabled}
                description="Only applies when your profile is public. Off by default."
                id="searchIndexingEnabled"
                label="Allow search engine indexing"
                onCheckedChange={setSearchIndexingEnabled}
              />
            </div>

            {profileVisibility === "PRIVATE" ? (
              <Alert tone="info">
                While your profile is private, public project URLs stay unreachable even if a
                project is marked public.
              </Alert>
            ) : null}
          </div>
        </section>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button loading={isSaving} type="submit">
            {isSaving ? null : <Save aria-hidden="true" className="h-4 w-4" />}
            {isSaving ? "Saving…" : "Save profile settings"}
          </Button>
          <span className="text-[11px] text-muted">
            Applies to your public profile immediately.
          </span>
        </div>
      </form>

      <form className="space-y-4" onSubmit={saveSummarySettings}>
        <section className="rounded-lg border border-line bg-canvas">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-muted" />
            <div>
              <h2 className="text-sm font-semibold text-primary">Daily summaries</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Optional narratives. Metrics, charts and activity history never depend on them.
              </p>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <Switch
              checked={summariesEnabled}
              description="Generates a short summary after each local day ends. Existing summaries are removed when disabled."
              id="summariesEnabled"
              label="Enable daily summaries"
              onCheckedChange={(checked) => {
                setSummariesEnabled(checked);

                if (!checked) {
                  setAllowPrivateMetadataForLlm(false);
                }
              }}
            />

            <div className="border-t border-line pt-4">
              <Switch
                checked={allowPrivateMetadataForLlm}
                description="Off by default. When enabled, private project names, counts and commit messages may be sent to the configured provider. Public summaries always use public-safe data."
                disabled={!summariesEnabled}
                id="allowPrivateMetadataForLlm"
                label="Allow private metadata for summaries"
                onCheckedChange={setAllowPrivateMetadataForLlm}
              />
            </div>

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Field
                hint="Leave blank to use the server default. Use mock for local testing."
                htmlFor="summaryProvider"
                label="Summary provider"
              >
                <Input
                  id="summaryProvider"
                  maxLength={40}
                  onChange={(event) => setSummaryProvider(event.target.value)}
                  placeholder="mock or openai"
                  value={summaryProvider}
                />
              </Field>
              <Field
                hint="Optional provider model override."
                htmlFor="summaryModel"
                label="Summary model"
              >
                <Input
                  id="summaryModel"
                  maxLength={80}
                  onChange={(event) => setSummaryModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                  value={summaryModel}
                />
              </Field>
            </div>
          </div>
        </section>

        {summaryError ? <Alert tone="danger">{summaryError}</Alert> : null}
        {summaryNotice ? <Alert tone="success">{summaryNotice}</Alert> : null}

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button loading={isSavingSummaries} type="submit" variant="secondary">
            {isSavingSummaries ? null : <Save aria-hidden="true" className="h-4 w-4" />}
            {isSavingSummaries ? "Saving…" : "Save summary settings"}
          </Button>
        </div>
      </form>

      <section className="rounded-lg border border-line bg-canvas">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <Mail aria-hidden="true" className="h-4 w-4 text-muted" />
          <div>
            <h2 className="text-sm font-semibold text-primary">Verified author emails</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              RepoLog matches commits by GitHub account first, then by verified email.
            </p>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <p className="text-xs leading-5 text-secondary">
            Add emails you control so commits made from other Git identities are counted.
          </p>

          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
            onSubmit={addEmail}
          >
            <Field htmlFor="newEmail" label="Email address">
              <Input
                id="newEmail"
                onChange={(event) => setNewEmail(event.target.value)}
                required
                type="email"
                value={newEmail}
              />
            </Field>
            <label className="flex h-9 items-center gap-2 text-xs text-secondary">
              <input
                checked={newEmailVerified}
                className="accent-zinc-900 dark:accent-zinc-100"
                onChange={(event) => setNewEmailVerified(event.target.checked)}
                type="checkbox"
              />
              Verified by me
            </label>
            <Button loading={emailBusy} size="md" type="submit" variant="secondary">
              Add email
            </Button>
          </form>

          {emails.length === 0 ? (
            <p className="rounded-md border border-dashed border-line bg-surface px-4 py-6 text-center text-xs text-muted">
              No author emails added yet.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {emails.map((email) => (
                <li
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={email.id}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary">{email.email}</span>
                    <Badge tone={email.verifiedByUser ? "success" : "neutral"} dot>
                      {email.verifiedByUser ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={emailBusy}
                      onClick={() => setVerified(email, !email.verifiedByUser)}
                      size="xs"
                      variant="ghost"
                    >
                      {email.verifiedByUser ? (
                        <>
                          <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                          Mark unverified
                        </>
                      ) : (
                        "Mark verified"
                      )}
                    </Button>
                    <Button
                      disabled={emailBusy}
                      onClick={() => removeEmail(email)}
                      size="xs"
                      variant="danger"
                    >
                      <Trash2 aria-hidden="true" className="h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted">
            <Search aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
            Commit matching never changes repository content. It only decides which imported commits
            belong to you.
          </p>
        </div>
      </section>
    </div>
  );
}
