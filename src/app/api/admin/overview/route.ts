import { handleApiError, notImplementedError, requireApiTenant } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiTenant();
    return notImplementedError("Admin overview");
  } catch (error) {
    return handleApiError(error);
  }
}
