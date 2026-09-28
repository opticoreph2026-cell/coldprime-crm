import { z } from "zod";
import { optDate, optNumber, optString } from "./index";

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  category: optString(100),
  brand: optString(100),
  model: optString(100),
  unit: optString(50),
  sellPrice: optNumber(),
  currency: z.string().max(10).optional(),
  priceValidUntil: optDate(),
  leadTimeDays: optNumber(),
  isActive: z.boolean().optional(),
  notes: optString(5000),
});

export const productUpdateSchema = productCreateSchema.partial();

/** "" | null | undefined -> null, otherwise integer days */
export function toLeadTimeDays(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Math.round(Number(value));
  if (isNaN(n) || n < 0) return null;
  return n;
}
