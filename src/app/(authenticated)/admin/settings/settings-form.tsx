"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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

      setEmails((current) =>
        [...current, payload.data!].sort((a, b) =>
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

      setEmails((current) => current.map((item) => (item.id === email.id ? payload.data! : item)));
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

  async function copyProfileUrl() {
    setError(null);
    setNotice(null);

    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setNotice("Profile URL copied.");
    } catch {
      setError("Could not copy the URL.");
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-5" onSubmit={saveProfile}>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Profile and privacy</h2>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="displayName">
                Display name
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="displayName"
                maxLength={100}
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="profileBio">
                Short bio
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="profileBio"
                maxLength={500}
                onChange={(event) => setProfileBio(event.target.value)}
                rows={3}
                value={profileBio}
              />
              <p className="mt-1 text-xs text-slate-500">{profileBio.length}/500</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="profileSlug">
                Profile slug
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="profileSlug"
                maxLength={39}
                onChange={(event) => setProfileSlug(event.target.value)}
                required
                value={profileSlug}
              />
              <p className="mt-1 text-xs text-slate-500">
                Your public profile is {publicProfileUrl}
              </p>
              <button
                className="mt-2 text-xs font-semibold text-slate-700 underline"
                onClick={copyProfileUrl}
                type="button"
              >
                Copy profile URL
              </button>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-900">Profile visibility</legend>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <input
                    checked={profileVisibility === "PRIVATE"}
                    className="mt-0.5"
                    name="profileVisibility"
                    onChange={() => setProfileVisibility("PRIVATE")}
                    type="radio"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">Private</span>
                    <span className="block text-slate-600">
                      Only you can access your profile and public project URLs.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <input
                    checked={profileVisibility === "PUBLIC"}
                    className="mt-0.5"
                    name="profileVisibility"
                    onChange={() => setProfileVisibility("PUBLIC")}
                    type="radio"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">Public</span>
                    <span className="block text-slate-600">
                      Visitors can open your profile and any public projects.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <label className="flex items-start gap-3 text-sm">
              <input
                checked={searchIndexingEnabled}
                className="mt-0.5"
                onChange={(event) => setSearchIndexingEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block font-medium text-slate-900">Allow search indexing</span>
                <span className="block text-slate-600">
                  Only applies when your profile is public. Off by default.
                </span>
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-slate-900" htmlFor="timezone">
                Timezone
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                id="timezone"
                maxLength={64}
                onChange={(event) => setTimezone(event.target.value)}
                required
                value={timezone}
              />
              <p className="mt-1 text-xs text-slate-500">
                Use an IANA timezone such as Asia/Kolkata.
              </p>
            </div>
          </div>
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

        <button
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving\u2026" : "Save settings"}
        </button>
      </form>

      <form className="space-y-5" onSubmit={saveSummarySettings}>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Daily summaries</h2>
          <p className="mt-1 text-sm text-slate-600">
            Optional narrative summaries of your daily activity. Deterministic metrics, charts and
            activity history do not depend on summaries.
          </p>

          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                checked={summariesEnabled}
                className="mt-0.5"
                onChange={(event) => {
                  setSummariesEnabled(event.target.checked);

                  if (!event.target.checked) {
                    setAllowPrivateMetadataForLlm(false);
                  }
                }}
                type="checkbox"
              />
              <span>
                <span className="block font-medium text-slate-900">Enable daily summaries</span>
                <span className="block text-slate-600">
                  Generates a short summary after each local day ends. Existing summaries are
                  removed when this is disabled.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                checked={allowPrivateMetadataForLlm}
                className="mt-0.5"
                disabled={!summariesEnabled}
                onChange={(event) => setAllowPrivateMetadataForLlm(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block font-medium text-slate-900">
                  Allow private metadata for summaries
                </span>
                <span className="block text-slate-600">
                  Off by default. When enabled, private project names, counts and commit messages
                  may be sent to the configured summary provider. Public summaries always use only
                  public-safe data.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-medium text-slate-900"
                  htmlFor="summaryProvider"
                >
                  Summary provider
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  id="summaryProvider"
                  maxLength={40}
                  onChange={(event) => setSummaryProvider(event.target.value)}
                  placeholder="mock or openai"
                  value={summaryProvider}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Leave blank to use the server default. Use mock for local testing.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900" htmlFor="summaryModel">
                  Summary model
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  id="summaryModel"
                  maxLength={80}
                  onChange={(event) => setSummaryModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                  value={summaryModel}
                />
                <p className="mt-1 text-xs text-slate-500">Optional provider model override.</p>
              </div>
            </div>
          </div>
        </div>

        {summaryError ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {summaryError}
          </p>
        ) : null}

        {summaryNotice ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {summaryNotice}
          </p>
        ) : null}

        <button
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isSavingSummaries}
          type="submit"
        >
          {isSavingSummaries ? "Saving\u2026" : "Save summary settings"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Verified author emails</h2>
        <p className="mt-1 text-sm text-slate-600">
          RepoLog matches commits by GitHub account first, then by verified email. Add emails you
          control so commits made from other Git identities are counted.
        </p>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={addEmail}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="newEmail">
              Email address
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              id="newEmail"
              onChange={(event) => setNewEmail(event.target.value)}
              required
              type="email"
              value={newEmail}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs text-slate-600">
            <input
              checked={newEmailVerified}
              onChange={(event) => setNewEmailVerified(event.target.checked)}
              type="checkbox"
            />
            Verified by me
          </label>
          <button
            className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
            disabled={emailBusy}
            type="submit"
          >
            Add email
          </button>
        </form>

        {emails.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No author emails added yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {emails.map((email) => (
              <li
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                key={email.id}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{email.email}</p>
                  <p className="text-xs text-slate-500">
                    {email.verifiedByUser ? "Verified by you" : "Not verified"}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    className="font-medium text-slate-700 underline disabled:opacity-60"
                    disabled={emailBusy}
                    onClick={() => setVerified(email, !email.verifiedByUser)}
                    type="button"
                  >
                    {email.verifiedByUser ? "Mark unverified" : "Mark verified"}
                  </button>
                  <button
                    className="font-medium text-red-700 underline disabled:opacity-60"
                    disabled={emailBusy}
                    onClick={() => removeEmail(email)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
