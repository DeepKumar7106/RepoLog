import { handleApiError, notImplementedError, requireApiTenant } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    await requireApiTenant();
    return notImplementedError("Settings updates");
  } catch (error) {
    return handleApiError(error);
  }
}
