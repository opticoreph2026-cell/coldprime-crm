import { z } from "zod";
import { LEAD_TYPES } from "@/lib/enums";
import { optDate, optId, optNumber, optString } from "./index";

export const leadCreateSchema = z.object({
  companyId: optId(),
  contactId: optId(),
  type: z.enum(LEAD_TYPES).optional(),
  status: z.string().max(80).optional(),
  source: optString(200),
  industry: optString(100),
  priority: z.enum(["Low", "Medium", "High"]).optional(),
  estimatedValue: optNumber(),
  assignedTo: optString(120),
  notes: optString(5000),
  lastContactDate: optDate(),
  nextFollowUp: optDate(),
});

export const leadUpdateSchema = leadCreateSchema.partial();

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
