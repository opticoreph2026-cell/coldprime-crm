import { prisma } from "./prisma";

// Returns true when `status` is an active StatusDefinition for the branch.
// If the branch has no definitions of this type, accept any value (legacy data).
export async function isValidStatus(
  branchId: string,
  type: "company" | "project" | "activity" | "industry",
  status: string
): Promise<boolean> {
  const count = await prisma.statusDefinition.count({
    where: { branchId, type, isActive: true },
  });
  if (count === 0) return true;
  const found = await prisma.statusDefinition.findFirst({
    where: { branchId, type, name: status, isActive: true },
    select: { id: true },
  });
  return Boolean(found);
}
