import { z } from "zod";
import { COMPANY_TYPES, ACCREDITATION_STATUSES } from "@/lib/enums";
import { optEmail, optString } from "./index";

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(200),
  type: z.enum(COMPANY_TYPES).optional(),
  accreditationStatus: z.enum(ACCREDITATION_STATUSES).optional(),
  industry: z.string().max(100).optional(),
  address: optString(500),
  website: optString(300),
  email: optEmail(),
  mobile1: optString(30),
  mobile2: optString(30),
  mobile3: optString(30),
  landline1: optString(30),
  landline2: optString(30),
  landline3: optString(30),
  status: z.string().max(50).optional(),
  notes: optString(5000),
  source: optString(200),
});

export const companyUpdateSchema = companyCreateSchema.partial().extend({
  accreditationSubmittedAt: z.union([z.string().max(40), z.null()]).optional(),
  accreditationDecisionAt: z.union([z.string().max(40), z.null()]).optional(),
});

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
