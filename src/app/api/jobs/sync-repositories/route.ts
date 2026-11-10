import { isAuthorizedJobRequest } from "@/lib/api/job-auth";
import { apiError, notImplementedError } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return apiError("UNAUTHENTICATED", "A valid job secret is required", 401);
  }

  return notImplementedError("Repository sync job");
}
