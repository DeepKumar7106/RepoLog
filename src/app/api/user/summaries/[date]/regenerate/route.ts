import { handleApiError, notImplementedError, requireApiTenant } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, _context: { params: Promise<{ date: string }> }) {
  try {
    await requireApiTenant();
    return notImplementedError("Summary regeneration");
  } catch (error) {
    return handleApiError(error);
  }
}
