import { z } from "zod";
import { optString } from "./index";

export const emailSendSchema = z.object({
  toEmail: z
    .string()
    .trim()
    .max(200)
    .min(1, "Recipient email is required")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Invalid recipient email address" }),
  toName: z.union([z.string().trim().max(150), z.null()]).optional(),
  templateId: z.union([z.string().max(50), z.null()]).optional(),
  subject: optString(300),
  body: z.union([z.string().max(50000), z.null()]).optional(),
  fromName: optString(150),
  companyName: optString(200),
  cc: optString(300),
  ccName: optString(300),
});

export const emailBulkSendSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().min(1, "Body is required").max(50000),
  companyIds: z.array(z.string().max(50)).min(1, "No companies selected"),
  skipAlreadySent: z.boolean().optional(),
  senderName: z.string().trim().max(150).optional(),
  cc: z.string().trim().max(300).optional(),
  ccName: z.string().trim().max(300).optional(),
});
