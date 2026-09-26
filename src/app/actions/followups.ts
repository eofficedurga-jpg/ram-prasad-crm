"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission, requireUser } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { buildFollowUpTasks } from "@/domain/followups";
import { getDashboardFacts } from "@/server/dashboard";

export async function regenerateFollowUpsAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDbAsync();
  const facts = await getDashboardFacts();

  const govRows = await db
    .select({
      requirementId: t.governmentResponses.requirementId,
      ref: t.requirements.ref,
      status: t.governmentResponses.status,
      responseDate: t.governmentResponses.responseDate,
      documentId: t.governmentResponses.documentId,
      ownerUserId: t.requirements.ownerUserId,
      createdAt: t.governmentResponses.createdAt,
    })
    .from(t.governmentResponses)
    .leftJoin(t.requirements, eq(t.requirements.id, t.governmentResponses.requirementId))
    .where(
      inArray(t.governmentResponses.status, [
        "clarification_requested",
        "technical_clarification",
      ]),
    );

  const deadlineRows = await db
    .select({
      requirementId: t.requirements.id,
      ref: t.requirements.ref,
      title: t.requirements.title,
      submissionDeadline: t.requirements.submissionDeadline,
      ownerUserId: t.requirements.ownerUserId,
    })
    .from(t.requirements)
    .where(
      and(
        inArray(t.requirements.status, ["received", "qualifying", "quoted"]),
        gte(t.requirements.submissionDeadline, new Date()),
      ),
    );

  const generated = buildFollowUpTasks({
    today: facts.generatedAt,
    noResponseQuotes: facts.quotesAwaitingResponse
      .filter((q) => q.submittedAt)
      .map((q) => ({
        requirementId: q.requirementId,
        requirementRef: q.requirementRef,
        submittedAt: q.submittedAt as Date,
        ownerUserId: null,
      })),
    governmentResponses: govRows.map((r) => ({
      requirementId: r.requirementId,
      requirementRef: r.ref ?? "—",
      status: r.status,
      responseDate: r.responseDate,
      documentId: r.documentId,
      ownerUserId: r.ownerUserId,
    })),
    pendingOemRequests: facts.oemPending.map((r) => ({
      id: r.id,
      requirementId: r.requirementId,
      requirementRef: r.requirementRef,
      oemName: r.oemName,
      sentAt: r.sentAt,
      dueBy: r.dueBy,
      ownerUserId: r.ownerUserId,
    })),
    upcomingDeadlines: deadlineRows
      .filter((d) => d.submissionDeadline)
      .map((d) => ({
        requirementId: d.requirementId,
        requirementRef: d.ref,
        title: d.title,
        submissionDeadline: d.submissionDeadline as Date,
        ownerUserId: d.ownerUserId,
      })),
    invoices: facts.invoices
      .filter((i) => i.balance > 0 && i.dueDate)
      .map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        orderId: i.orderId,
        dueDate: i.dueDate as string,
        balance: i.balance,
        ownerUserId: user.id,
      })),
    expiringDocuments: facts.documents
      .filter((d) => d.daysToExpiry !== null && d.daysToExpiry <= 90)
      .map((d) => ({
        id: d.id,
        title: d.title,
        expiryDate: d.expiryDate as string,
        ownerUserId: d.ownerUserId,
      })),
    atRiskOrders: facts.orders
      .filter((o) => o.risk === "at_risk" || o.risk === "late")
      .map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        deliveryDeadline: o.deliveryDeadline as string,
        outstandingQuantity: o.orderedQuantity - o.acceptedQuantity,
        riskLevel: o.risk,
        ownerUserId: o.ownerUserId,
      })),
  });

  let created = 0;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ dedupeKey: t.followUpTasks.dedupeKey })
      .from(t.followUpTasks)
      .where(eq(t.followUpTasks.status, "open"));
    const known = new Set(existing.map((e) => e.dedupeKey));
    for (const task of generated) {
      if (known.has(task.dedupeKey)) continue;
      await tx.insert(t.followUpTasks).values({
        rule: task.rule as any,
        title: task.title,
        requirementId: task.requirementId ?? null,
        orderId: task.orderId ?? null,
        invoiceId: task.invoiceId ?? null,
        documentId: task.documentId ?? null,
        ownerUserId: task.ownerUserId ?? user.id,
        dueDate: task.dueDate,
        notes: task.notes ?? null,
        dedupeKey: task.dedupeKey,
      });
      created += 1;
    }
    await writeAudit(tx, {
      entityType: "follow_up_tasks",
      entityId: 0,
      action: "followups.regenerated",
      actor: { userId: user.id, role: user.role },
      after: { generated: generated.length, created },
    });
  });

  revalidatePath("/followups");
  revalidatePath("/dashboard");
}

export async function completeFollowUpAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();
  const id = Number(formData.get("taskId"));
  const status = String(formData.get("status") ?? "done");
  await db.transaction(async (tx) => {
    await tx
      .update(t.followUpTasks)
      .set({ status: status as any, completedAt: new Date() })
      .where(eq(t.followUpTasks.id, id));
    await writeAudit(tx, {
      entityType: "follow_up_task",
      entityId: id,
      action: `followup.${status}`,
      actor: { userId: user.id, role: user.role },
      after: { status },
    });
  });
  revalidatePath("/followups");
  revalidatePath("/dashboard");
}

export async function snoozeFollowUpAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDbAsync();
  const id = Number(formData.get("taskId"));
  const days = Number(formData.get("days") ?? 3);
  const [current] = await db
    .select()
    .from(t.followUpTasks)
    .where(eq(t.followUpTasks.id, id))
    .limit(1);
  if (!current) return;
  const due = new Date(current.dueDate);
  due.setDate(due.getDate() + days);
  await db.transaction(async (tx) => {
    await tx
      .update(t.followUpTasks)
      .set({ dueDate: due.toISOString().slice(0, 10) })
      .where(eq(t.followUpTasks.id, id));
    await writeAudit(tx, {
      entityType: "follow_up_task",
      entityId: id,
      action: "followup.snoozed",
      actor: { userId: user.id, role: user.role },
      after: { dueDate: due.toISOString().slice(0, 10), days },
    });
  });
  revalidatePath("/followups");
}
