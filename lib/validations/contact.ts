import { z } from "zod";
import { optEmail, optString } from "./index";

export const contactCreateSchema = z.object({
  companyId: z.string().min(1, "Company is required").max(50),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: optString(100),
  position: optString(150),
  email: optEmail(),
  mobile: optString(30),
  landline: optString(30),
  contactPreference: optString(50),
  status: z.string().max(50).optional(),
  notes: optString(5000),
});

export const contactUpdateSchema = contactCreateSchema.partial().omit({ companyId: true });

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
