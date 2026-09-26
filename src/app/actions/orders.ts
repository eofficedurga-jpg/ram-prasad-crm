"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { toMinor } from "@/lib/format";

export async function createOrderFromQuoteAction(formData: FormData): Promise<void> {
  const user = await requirePermission("orders:write");
  const db = await getDbAsync();
  const quoteId = Number(formData.get("quoteId"));

  const [quote] = await db.select().from(t.quotes).where(eq(t.quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error("Quote not found.");
  // Rule R2: no orphan PO — the source quote must be approved.
  if (quote.status !== "approved") {
    throw new Error("Only an approved quote can become an order (no orphan PO).");
  }

  const [existingOrder] = await db
    .select({ id: t.orders.id })
    .from(t.orders)
    .where(eq(t.orders.quoteId, quoteId))
    .limit(1);
  if (existingOrder) throw new Error("This quote already has an order.");

  const lines = await db.select().from(t.quoteLineItems).where(eq(t.quoteLineItems.quoteId, quoteId));
  const [requirement] = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.id, quote.requirementId))
    .limit(1);

  const orderNo = String(formData.get("orderNo") ?? "").trim();
  if (!orderNo) throw new Error("Order number is required.");
  const poNumber = String(formData.get("poNumber") ?? "").trim();
  if (!poNumber) throw new Error("Customer PO number is required.");
  const poDate = String(formData.get("poDate") ?? "") || new Date().toISOString().slice(0, 10);
  const oemIdRaw = String(formData.get("oemId") ?? "");
  const oemId = oemIdRaw ? Number(oemIdRaw) : null;

  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(t.orders)
      .values({
        orderNo,
        quoteId,
        requirementId: quote.requirementId,
        customerId: requirement?.customerId ?? null,
        poNumber,
        poDate,
        status: "open",
        totalValue: quote.totalFinalPrice,
        deliveryDeadline: String(formData.get("deliveryDeadline") ?? "") || requirement?.requiredDeliveryDate || null,
        expectedCompletionDate: String(formData.get("expectedCompletionDate") ?? "") || null,
        oemId,
        supplierPoNumber: String(formData.get("supplierPoNumber") ?? "") || null,
        supplierPoDate: String(formData.get("supplierPoDate") ?? "") || null,
        complianceRequirements: String(formData.get("complianceRequirements") ?? "") || null,
        inspectionRequirements: String(formData.get("inspectionRequirements") ?? "") || null,
        pdiRequirements: String(formData.get("pdiRequirements") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.orders.id });

    for (const l of lines) {
      await tx.insert(t.orderLineItems).values({
        orderId: order.id,
        quoteLineItemId: l.id,
        requirementLineItemId: l.requirementLineItemId,
        partNumber: l.description ?? `Line ${l.requirementLineItemId}`,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.finalUnitPrice,
        oemId: l.oemId,
      });
    }

    // Seed the standard fulfilment timeline with owner + expected dates.
    const timeline: { stage: string; state: string }[] = [
      { stage: "oem_po_placed", state: "pending" },
      { stage: "production_started", state: "pending" },
      { stage: "production_done", state: "pending" },
      { stage: "pdi_scheduled", state: "pending" },
      { stage: "pdi_passed", state: "pending" },
      { stage: "government_inspection", state: "pending" },
      { stage: "dispatched", state: "pending" },
      { stage: "delivered", state: "pending" },
      { stage: "accepted", state: "pending" },
    ];
    for (const s of timeline) {
      await tx.insert(t.fulfilmentEvents).values({
        orderId: order.id,
        stage: s.stage as any,
        state: s.state as any,
        ownerUserId: user.id,
        expectedDate: String(formData.get("deliveryDeadline") ?? "") || requirement?.requiredDeliveryDate || null,
        createdBy: user.id,
      });
    }

    await tx
      .update(t.requirements)
      .set({ status: "won", updatedAt: new Date() })
      .where(eq(t.requirements.id, quote.requirementId));

    await writeAudit(tx, {
      entityType: "order",
      entityId: order.id,
      action: "order.created_from_quote",
      actor: { userId: user.id, role: user.role },
      after: { orderNo, quoteId, poNumber, totalValue: quote.totalFinalPrice },
      reason: `Approved quote ${quote.quoteNo} converted to PO.`,
    });
    return order.id;
  });

  revalidatePath("/orders");
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/requirements/${quote.requirementId}`);
  redirect(`/orders/${orderId}`);
}

export async function updateOrderAction(formData: FormData): Promise<void> {
  const user = await requirePermission("orders:write");
  const db = await getDbAsync();
  const orderId = Number(formData.get("orderId"));
  const [current] = await db.select().from(t.orders).where(eq(t.orders.id, orderId)).limit(1);
  if (!current) throw new Error("Order not found.");
  const patch = {
    status: String(formData.get("status") ?? current.status) as any,
    deliveryDeadline: String(formData.get("deliveryDeadline") ?? "") || null,
    expectedCompletionDate: String(formData.get("expectedCompletionDate") ?? "") || null,
    supplierPoNumber: String(formData.get("supplierPoNumber") ?? "") || null,
    supplierPoDate: String(formData.get("supplierPoDate") ?? "") || null,
    complianceRequirements: String(formData.get("complianceRequirements") ?? "") || null,
    inspectionRequirements: String(formData.get("inspectionRequirements") ?? "") || null,
    pdiRequirements: String(formData.get("pdiRequirements") ?? "") || null,
  };
  await db.transaction(async (tx) => {
    await tx.update(t.orders).set({ ...patch, updatedAt: new Date() }).where(eq(t.orders.id, orderId));
    await writeAudit(tx, {
      entityType: "order",
      entityId: orderId,
      action: "order.updated",
      actor: { userId: user.id, role: user.role },
      before: { status: current.status, expectedCompletionDate: current.expectedCompletionDate },
      after: patch,
    });
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function recordFulfilmentEventAction(formData: FormData): Promise<void> {
  const user = await requirePermission("fulfilment:write");
  const db = await getDbAsync();
  const orderId = Number(formData.get("orderId"));
  const stage = String(formData.get("stage"));
  const state = String(formData.get("state") ?? "in_progress");
  const ownerRaw = String(formData.get("ownerUserId") ?? "");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.fulfilmentEvents)
      .values({
        orderId,
        stage: stage as any,
        state: state as any,
        ownerUserId: ownerRaw ? Number(ownerRaw) : user.id,
        expectedDate: String(formData.get("expectedDate") ?? "") || null,
        actualDate: String(formData.get("actualDate") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.fulfilmentEvents.id });
    await writeAudit(tx, {
      entityType: "fulfilment_event",
      entityId: row.id,
      action: "fulfilment.recorded",
      actor: { userId: user.id, role: user.role },
      after: { orderId, stage, state },
    });
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
}

export async function createPdiAction(formData: FormData): Promise<void> {
  const user = await requirePermission("pdi:write");
  const db = await getDbAsync();
  const orderId = Number(formData.get("orderId"));
  const offered = Math.max(0, Math.round(Number(formData.get("quantityOffered") ?? 0)));
  const cleared = Math.max(0, Math.round(Number(formData.get("quantityCleared") ?? 0)));
  const rejected = Math.max(0, Math.round(Number(formData.get("quantityRejected") ?? 0)));
  if (cleared + rejected > offered) {
    throw new Error("Cleared + rejected cannot exceed the quantity offered.");
  }
  const status = String(formData.get("status") ?? "scheduled");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.pdiRecords)
      .values({
        orderId,
        pdiRef: String(formData.get("pdiRef") ?? `PDI-${orderId}-${Date.now()}`),
        status: status as any,
        scheduledDate: String(formData.get("scheduledDate") ?? "") || null,
        completedDate: String(formData.get("completedDate") ?? "") || null,
        quantityOffered: offered,
        quantityCleared: cleared,
        quantityRejected: rejected,
        inspector: String(formData.get("inspector") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
      })
      .returning({ id: t.pdiRecords.id });
    await writeAudit(tx, {
      entityType: "pdi_record",
      entityId: row.id,
      action: status === "failed" ? "pdi.failed" : status === "passed" ? "pdi.passed" : "pdi.recorded",
      actor: { userId: user.id, role: user.role },
      after: { orderId, offered, cleared, rejected, status },
      reason: status === "failed" || status === "held" ? "Dispatch is blocked until this is resolved." : null,
    });
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
}

export async function recordDeliveryAction(formData: FormData): Promise<void> {
  const user = await requirePermission("deliveries:write");
  const db = await getDbAsync();
  const orderId = Number(formData.get("orderId"));
  const invoiceRaw = String(formData.get("invoiceId") ?? "");
  const lineRaw = String(formData.get("orderLineItemId") ?? "");

  // A failed/held PDI blocks dispatch (Rule: PDI can block dispatch).
  const pdi = await db.select().from(t.pdiRecords).where(eq(t.pdiRecords.orderId, orderId));
  const blocking = pdi.filter((p) => p.status === "failed" || p.status === "held");
  const overrideRaw = String(formData.get("overrideReason") ?? "").trim();
  if (blocking.length > 0 && !overrideRaw) {
    throw new Error(
      `Dispatch blocked: ${blocking.map((p) => `PDI ${p.pdiRef} ${p.status}`).join(", ")}. Provide an override reason to proceed.`,
    );
  }

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.deliveryEvents)
      .values({
        orderId,
        orderLineItemId: lineRaw ? Number(lineRaw) : null,
        invoiceId: invoiceRaw ? Number(invoiceRaw) : null,
        stage: "delivered",
        status: String(formData.get("status") ?? "delivered") as any,
        quantity: Math.max(0, Math.round(Number(formData.get("quantity") ?? 0))),
        scheduledDate: String(formData.get("scheduledDate") ?? "") || null,
        actualDate: String(formData.get("actualDate") ?? "") || null,
        ownerUserId: user.id,
        receivedBy: String(formData.get("receivedBy") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
      })
      .returning({ id: t.deliveryEvents.id });
    await writeAudit(tx, {
      entityType: "delivery_event",
      entityId: row.id,
      action: overrideRaw ? "delivery.recorded_with_pdi_override" : "delivery.recorded",
      actor: { userId: user.id, role: user.role },
      after: { orderId, quantity: Number(formData.get("quantity") ?? 0), status: String(formData.get("status") ?? "delivered") },
      reason: overrideRaw || (blocking.length ? "PDI override" : null),
    });
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
}

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const user = await requirePermission("finance:write");
  const db = await getDbAsync();
  const orderId = Number(formData.get("orderId"));
  const amount = toMinor(String(formData.get("amount") ?? "0"));
  const tax = toMinor(String(formData.get("tax") ?? "0"));
  const invoiceNo = String(formData.get("invoiceNo") ?? "").trim();
  if (!invoiceNo) throw new Error("Invoice number is required.");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.invoices)
      .values({
        invoiceNo,
        orderId,
        invoiceType: String(formData.get("invoiceType") ?? "customer_tax_invoice") as any,
        invoiceDate: String(formData.get("invoiceDate") ?? "") || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        amount,
        tax,
        total: amount + tax,
        status: "issued",
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.invoices.id });
    await writeAudit(tx, {
      entityType: "invoice",
      entityId: row.id,
      action: "invoice.created",
      actor: { userId: user.id, role: user.role },
      after: { orderId, invoiceNo, total: amount + tax },
    });
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/finance");
}
