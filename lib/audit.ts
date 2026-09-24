import { prisma } from "./prisma";
import { Prisma } from "./prisma/client/client";

interface AuditParams {
  userId?: string;
  branchId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        branchId: params.branchId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details: params.details ? JSON.parse(JSON.stringify(params.details)) : Prisma.JsonNull,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
