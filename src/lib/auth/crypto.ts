import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/validation/env";

const TOKEN_VERSION = "v1";
const TOKEN_SALT = Buffer.from("reporlog-token-salt", "utf8");
const TOKEN_INFO = Buffer.from("reporlog-token-encryption-v1", "utf8");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getTokenKey(): Buffer {
  const secret = env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required to encrypt GitHub credentials");
  }

  const derived = hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    TOKEN_SALT,
    TOKEN_INFO,
    KEY_LENGTH,
  );

  return Buffer.from(derived);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getTokenKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = value.split(":");

  if (version !== TOKEN_VERSION || !ivPart || !tagPart || ciphertextPart === undefined) {
    throw new Error("Unsupported encrypted value");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getTokenKey(),
    Buffer.from(ivPart, "base64url"),
    {
      authTagLength: AUTH_TAG_LENGTH,
    },
  );

  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${TOKEN_VERSION}:`);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function codeChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
