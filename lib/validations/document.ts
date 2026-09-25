import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "@/lib/enums";
import { optId } from "./index";

export const documentCreateSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES, { message: "Invalid category" }),
  fileName: z.string().trim().min(1, "File name is required").max(300),
  fileUrl: z.string().trim().min(1, "File URL is required").max(2000),
  companyId: optId(),
  leadId: optId(),
  projectId: optId(),
  vendorId: optId(),
});
