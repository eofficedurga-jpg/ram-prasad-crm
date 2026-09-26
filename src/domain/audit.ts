// Audit trail of material changes. Every material mutation writes one row in
// the same transaction as the change, so the trail cannot drift from the data.

import { auditLogs } from "@/db/schema";

export type AuditActor = {
  userId: number | null;
  role: string | null;
};

export type AuditEntry = {
  entityType: string;
  entityId: number;
  action: string;
  actor: AuditActor;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

// `tx` is a Drizzle transaction or db instance; typed loosely to accept both.
export async function writeAudit(tx: any, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    actorUserId: entry.actor.userId,
    actorRole: entry.actor.role as any,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  });
}

export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== (after as Record<string, unknown>)[key]) {
      b[key] = before[key];
      a[key] = (after as Record<string, unknown>)[key];
    }
  }
  return { before: b, after: a };
}
