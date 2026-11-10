import { notImplementedError } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  _context: { params: Promise<{ username: string; slug: string }> },
) {
  return notImplementedError("Public project API");
}
