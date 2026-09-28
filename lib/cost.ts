// Field-level access for vendor cost prices (VendorMaterial.unitPrice = what
// Coldprime PAYS). Product.sellPrice (what Coldprime charges) is not restricted.
//
// This is a company-policy setting, not a schema-level rule: to relax or tighten
// it, change canViewVendorCost() below — every cost check goes through this helper.
import { auth } from "./auth";
import { prisma } from "./prisma";

export function canViewVendorCost(role: string | null | undefined): boolean {
  return role === "BRANCH_ADMIN" || role === "HEAD_ADMIN";
}

/** Live role from the DB (the JWT role can be stale after an admin change). */
export async function getViewerRole(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  return user?.role ?? null;
}

export async function viewerCanSeeCost(): Promise<boolean> {
  return canViewVendorCost(await getViewerRole());
}

/**
 * Server-side strip: remove unitPrice from a response payload so STAFF never
 * receive cost even if a route forgets to gate it. Returns a deep copy.
 */
export function stripCost<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (key, value) => (key === "unitPrice" ? undefined : value))
  ) as T;
}
