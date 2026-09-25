import { z } from "zod";

export const emailTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(150),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().min(1, "Body is required").max(50000),
  category: z.union([z.string().max(100), z.null()]).optional(),
});

export const emailTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1, "Template name cannot be empty").max(150).optional(),
  subject: z.string().trim().min(1, "Subject cannot be empty").max(300).optional(),
  body: z.string().min(1, "Body cannot be empty").max(50000).optional(),
  category: z.union([z.string().max(100), z.null()]).optional(),
});
