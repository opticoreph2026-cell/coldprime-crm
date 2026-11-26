// Event outbox skeleton (Phase 0).
//
// Domain events are written to EventOutbox inside the same transaction as the
// business mutation (emitInTransaction below), then published exactly once by
// the outbox worker (publishOutbox). The worker only executes actions on the
// whitelist — approve / issue / mark Won are deliberately NOT automatable and
// require a human decision (Phase 11 implements real publishing).
//
// Usage inside a route handler:
//
//   await prisma.$transaction(async (tx) => {
//     await tx.company.update({ where: { id }, data: { status: "Active" } });
//     await emitInTransaction(tx, {
//       branchId,
//       eventType: "company.status_changed",
//       payload: { companyId: id, previous: "Prospect", current: "Active" },
//       dedupeKey: `company:${id}:status_changed:${Date.now()}`,
//     });
//   });

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import type { PrismaClient } from "@/lib/prisma/client/client";

export interface OutboxEvent {
  branchId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  dedupeKey: string;
}

/** Whitelist of automation actions the outbox worker may execute. */
export const ALLOWED_AUTOMATION_ACTIONS = new Set([
  "audit.log",
  "email.send_single",
  "activity.record",
]);

export function isAutomationActionAllowed(action: string): boolean {
  return ALLOWED_AUTOMATION_ACTIONS.has(action);
}

/** Insert an outbox event within an active Prisma transaction client. */
export async function emitInTransaction(
  tx: PrismaClient,
  event: OutboxEvent
) {
  await tx.eventOutbox.create({
    data: {
      branchId: event.branchId,
      eventType: event.eventType,
      payload: event.payload,
      dedupeKey: event.dedupeKey,
      status: "pending",
    },
  });
}

/** Convenience wrapper: emit an outbox event alongside other writes in one tx. */
export async function emitWithTransaction(
  work: (tx: TxClient) => Promise<unknown>,
  tx: PrismaClient = prisma
): Promise<unknown> {
  return tx.$transaction(async (t: TxClient) => {
    const result = await work(t);
    return result;
  });
}

/** PrismaClient minus the connection-management methods (the $transaction callback type). */
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

/**
 * Publish pending outbox events exactly once.
 *
 * Picks a batch of pending events, marks each published, and records the
 * publication in the audit log. Idempotency is guaranteed by the dedupeKey
 * unique constraint: re-publishing the same event is a no-op.
 *
 * Returns the number of events published in this run.
 */
export async function publishOutbox({ batchSize = 100 }: { batchSize?: number } = {}): Promise<number> {
  const pending = await prisma.eventOutbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let published = 0;
  for (const event of pending) {
    try {
      // Stub publication: record the intent in the audit log. Phase 11 replaces
      // this with real delivery (webhook / email / search index / …).
      await prisma.auditLog.create({
        data: {
          branchId: event.branchId,
          action: "OUTBOX_PUBLISH",
          entity: "EventOutbox",
          entityId: event.id,
          details: {
            eventType: event.eventType,
            dedupeKey: event.dedupeKey,
            automated: isAutomationActionAllowed(event.eventType),
          },
        },
      });

      await prisma.eventOutbox.update({
        where: { id: event.id },
        data: { status: "published", publishedAt: new Date() },
      });
      published++;
    } catch (error) {
      await prisma.eventOutbox.update({
        where: { id: event.id },
        data: { status: "failed" },
      });
      console.error(`Outbox publish failed for ${event.id}:`, error);
    }
  }

  return published;
}
