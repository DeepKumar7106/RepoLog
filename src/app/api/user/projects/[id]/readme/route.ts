import { handleApiError, notImplementedError, requireApiTenant } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, _context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiTenant();
    return notImplementedError("Public README management");
  } catch (error) {
    return handleApiError(error);
  }
}
