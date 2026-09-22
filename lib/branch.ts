import { auth } from "./auth";
import { prisma } from "./prisma";

export async function getBranchFilter(): Promise<{ branchId?: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { activeBranchId: true, branchId: true, role: true },
  });

  if (!user) throw new Error("Unauthorized");

  // HEAD_ADMIN can see all branches if no activeBranchId selected
  if (user.role === "HEAD_ADMIN" && !user.activeBranchId) {
    return {};
  }

  const branchId = user.activeBranchId || user.branchId;
  if (!branchId) throw new Error("No branch assigned");

  return { branchId };
}

export async function requireBranchId(): Promise<string> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { activeBranchId: true, branchId: true, role: true },
  });

  if (!user) throw new Error("Unauthorized");

  // HEAD_ADMIN must select a branch
  const branchId = user.activeBranchId || user.branchId;
  if (!branchId) {
    throw new Error("No branch assigned — please select a branch first");
  }

  return branchId;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}
