import { handleApiError, notImplementedError, requireApiTenant } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, _context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiTenant();
    return notImplementedError("Project updates");
  } catch (error) {
    return handleApiError(error);
  }
}
