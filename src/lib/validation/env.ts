import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(32).optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    TEST_DATABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
    DEFAULT_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    AUTH_SECRET: optionalSecret,
    GITHUB_CLIENT_ID: optionalString,
    GITHUB_CLIENT_SECRET: optionalString,
    GITHUB_OAUTH_SCOPES: optionalString,

    GITHUB_APP_ID: optionalString,
    GITHUB_APP_PRIVATE_KEY: optionalString,
    GITHUB_WEBHOOK_SECRET: optionalString,

    JOB_SECRET: optionalSecret,

    SUMMARY_PROVIDER: optionalString,
    SUMMARY_PROVIDER_API_KEY: optionalString,
    SUMMARY_MODEL: optionalString,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required in production",
      });
    }

    if (value.NODE_ENV === "production" && !value.JOB_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JOB_SECRET"],
        message: "JOB_SECRET is required in production",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${details}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
