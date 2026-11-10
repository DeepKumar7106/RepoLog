import { describe, expect, it } from "vitest";
import { assertSameOrigin, CrossOriginError } from "@/lib/api/csrf";
import { env } from "@/lib/validation/env";

function requestWithOrigin(url: string, origin?: string): Request {
  return new Request(url, {
    headers: origin ? { origin } : undefined,
  });
}

describe("same-origin checks", () => {
  it("allows requests without an Origin header", () => {
    expect(() =>
      assertSameOrigin(requestWithOrigin("http://localhost:3000/api/test")),
    ).not.toThrow();
  });

  it("allows the configured application origin", () => {
    const origin = new URL(env.APP_BASE_URL).origin;

    expect(() =>
      assertSameOrigin(requestWithOrigin("http://localhost:3000/api/test", origin)),
    ).not.toThrow();
  });

  it("allows the request URL origin", () => {
    expect(() =>
      assertSameOrigin(
        requestWithOrigin("http://localhost:3001/api/test", "http://localhost:3001"),
      ),
    ).not.toThrow();
  });

  it("rejects a cross-origin request", () => {
    expect(() =>
      assertSameOrigin(requestWithOrigin("http://localhost:3000/api/test", "https://evil.example")),
    ).toThrow(CrossOriginError);
  });
});
