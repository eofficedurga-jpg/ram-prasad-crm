"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { toMinor } from "@/lib/format";

async function recomputeInvoiceStatus(tx: any, invoiceId: number): Promise<void> {
  const [invoice] = await tx.select().from(t.invoices).where(eq(t.invoices.id, invoiceId)).limit(1);
  if (!invoice) return;
  const payments = await tx.select().from(t.payments).where(eq(t.payments.invoiceId, invoiceId));
  const paid = payments
    .filter((p: any) => p.status === "paid" || p.status === "partially_paid")
    .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  let status: string = invoice.status;
  if (paid >= invoice.total && invoice.total > 0) status = "paid";
  else if (paid > 0) status = "partially_paid";
  else status = invoice.status === "draft" ? "draft" : "issued";
  if (invoice.dueDate && new Date(invoice.dueDate) < new Date() && status !== "paid") {
    status = "overdue";
  }
  await tx.update(t.invoices).set({ status: status as any }).where(eq(t.invoices.id, invoiceId));
}

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const user = await requirePermission("finance:write");
  const db = await getDbAsync();
  const invoiceRaw = String(formData.get("invoiceId") ?? "");
  const invoiceId = invoiceRaw ? Number(invoiceRaw) : null;
  const orderRaw = String(formData.get("orderId") ?? "");
  const orderId = orderRaw ? Number(orderRaw) : null;
  const direction = String(formData.get("direction") ?? "receivable_from_customer");
  const amount = toMinor(String(formData.get("amount") ?? "0"));
  const status = String(formData.get("status") ?? "paid");

  await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(t.payments)
      .values({
        invoiceId,
        orderId,
        direction: direction as any,
        amount,
        paidAt: String(formData.get("paidAt") ?? "") || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        status: status as any,
        reference: String(formData.get("reference") ?? "") || null,
        method: String(formData.get("method") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.payments.id });

    if (invoiceId) await recomputeInvoiceStatus(tx, invoiceId);

    // Commission milestone: commission is earned when an OEM payment is marked paid.
    if (direction === "payable_to_oem" && status === "paid" && orderId) {
      const pending = await tx
        .select()
        .from(t.commissionEntries)
        .where(
          and(eq(t.commissionEntries.orderId, orderId), eq(t.commissionEntries.status, "pending")),
        );
      for (const c of pending) {
        await tx
          .update(t.commissionEntries)
          .set({ status: "earned", earnedAt: new Date(), oemPaymentId: payment.id })
          .where(eq(t.commissionEntries.id, c.id));
        await writeAudit(tx, {
          entityType: "commission_entry",
          entityId: c.id,
          action: "commission.earned_on_oem_payment",
          actor: { userId: user.id, role: user.role },
          before: { status: "pending" },
          after: { status: "earned", oemPaymentId: payment.id },
          reason: "OEM-payment milestone reached.",
        });
      }
    }

    await writeAudit(tx, {
      entityType: "payment",
      entityId: payment.id,
      action: "payment.recorded",
      actor: { userId: user.id, role: user.role },
      after: { direction, amount, status, invoiceId, orderId },
    });
  });

  revalidatePath("/finance");
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
}

export async function createCommissionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("finance:write");
  const db = await getDbAsync();
  const orderId = Number(formData.get("orderId"));
  const oemRaw = String(formData.get("oemId") ?? "");
  const baseAmount = toMinor(String(formData.get("baseAmount") ?? "0"));
  const ratePercent = Number(formData.get("ratePercent") ?? 0);
  const amount = Math.round((baseAmount * ratePercent) / 100);

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.commissionEntries)
      .values({
        orderId,
        oemId: oemRaw ? Number(oemRaw) : null,
        milestone: String(formData.get("milestone") ?? "oem_payment_paid"),
        baseAmount,
        ratePercent: String(ratePercent),
        amount,
        status: "pending",
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.commissionEntries.id });
    await writeAudit(tx, {
      entityType: "commission_entry",
      entityId: row.id,
      action: "commission.created",
      actor: { userId: user.id, role: user.role },
      after: { orderId, baseAmount, ratePercent, amount, milestone: "oem_payment_paid" },
    });
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/finance");
}

export async function updateCommissionStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("finance:write");
  const db = await getDbAsync();
  const id = Number(formData.get("commissionId"));
  const status = String(formData.get("status"));
  const [current] = await db
    .select()
    .from(t.commissionEntries)
    .where(eq(t.commissionEntries.id, id))
    .limit(1);
  if (!current) throw new Error("Commission entry not found.");
  await db.transaction(async (tx) => {
    await tx
      .update(t.commissionEntries)
      .set({ status: status as any, earnedAt: status === "earned" && !current.earnedAt ? new Date() : current.earnedAt })
      .where(eq(t.commissionEntries.id, id));
    await writeAudit(tx, {
      entityType: "commission_entry",
      entityId: id,
      action: "commission.status_changed",
      actor: { userId: user.id, role: user.role },
      before: { status: current.status },
      after: { status },
    });
  });
  revalidatePath("/finance");
}
