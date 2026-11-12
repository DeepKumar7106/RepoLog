import { ImageResponse } from "next/og";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get("type");
  const username = searchParams.get("username")?.slice(0, 100);
  const projectSlug = searchParams.get("project")?.slice(0, 100);
  let title = "RepoLog";
  let subtitle = "Turn GitHub activity into a clear project portfolio and timeline.";
  let badge = "Project portfolio";

  if (type === "profile" && username) {
    const profile = await services.publicProfiles.findProfileBySlug(username);

    if (profile) {
      title = profile.displayName ?? profile.githubLogin;
      subtitle = profile.profileBio ?? `@${profile.profileSlug} on RepoLog`;
      badge = `${profile.projects.length} public project${profile.projects.length === 1 ? "" : "s"}`;
    }
  }

  if (type === "project" && username && projectSlug) {
    const project = await services.publicProfiles.findProjectBySlugs(username, projectSlug);

    if (project) {
      title = project.displayTitle;
      subtitle = project.shortDescription ?? `A project by @${project.owner.profileSlug}`;
      badge = project.status.replaceAll("_", " ");
    }
  }

  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "64px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: -1 }}>
          RepoLog
        </div>
        <div
          style={{
            background: "rgba(248, 250, 252, 0.12)",
            borderRadius: 999,
            display: "flex",
            fontSize: 22,
            padding: "10px 20px",
          }}
        >
          {badge}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1040 }}>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 45 ? 56 : 72,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.08,
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "#cbd5e1",
            display: "flex",
            fontSize: 30,
            lineHeight: 1.35,
            marginTop: 22,
            overflow: "hidden",
          }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ color: "#94a3b8", display: "flex", fontSize: 22 }}>
        GitHub remains the source of truth for repositories and code.
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
