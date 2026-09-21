import { auth } from "./auth";

export async function getBranchFilter() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = session.user;

  // HEAD_ADMIN must always have an active branch selected
  const branchId = user.activeBranchId || user.branchId;
  if (!branchId) {
    throw new Error("No branch assigned");
  }

  return { branchId };
}

export async function requireBranchId() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = session.user;
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
