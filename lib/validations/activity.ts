import { z } from "zod";
import { optDate, optId, optString } from "./index";

export const activityCreateSchema = z.object({
  companyId: optId(),
  projectId: optId(),
  contactId: optId(),
  type: z.string().trim().min(1, "Activity type is required").max(80),
  date: z
    .string()
    .max(40)
    .optional()
    .refine((v) => v === undefined || v === "" || !isNaN(Date.parse(v)), { message: "Invalid date" }),
  time: optString(20),
  performedBy: optString(120),
  contactPerson: optString(120),
  description: optString(5000),
  result: optString(2000),
  nextAction: optString(2000),
  nextFollowUp: optDate(),
  notes: optString(5000),
});

export const activityUpdateSchema = z.object({
  type: z.string().trim().min(1, "Activity type cannot be empty").max(80).optional(),
  date: z
    .string()
    .max(40)
    .optional()
    .refine((v) => v === undefined || v === "" || !isNaN(Date.parse(v)), { message: "Invalid date" }),
  time: optString(20),
  performedBy: optString(120),
  contactPerson: optString(120),
  description: optString(5000),
  result: optString(2000),
  nextAction: optString(2000),
  nextFollowUp: optDate(),
  notes: optString(5000),
});
