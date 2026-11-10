import { notImplementedError } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  _context: { params: Promise<{ username: string; date: string }> },
) {
  return notImplementedError("Public daily activity API");
}
