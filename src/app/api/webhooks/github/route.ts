import { notImplementedError } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function POST() {
  // Milestone 8 adds signature verification before accepting any payload.
  return notImplementedError("GitHub webhook handling");
}
