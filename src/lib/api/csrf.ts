import { env } from "@/lib/validation/env";

export class CrossOriginError extends Error {
  readonly code = "FORBIDDEN";

  constructor() {
    super("The request origin is not allowed");
    this.name = "CrossOriginError";
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const allowedOrigins = new Set<string>();

  try {
    allowedOrigins.add(new URL(env.APP_BASE_URL).origin);
  } catch {
    // APP_BASE_URL is validated at startup, so this is only defensive.
  }

  try {
    allowedOrigins.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URLs; the origin check below still applies.
  }

  if (!allowedOrigins.has(origin)) {
    throw new CrossOriginError();
  }
}
