import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { computeDeliveryRisk, type RiskLevel } from "@/domain/risk";
import { pdiTotals } from "@/domain/pdi";

export async function listOrders() {
  const db = await getDbAsync();
  const rows = await db
    .select({
      id: t.orders.id,
      orderNo: t.orders.orderNo,
      status: t.orders.status,
      poNumber: t.orders.poNumber,
      poDate: t.orders.poDate,
      totalValue: t.orders.totalValue,
      deliveryDeadline: t.orders.deliveryDeadline,
      expectedCompletionDate: t.orders.expectedCompletionDate,
      customer: t.customers.name,
      requirementId: t.orders.requirementId,
      requirementRef: t.requirements.ref,
      quoteId: t.orders.quoteId,
    })
    .from(t.orders)
    .leftJoin(t.customers, eq(t.customers.id, t.orders.customerId))
    .leftJoin(t.requirements, eq(t.requirements.id, t.orders.requirementId))
    .orderBy(desc(t.orders.createdAt));

  const ids = rows.map((r) => r.id);
  const lines = ids.length
    ? await db
        .select({ orderId: t.orderLineItems.orderId, quantity: t.orderLineItems.quantity })
        .from(t.orderLineItems)
        .where(inArray(t.orderLineItems.orderId, ids))
    : [];
  const deliveries = ids.length
    ? await db
        .select({ orderId: t.deliveryEvents.orderId, quantity: t.deliveryEvents.quantity, status: t.deliveryEvents.status })
        .from(t.deliveryEvents)
        .where(inArray(t.deliveryEvents.orderId, ids))
    : [];

  const ordered = new Map<number, number>();
  for (const l of lines) ordered.set(l.orderId, (ordered.get(l.orderId) ?? 0) + l.quantity);
  const accepted = new Map<number, number>();
  for (const d of deliveries) {
    if (d.status === "accepted") accepted.set(d.orderId, (accepted.get(d.orderId) ?? 0) + d.quantity);
  }

  const now = new Date();
  return rows.map((r) => {
    const risk = computeDeliveryRisk({
      deadline: r.deliveryDeadline,
      expectedCompletion: r.expectedCompletionDate,
      today: now,
      orderedQuantity: ordered.get(r.id) ?? 0,
      acceptedQuantity: accepted.get(r.id) ?? 0,
      completed: r.status === "completed" || r.status === "delivered",
    });
    return { ...r, risk: risk.level as RiskLevel, riskReason: risk.reason, orderedQuantity: ordered.get(r.id) ?? 0 };
  });
}

export async function getOrderDetail(id: number) {
  const db = await getDbAsync();
  const [row] = await db
    .select({
      order: t.orders,
      customerName: t.customers.name,
      requirementRef: t.requirements.ref,
      requirementTitle: t.requirements.title,
    })
    .from(t.orders)
    .leftJoin(t.customers, eq(t.customers.id, t.orders.customerId))
    .leftJoin(t.requirements, eq(t.requirements.id, t.orders.requirementId))
    .where(eq(t.orders.id, id))
    .limit(1);
  if (!row) return null;
  const order = row.order;

  const [orderLines, quote, fulfilment, pdi, deliveries, invoices, payments, commission, documents, audits, users] =
    await Promise.all([
      db.select().from(t.orderLineItems).where(eq(t.orderLineItems.orderId, id)),
      db.select().from(t.quotes).where(eq(t.quotes.id, order.quoteId)).limit(1),
      db
        .select()
        .from(t.fulfilmentEvents)
        .where(eq(t.fulfilmentEvents.orderId, id))
        .orderBy(asc(t.fulfilmentEvents.createdAt)),
      db.select().from(t.pdiRecords).where(eq(t.pdiRecords.orderId, id)).orderBy(desc(t.pdiRecords.createdAt)),
      db.select().from(t.deliveryEvents).where(eq(t.deliveryEvents.orderId, id)).orderBy(desc(t.deliveryEvents.createdAt)),
      db.select().from(t.invoices).where(eq(t.invoices.orderId, id)).orderBy(desc(t.invoices.createdAt)),
      db.select().from(t.payments).where(eq(t.payments.orderId, id)).orderBy(desc(t.payments.createdAt)),
      db.select().from(t.commissionEntries).where(eq(t.commissionEntries.orderId, id)),
      db.select().from(t.documents).where(eq(t.documents.orderId, id)),
      db.select().from(t.auditLogs).where(eq(t.auditLogs.entityId, id)).orderBy(desc(t.auditLogs.createdAt)).limit(50),
      db.select({ id: t.users.id, name: t.users.name }).from(t.users),
    ]);

  const orderedQuantity = orderLines.reduce((s, l) => s + l.quantity, 0);
  const acceptedQuantity = deliveries
    .filter((d) => d.status === "accepted")
    .reduce((s, d) => s + d.quantity, 0);
  const risk = computeDeliveryRisk({
    deadline: order.deliveryDeadline,
    expectedCompletion: order.expectedCompletionDate,
    orderedQuantity,
    acceptedQuantity,
    completed: order.status === "completed" || order.status === "delivered",
  });
  const pdiSummary = pdiTotals(
    pdi.map((p) => ({
      id: p.id,
      status: p.status,
      quantityOffered: p.quantityOffered,
      quantityCleared: p.quantityCleared,
      quantityRejected: p.quantityRejected,
    })),
  );

  return {
    order,
    customerName: row.customerName ?? null,
    requirementRef: row.requirementRef ?? null,
    requirementTitle: row.requirementTitle ?? null,
    quote: quote[0] ?? null,
    orderLines,
    fulfilment,
    pdi,
    deliveries,
    invoices,
    payments,
    commission,
    documents,
    audits,
    users,
    risk,
    pdiSummary,
    orderedQuantity,
    acceptedQuantity,
  };
}
