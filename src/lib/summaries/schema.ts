import { z } from "zod";

export const summaryOutputSchema = z
  .object({
    headline: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(500),
    projectHighlights: z
      .array(
        z
          .object({
            projectId: z.string().trim().min(1).max(64),
            text: z.string().trim().min(1).max(240),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export type ValidatedSummaryOutput = z.infer<typeof summaryOutputSchema>;
