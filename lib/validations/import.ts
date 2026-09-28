import { z } from "zod";

// Text fields on the multipart import endpoints (file itself is validated
// separately by extension/size checks in each route).
export const importActionSchema = z.object({
  action: z.enum(["preview", "import"]),
});

export const vendorImportFieldsSchema = z.object({
  action: z.enum(["preview", "import"]),
  vendorId: z.string().max(50).optional(),
});

/** Extract a text field from FormData (File values become undefined). */
export function fdString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}
