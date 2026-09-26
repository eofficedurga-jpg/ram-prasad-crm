"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { hashPassword, requirePermission, requireUser } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { can, type Permission, type Role } from "@/lib/permissions";

function permissionFor(entityType: string): Permission {
  if (entityType === "quote") return "quotes:approve";
  if (entityType === "document" || entityType === "compliance_item") return "documents:approve";
  if (entityType === "coverage_override") return "coverage:override";
  if (entityType === "order") return "orders:write";
  return "audit:view";
}

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDbAsync();
  const approvalId = Number(formData.get("approvalId"));
  const decision = String(formData.get("decision"));
  const comment = String(formData.get("comment") ?? "") || null;

  const [approval] = await db
    .select()
    .from(t.approvalRequests)
    .where(eq(t.approvalRequests.id, approvalId))
    .limit(1);
  if (!approval) throw new Error("Approval request not found.");
  if (!can(user.role, permissionFor(approval.entityType))) {
    throw new Error(`Your role (${user.role}) cannot decide ${approval.entityType} approvals.`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(t.approvalRequests)
      .set({
        status: decision === "approve" ? "approved" : "rejected",
        decidedBy: user.id,
        decidedAt: new Date(),
        comment,
      })
      .where(eq(t.approvalRequests.id, approvalId));

    if (approval.entityType === "quote") {
      await tx
        .update(t.quotes)
        .set({
          status: decision === "approve" ? "approved" : "rejected",
          approvedBy: decision === "approve" ? user.id : null,
          approvedAt: decision === "approve" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(t.quotes.id, approval.entityId));
    }
    if (approval.entityType === "document" || approval.entityType === "compliance_item") {
      await tx
        .update(t.documents)
        .set({ status: decision === "approve" ? "valid" : "pending" })
        .where(eq(t.documents.id, approval.entityId));
    }

    await writeAudit(tx, {
      entityType: "approval_request",
      entityId: approvalId,
      action: `approval.${decision === "approve" ? "approved" : "rejected"}`,
      actor: { userId: user.id, role: user.role },
      before: { status: approval.status },
      after: { status: decision === "approve" ? "approved" : "rejected", comment },
      reason: comment,
    });
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createUserAction(formData: FormData): Promise<void> {
  const admin = await requirePermission("users:manage");
  const db = await getDbAsync();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "sales");
  if (!email || !name || !password) throw new Error("Name, email and password are required.");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.users)
      .values({ email, name, role: role as any, passwordHash: hashPassword(password) })
      .returning({ id: t.users.id });
    await writeAudit(tx, {
      entityType: "user",
      entityId: row.id,
      action: "user.created",
      actor: { userId: admin.id, role: admin.role },
      after: { email, name, role },
    });
  });
  revalidatePath("/admin");
}

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const admin = await requirePermission("users:manage");
  const db = await getDbAsync();
  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role")) as Role;
  const active = String(formData.get("active") ?? "true") === "true";
  const [current] = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  if (!current) throw new Error("User not found.");
  await db.transaction(async (tx) => {
    await tx.update(t.users).set({ role: role as any, active }).where(eq(t.users.id, userId));
    await writeAudit(tx, {
      entityType: "user",
      entityId: userId,
      action: "user.role_changed",
      actor: { userId: admin.id, role: admin.role },
      before: { role: current.role, active: current.active },
      after: { role, active },
    });
  });
  revalidatePath("/admin");
}
