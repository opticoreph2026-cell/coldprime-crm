import { z } from "zod";

export const statusDefinitionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  type: z.string().trim().min(1, "Type is required").max(50),
});

export const statusDefinitionUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  isActive: z.boolean().optional(),
});

export const statusReorderSchema = z.object({
  type: z.string().trim().min(1).max(50),
  ids: z.array(z.string().min(1)).min(1).max(200),
});
