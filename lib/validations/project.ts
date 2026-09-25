import { z } from "zod";
import { optDate, optId, optString } from "./index";

export const projectCreateSchema = z.object({
  companyId: z.string().min(1, "Company is required").max(50),
  projectName: z.string().trim().min(1, "Project name is required").max(200),
  projectLocation: optString(300),
  projectType: optString(100),
  status: z.string().max(80).optional(),
  contactId: optId(),
  assignedTo: optString(120),
  source: optString(200),
  quotationDate: optDate(),
  startDate: optDate(),
  targetCompletion: optDate(),
  installationStatus: optString(80),
  testingStatus: optString(80),
  commissioningStatus: optString(80),
  remarks: optString(2000),
});

export const projectUpdateSchema = z.object({
  projectName: z.string().trim().min(1, "Project name cannot be empty").max(200).optional(),
  projectLocation: optString(300),
  projectType: optString(100),
  status: z.string().max(80).optional(),
  contactId: optId(),
  assignedTo: optString(120),
  quotationDate: optDate(),
  startDate: optDate(),
  targetCompletion: optDate(),
  actualCompletion: optDate(),
  installationStatus: optString(80),
  testingStatus: optString(80),
  commissioningStatus: optString(80),
  remarks: optString(2000),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
