import { describe, expect, it } from "vitest";
import {
  codeChallengeFromVerifier,
  decryptSecret,
  encryptSecret,
  generateSessionToken,
  hashSessionToken,
  isEncryptedSecret,
  safeEqual,
} from "@/lib/auth/crypto";
import { getPrimaryVerifiedEmail } from "@/lib/auth/github";

describe("secret encryption", () => {
  it("round-trips a GitHub token without storing it in plaintext", () => {
    const plaintext = "gho_example_access_token";
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("uses a fresh IV for every encryption", () => {
    expect(encryptSecret("same-value")).not.toBe(encryptSecret("same-value"));
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("secret-value");
    const parts = encrypted.split(":");
    parts[3] = "AAAA";

    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("rejects unsupported encrypted values", () => {
    expect(() => decryptSecret("plain-text")).toThrow();
  });
});

describe("session tokens", () => {
  it("generates distinct, sufficiently long tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes tokens deterministically and never returns the raw token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    expect(hash).toBe(hashSessionToken(token));
    expect(hash).not.toBe(token);
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe("PKCE", () => {
  it("matches the RFC 7636 example challenge", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    expect(codeChallengeFromVerifier(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("safeEqual", () => {
  it("compares equal and unequal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("GitHub verified emails", () => {
  it("prefers the primary verified email", () => {
    expect(
      getPrimaryVerifiedEmail([
        { email: "secondary@example.com", verified: true },
        { email: "primary@example.com", primary: true, verified: true },
      ]),
    ).toBe("primary@example.com");
  });

  it("falls back to any verified email", () => {
    expect(
      getPrimaryVerifiedEmail([
        { email: "unverified@example.com", verified: false },
        { email: "verified@example.com", verified: true },
      ]),
    ).toBe("verified@example.com");
  });

  it("returns null when no email is verified", () => {
    expect(getPrimaryVerifiedEmail([{ email: "unverified@example.com" }])).toBeNull();
  });
});
