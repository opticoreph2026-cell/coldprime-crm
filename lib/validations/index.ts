import { z } from "zod";
import { NextResponse } from "next/server";

// Parse request JSON safely (malformed body → 400, not 500)
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Validate against a zod schema; on failure return a 400 with field-level errors
export function parseOr400<T extends z.ZodType>(
  schema: T,
  data: unknown
): { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Validation failed", fields }, { status: 400 }),
  };
}

// --- shared field helpers -------------------------------------------------

/** optional string (UI sends "" for empty); null allowed */
export const optString = (max = 500) =>
  z.union([z.string().max(max, `Must be at most ${max} characters`), z.null()]).optional();

/** optional id ("" means no reference) */
export const optId = () =>
  z.union([z.string().max(50), z.literal(""), z.null()]).optional();

/** optional email — "" or null allowed, otherwise must be a valid address */
export const optEmail = () =>
  z.union([z.literal(""), z.email("Invalid email address"), z.null()]).optional();

/** optional date-like string ("" | "YYYY-MM-DD" | ISO); null allowed */
export const optDate = () =>
  z
    .union([z.string().max(40), z.null()])
    .optional()
    .refine((v) => v === undefined || v === null || v === "" || !isNaN(Date.parse(v)), {
      message: "Invalid date",
    });

/** optional numeric field sent as string | number | "" | null */
export const optNumber = () =>
  z
    .union([z.number(), z.string().max(30), z.null()])
    .optional()
    .refine((v) => v === undefined || v === null || v === "" || !isNaN(Number(v)), {
      message: "Must be a number",
    });
