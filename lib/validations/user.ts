import { z } from "zod";

const ROLES = ["HEAD_ADMIN", "BRANCH_ADMIN", "STAFF"] as const;

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  email: z.email("Invalid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(ROLES).optional(),
  branchId: z.string().max(50).optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(150).optional(),
  email: z.email("Invalid email address").max(200).optional(),
  role: z.enum(ROLES).optional(),
  branchId: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  phone: z.union([z.string().trim().max(30), z.null()]).optional(),
  signatureEmail: z
    .union([z.literal(""), z.email("Invalid email address"), z.null()])
    .optional(),
});

export const branchSwitchSchema = z.object({
  branchId: z.union([z.string().max(50), z.literal(""), z.null()]).optional(),
});
