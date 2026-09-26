"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, like } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { toMinor } from "@/lib/format";
import { MAX_LINE_ITEMS, parseLines } from "@/lib/parse";

async function nextRequirementRef(): Promise<string> {
  const db = await getDbAsync();
  const year = new Date().getFullYear();
  const rows = await db
    .select({ ref: t.requirements.ref })
    .from(t.requirements)
    .where(like(t.requirements.ref, `REQ-${year}-%`));
  const max = rows.reduce((acc, r) => {
    const n = Number(r.ref.split("-").pop());
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `REQ-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function createRequirementAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) redirect("/requirements/new?error=title");

  const customerIdRaw = String(formData.get("customerId") ?? "");
  const customerId = customerIdRaw ? Number(customerIdRaw) : null;
  const priority = String(formData.get("priority") ?? "normal");
  const linesText = String(formData.get("lines") ?? "");
  const { lines, errors } = parseLines(linesText);

  if (errors.length > 0) {
    redirect(`/requirements/new?error=${encodeURIComponent(errors[0])}`);
  }
  if (lines.length === 0) {
    redirect("/requirements/new?error=lines");
  }

  const ref = await nextRequirementRef();
  const requiredDeliveryDate = String(formData.get("requiredDeliveryDate") ?? "") || null;
  const submissionRaw = String(formData.get("submissionDeadline") ?? "");
  const submissionDeadline = submissionRaw ? new Date(submissionRaw) : null;

  const result = await db.transaction(async (tx) => {
    const [req] = await tx
      .insert(t.requirements)
      .values({
        ref,
        title,
        customerId: customerId && Number.isFinite(customerId) ? customerId : null,
        productSummary: String(formData.get("productSummary") ?? "") || null,
        quantityTotal: lines.reduce((s, l) => s + l.quantity, 0),
        requiredDeliveryDate,
        submissionDeadline,
        tenderRef: String(formData.get("tenderRef") ?? "") || null,
        enquiryRef: String(formData.get("enquiryRef") ?? "") || null,
        technicalSpecs: String(formData.get("technicalSpecs") ?? "") || null,
        status: "received",
        priority: (["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal") as any,
        ownerUserId: user.id,
      })
      .returning({ id: t.requirements.id });

    await tx.insert(t.requirementLineItems).values(
      lines.map((l, i) => ({
        requirementId: req.id,
        lineNo: i + 1,
        partNumber: l.partNumber,
        description: l.description,
        quantity: l.quantity,
        unit: "nos",
        targetUnitPrice: l.targetUnitPrice,
      })),
    );

    await tx.insert(t.requirementStatusEvents).values({
      requirementId: req.id,
      fromStatus: null,
      toStatus: "received",
      note: "Requirement captured",
      actorUserId: user.id,
    });

    await writeAudit(tx, {
      entityType: "requirement",
      entityId: req.id,
      action: "requirement.created",
      actor: { userId: user.id, role: user.role },
      after: { ref, title, lineItems: lines.length, totalQuantity: lines.reduce((s, l) => s + l.quantity, 0) },
    });

    return req.id;
  });

  revalidatePath("/requirements");
  redirect(`/requirements/${result}`);
}

export async function addLineItemAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));

  const count = await db
    .select({ id: t.requirementLineItems.id })
    .from(t.requirementLineItems)
    .where(eq(t.requirementLineItems.requirementId, requirementId));
  if (count.length >= MAX_LINE_ITEMS) {
    throw new Error(`Line item limit of ${MAX_LINE_ITEMS} reached.`);
  }
  const nextLineNo = count.length + 1;
  const quantity = Math.max(0, Math.round(Number(formData.get("quantity") ?? 0)));
  const targetText = String(formData.get("targetUnitPrice") ?? "");

  await db.transaction(async (tx) => {
    const [line] = await tx
      .insert(t.requirementLineItems)
      .values({
        requirementId,
        lineNo: nextLineNo,
        partNumber: String(formData.get("partNumber") ?? "").trim(),
        description: String(formData.get("description") ?? "") || null,
        quantity,
        unit: String(formData.get("unit") ?? "nos"),
        targetUnitPrice: targetText ? toMinor(targetText) : null,
      })
      .returning({ id: t.requirementLineItems.id });
    await writeAudit(tx, {
      entityType: "requirement_line_item",
      entityId: line.id,
      action: "line_item.added",
      actor: { userId: user.id, role: user.role },
      after: { requirementId, quantity, partNumber: String(formData.get("partNumber") ?? "") },
    });
    return line.id;
  });

  revalidatePath(`/requirements/${requirementId}`);
}

export async function updateRequirementStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const toStatus = String(formData.get("status"));
  const note = String(formData.get("note") ?? "") || null;

  const [current] = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.id, requirementId))
    .limit(1);
  if (!current) throw new Error("Requirement not found.");

  await db.transaction(async (tx) => {
    await tx
      .update(t.requirements)
      .set({ status: toStatus as any, updatedAt: new Date() })
      .where(eq(t.requirements.id, requirementId));
    await tx.insert(t.requirementStatusEvents).values({
      requirementId,
      fromStatus: current.status,
      toStatus: toStatus as any,
      note,
      actorUserId: user.id,
    });
    await writeAudit(tx, {
      entityType: "requirement",
      entityId: requirementId,
      action: "requirement.status_changed",
      actor: { userId: user.id, role: user.role },
      before: { status: current.status },
      after: { status: toStatus },
      reason: note,
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/requirements");
}

export async function recordLossAction(formData: FormData): Promise<void> {
  const user = await requirePermission("losses:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const reasonCode = String(formData.get("lossReasonCode") ?? "other");
  const notes = String(formData.get("lossReasonNotes") ?? "") || null;
  const competitor = String(formData.get("lossCompetitor") ?? "") || null;
  const quotedText = String(formData.get("lossQuotedPrice") ?? "");
  const winningText = String(formData.get("lossWinningPrice") ?? "");

  const [current] = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.id, requirementId))
    .limit(1);
  if (!current) throw new Error("Requirement not found.");

  await db.transaction(async (tx) => {
    await tx
      .update(t.requirements)
      .set({
        status: "lost",
        lossReasonCode: reasonCode as any,
        lossReasonNotes: notes,
        lossCompetitor: competitor,
        lossQuotedPrice: quotedText ? toMinor(quotedText) : null,
        lossWinningPrice: winningText ? toMinor(winningText) : null,
        updatedAt: new Date(),
      })
      .where(eq(t.requirements.id, requirementId));
    await tx.insert(t.requirementStatusEvents).values({
      requirementId,
      fromStatus: current.status,
      toStatus: "lost",
      note: `Loss reason: ${reasonCode}${competitor ? ` (${competitor})` : ""}`,
      actorUserId: user.id,
    });
    await writeAudit(tx, {
      entityType: "requirement",
      entityId: requirementId,
      action: "requirement.lost",
      actor: { userId: user.id, role: user.role },
      before: { status: current.status },
      after: { status: "lost", lossReasonCode: reasonCode, lossCompetitor: competitor },
      reason: notes ?? reasonCode,
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/requirements");
}

export async function updateRequirementAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const [current] = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.id, requirementId))
    .limit(1);
  if (!current) throw new Error("Requirement not found.");

  const patch = {
    title: String(formData.get("title") ?? current.title),
    productSummary: String(formData.get("productSummary") ?? "") || null,
    requiredDeliveryDate: String(formData.get("requiredDeliveryDate") ?? "") || null,
    priority: String(formData.get("priority") ?? current.priority) as any,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(t.requirements)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(t.requirements.id, requirementId));
    await writeAudit(tx, {
      entityType: "requirement",
      entityId: requirementId,
      action: "requirement.updated",
      actor: { userId: user.id, role: user.role },
      before: { title: current.title, priority: current.priority },
      after: patch,
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
}

export async function deleteLineItemAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const lineItemId = Number(formData.get("lineItemId"));
  await db.transaction(async (tx) => {
    await tx
      .delete(t.requirementLineItems)
      .where(
        and(
          eq(t.requirementLineItems.id, lineItemId),
          eq(t.requirementLineItems.requirementId, requirementId),
        ),
      );
    await writeAudit(tx, {
      entityType: "requirement_line_item",
      entityId: lineItemId,
      action: "line_item.deleted",
      actor: { userId: user.id, role: user.role },
      before: { requirementId },
    });
  });
  revalidatePath(`/requirements/${requirementId}`);
}
