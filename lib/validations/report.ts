import { z } from "zod";

export const weeklyReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
  userId: z.string().min(1).optional(),
  format: z.enum(["json", "pdf", "xlsx"]).default("json"),
});

export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;

export const reportNoteSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD"),
  highlights: z.string().max(8000).nullable().optional(),
  blockers: z.string().max(8000).nullable().optional(),
});
