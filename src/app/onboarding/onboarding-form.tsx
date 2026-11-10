"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type OnboardingFormProps = Readonly<{
  defaultBio: string;
  defaultDisplayName: string;
  defaultSearchIndexing: boolean;
  defaultTimezone: string;
  defaultVisibility: "PUBLIC" | "PRIVATE";
  profileSlug: string;
}>;

type ErrorPayload = {
  error?: {
    message?: string;
  };
};

export function OnboardingForm({
  defaultBio,
  defaultDisplayName,
  defaultSearchIndexing,
  defaultTimezone,
  defaultVisibility,
  profileSlug,
}: OnboardingFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [bio, setBio] = useState(defaultBio);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(defaultVisibility);
  const [searchIndexing, setSearchIndexing] = useState(defaultSearchIndexing);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
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

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;

        setError(payload?.error?.message ?? "Could not save onboarding. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not save onboarding. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
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
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          value={bio}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-900">Profile visibility</legend>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input
              checked={visibility === "PRIVATE"}
              className="mt-0.5"
              name="visibility"
              onChange={() => setVisibility("PRIVATE")}
              type="radio"
            />
            <span>
              <span className="block font-medium text-slate-900">Private (recommended)</span>
              <span className="block text-slate-600">
                Only you can see your profile. You can publish later.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input
              checked={visibility === "PUBLIC"}
              className="mt-0.5"
              name="visibility"
              onChange={() => setVisibility("PUBLIC")}
              type="radio"
            />
            <span>
              <span className="block font-medium text-slate-900">Public</span>
              <span className="block text-slate-600">
                Visitors can open your profile at /u/{profileSlug}.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input
          checked={searchIndexing}
          className="mt-0.5"
          onChange={(event) => setSearchIndexing(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block font-medium text-slate-900">Allow search indexing</span>
          <span className="block text-slate-600">
            Only applies when your profile is public. This is off by default.
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
          value={timezone}
        />
        <p className="mt-1 text-xs text-slate-500">Use an IANA timezone such as Asia/Kolkata.</p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving…" : "Continue to dashboard"}
      </button>
    </form>
  );
}
