"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { toMinor } from "@/lib/format";
import { can } from "@/lib/permissions";

export async function createOemRequestAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sourcing:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const requirementLineItemId = Number(formData.get("requirementLineItemId"));
  const oemId = Number(formData.get("oemId"));
  const dueBy = String(formData.get("dueBy") ?? "") || null;

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.oemRequests)
      .values({
        requirementId,
        requirementLineItemId,
        oemId,
        status: "sent",
        method: String(formData.get("method") ?? "email"),
        sentAt: new Date(),
        dueBy,
        requestedQuantity: Math.max(0, Number(formData.get("requestedQuantity") ?? 0)),
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.oemRequests.id });
    await writeAudit(tx, {
      entityType: "oem_request",
      entityId: row.id,
      action: "oem.request_sent",
      actor: { userId: user.id, role: user.role },
      after: { requirementId, requirementLineItemId, oemId },
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/followups");
}

export async function recordOemResponseAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sourcing:write");
  const db = await getDbAsync();
  const oemRequestId = Number(formData.get("oemRequestId"));
  const requirementId = Number(formData.get("requirementId"));
  const requirementLineItemId = Number(formData.get("requirementLineItemId"));
  const oemId = Number(formData.get("oemId"));
  const responseType = String(formData.get("responseType") ?? "firm_commitment");

  const firmQuantity = Math.max(0, Math.round(Number(formData.get("firmQuantity") ?? 0)));
  const availableRaw = formData.get("availableQuantity");
  const availableQuantity =
    availableRaw === null || availableRaw === "" ? null : Math.max(0, Math.round(Number(availableRaw)));
  const priceRaw = String(formData.get("unitPrice") ?? "");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.oemResponses)
      .values({
        oemRequestId,
        oemId,
        requirementId,
        requirementLineItemId,
        responseType: responseType as any,
        responseDate: String(formData.get("responseDate") ?? "") || new Date().toISOString().slice(0, 10),
        firmQuantity: responseType === "firm_commitment" ? firmQuantity : 0,
        availableQuantity,
        unitPrice: priceRaw ? toMinor(priceRaw) : null,
        leadTimeDays: formData.get("leadTimeDays") ? Number(formData.get("leadTimeDays")) : null,
        validUntil: String(formData.get("validUntil") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.oemResponses.id });

    await tx
      .update(t.oemRequests)
      .set({ status: "responded" })
      .where(eq(t.oemRequests.id, oemRequestId));

    await writeAudit(tx, {
      entityType: "oem_response",
      entityId: row.id,
      action: "oem.response_recorded",
      actor: { userId: user.id, role: user.role },
      after: {
        responseType,
        firmQuantity: responseType === "firm_commitment" ? firmQuantity : 0,
        availableQuantity,
      },
      reason: responseType === "firm_commitment" ? "Firm quantity counts toward coverage." : "Indication only — excluded from coverage.",
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
}

export async function requestCoverageOverrideAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sourcing:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("A reason is required to override uncovered quantity.");

  const autoApprove = can(user.role, "coverage:override");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.approvalRequests)
      .values({
        entityType: "coverage_override",
        entityId: requirementId,
        requirementId,
        status: autoApprove ? "approved" : "pending",
        requestedBy: user.id,
        decidedBy: autoApprove ? user.id : null,
        decidedAt: autoApprove ? new Date() : null,
        comment: reason,
        payload: { reason, overriddenBy: user.role },
      })
      .returning({ id: t.approvalRequests.id });
    await writeAudit(tx, {
      entityType: "approval_request",
      entityId: row.id,
      action: autoApprove ? "coverage.override_approved" : "coverage.override_requested",
      actor: { userId: user.id, role: user.role },
      after: { requirementId, reason },
      reason,
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/admin");
}
