import { z } from "zod";
import { isDateKey } from "@/lib/time/dates";

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(39, "Slug must be 39 characters or fewer")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

const httpUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .max(2048)
  .refine(
    (value) => value.startsWith("https://") || value.startsWith("http://"),
    "Only http and https URLs are allowed",
  );

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format")
  .refine(isDateKey, "Enter a valid calendar date");

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA timezone");

export const idParamSchema = z.string().min(1).max(64);

export const createProjectSchema = z
  .object({
    userRepositoryId: idParamSchema,
  })
  .strict();

export const projectReadmeSchema = z
  .object({
    publicReadmeMarkdown: z.string().max(100_000).nullable(),
  })
  .strict();

export const authorEmailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .max(254)
      .transform((value) => value.toLowerCase()),
    verifiedByUser: z.boolean().optional(),
  })
  .strict();

export const updateAuthorEmailSchema = z
  .object({
    verifiedByUser: z.boolean(),
  })
  .strict();

export const updateUserRepositorySchema = z
  .object({
    trackingEnabled: z.boolean().optional(),
    publicDisplayEnabled: z.boolean().optional(),
    publicActivityDetail: z.enum(["HIDDEN", "AGGREGATED", "COMMIT_DETAILS"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const bulkUpdateUserRepositoriesSchema = z
  .object({
    trackingEnabled: z.boolean().optional(),
    publicDisplayEnabled: z.boolean().optional(),
    publicActivityDetail: z.enum(["HIDDEN", "AGGREGATED", "COMMIT_DETAILS"]).optional(),
    ids: z.array(idParamSchema).max(1000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.trackingEnabled !== undefined ||
      value.publicDisplayEnabled !== undefined ||
      value.publicActivityDetail !== undefined,
    { message: "At least one update field is required" },
  );

const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const userRepositoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  owner: z.string().trim().max(100).optional(),
  ownerType: z.enum(["USER", "ORGANIZATION"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  archived: booleanQuerySchema.optional(),
  tracking: booleanQuerySchema.optional(),
  publicDisplay: booleanQuerySchema.optional(),
  q: z.string().trim().max(200).optional(),
});

export const updateProjectSchema = z
  .object({
    displayTitle: z.string().trim().min(1).max(120).optional(),
    shortDescription: z.string().trim().max(280).nullable().optional(),
    status: z.enum(["ONGOING", "COMPLETE", "ON_BREAK"]).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    demoUrl: httpUrlSchema.nullable().optional(),
    slug: slugSchema.optional(),
    publicReadmeMarkdown: z.string().max(100_000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(100).nullable().optional(),
    profileBio: z.string().trim().max(500).nullable().optional(),
    profileSlug: slugSchema.optional(),
    profileVisibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    searchIndexingEnabled: z.boolean().optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const onboardingSchema = z
  .object({
    displayName: z.string().trim().max(100).nullable().optional(),
    profileBio: z.string().trim().max(500).nullable().optional(),
    profileVisibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
    searchIndexingEnabled: z.boolean().optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict();

export const updateSettingsSchema = z
  .object({
    summariesEnabled: z.boolean().optional(),
    allowPrivateMetadataForLlm: z.boolean().optional(),
    summaryProvider: z.string().trim().max(64).nullable().optional(),
    summaryModel: z.string().trim().max(128).nullable().optional(),
    defaultActivityDetail: z.enum(["HIDDEN", "AGGREGATED", "COMMIT_DETAILS"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const dateParamSchema = isoDateSchema;

export const publicActivityQuerySchema = z
  .object({
    from: dateParamSchema.optional(),
    to: dateParamSchema.optional(),
    project: slugSchema.optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "The from date must be before or equal to the to date",
    path: ["from"],
  })
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      Date.parse(value.to) - Date.parse(value.from) <= 366 * 24 * 60 * 60 * 1000,
    { message: "Activity ranges are limited to 366 days", path: ["to"] },
  );
