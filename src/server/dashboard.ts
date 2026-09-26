import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { computeDeliveryRisk, type RiskLevel } from "@/domain/risk";
import { LOSS_REASON_LABELS, ORDER_STATUS_LABELS, REQUIREMENT_STATUS_LABELS } from "@/lib/enums";

export type OrderFact = {
  id: number;
  orderNo: string;
  status: string;
  poNumber: string;
  customer: string | null;
  deliveryDeadline: string | null;
  expectedCompletionDate: string | null;
  totalValue: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  acceptedQuantity: number;
  risk: RiskLevel;
  riskReason: string;
  ownerUserId: number | null;
};

export type InvoiceFact = {
  id: number;
  invoiceNo: string;
  orderId: number;
  orderNo: string | null;
  invoiceType: string;
  dueDate: string | null;
  total: number;
  paid: number;
  balance: number;
  status: string;
};

export type DocumentFact = {
  id: number;
  title: string;
  docType: string;
  source: string;
  status: string;
  expiryDate: string | null;
  daysToExpiry: number | null;
  oemId: number | null;
  requirementId: number | null;
  orderId: number | null;
  ownerUserId: number | null;
};

export type DashboardFacts = {
  generatedAt: Date;
  monthLabel: string;
  orders: OrderFact[];
  ordersByState: { state: string; label: string; count: number }[];
  invoices: InvoiceFact[];
  documents: DocumentFact[];
  oemPending: {
    id: number;
    requirementId: number;
    requirementRef: string;
    oemName: string;
    oemId: number;
    sentAt: Date;
    dueBy: string | null;
    ownerUserId: number | null;
  }[];
  requirementsByStatus: { status: string; label: string; count: number }[];
  requirementTotal: number;
  requirementOpen: number;
  wonThisMonth: number;
  lostThisMonth: number;
  losses: {
    totalAllTime: number;
    thisMonth: number;
    byReason: { code: string; label: string; count: number; value: number }[];
    recent: { ref: string; title: string; reason: string; notes: string | null; competitor: string | null; quoted: number | null; winning: number | null }[];
  };
  quotesAwaitingResponse: {
    id: number;
    quoteNo: string;
    requirementId: number;
    requirementRef: string;
    submittedAt: Date | null;
    ageDays: number | null;
  }[];
  pendingApprovals: number;
  openFollowUps: number;
  receivableOutstanding: number;
  payableOutstanding: number;
  overdueInvoices: number;
  coverageGaps: {
    requirementId: number;
    ref: string;
    title: string;
    uncovered: number;
    required: number;
  }[];
};

function monthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toDate(v: string | Date | null): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getDashboardFacts(): Promise<DashboardFacts> {
  const db = await getDbAsync();
  const now = new Date();
  const mStart = monthStart(now);

  const orderRows = await db
    .select({
      id: t.orders.id,
      orderNo: t.orders.orderNo,
      status: t.orders.status,
      poNumber: t.orders.poNumber,
      customer: t.customers.name,
      deliveryDeadline: t.orders.deliveryDeadline,
      expectedCompletionDate: t.orders.expectedCompletionDate,
      totalValue: t.orders.totalValue,
      ownerUserId: t.orders.createdBy,
    })
    .from(t.orders)
    .leftJoin(t.customers, eq(t.customers.id, t.orders.customerId))
    .orderBy(desc(t.orders.createdAt));

  const orderIds = orderRows.map((o) => o.id);
  const orderLines = orderIds.length
    ? await db
        .select({
          orderId: t.orderLineItems.orderId,
          quantity: t.orderLineItems.quantity,
        })
        .from(t.orderLineItems)
        .where(inArray(t.orderLineItems.orderId, orderIds))
    : [];
  const deliveries = orderIds.length
    ? await db
        .select({
          orderId: t.deliveryEvents.orderId,
          quantity: t.deliveryEvents.quantity,
          status: t.deliveryEvents.status,
        })
        .from(t.deliveryEvents)
        .where(inArray(t.deliveryEvents.orderId, orderIds))
    : [];

  const orderedByOrder = new Map<number, number>();
  for (const l of orderLines) {
    orderedByOrder.set(l.orderId, (orderedByOrder.get(l.orderId) ?? 0) + l.quantity);
  }
  const deliveredByOrder = new Map<number, number>();
  const acceptedByOrder = new Map<number, number>();
  for (const d of deliveries) {
    deliveredByOrder.set(d.orderId, (deliveredByOrder.get(d.orderId) ?? 0) + d.quantity);
    if (d.status === "accepted") {
      acceptedByOrder.set(d.orderId, (acceptedByOrder.get(d.orderId) ?? 0) + d.quantity);
    }
  }

  const orders: OrderFact[] = orderRows.map((o) => {
    const ordered = orderedByOrder.get(o.id) ?? 0;
    const accepted = acceptedByOrder.get(o.id) ?? 0;
    const risk = computeDeliveryRisk({
      deadline: o.deliveryDeadline,
      expectedCompletion: o.expectedCompletionDate,
      today: now,
      orderedQuantity: ordered,
      acceptedQuantity: accepted,
      completed: o.status === "completed" || o.status === "delivered",
    });
    return {
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      poNumber: o.poNumber,
      customer: o.customer ?? null,
      deliveryDeadline: o.deliveryDeadline,
      expectedCompletionDate: o.expectedCompletionDate,
      totalValue: o.totalValue,
      orderedQuantity: ordered,
      deliveredQuantity: deliveredByOrder.get(o.id) ?? 0,
      acceptedQuantity: accepted,
      risk: risk.level,
      riskReason: risk.reason,
      ownerUserId: o.ownerUserId ?? null,
    };
  });

  const orderStateCounts = new Map<string, number>();
  for (const o of orders) orderStateCounts.set(o.status, (orderStateCounts.get(o.status) ?? 0) + 1);

  // Invoices + paid amounts
  const invoiceRows = await db
    .select({
      id: t.invoices.id,
      invoiceNo: t.invoices.invoiceNo,
      orderId: t.invoices.orderId,
      orderNo: t.orders.orderNo,
      invoiceType: t.invoices.invoiceType,
      dueDate: t.invoices.dueDate,
      total: t.invoices.total,
      status: t.invoices.status,
    })
    .from(t.invoices)
    .leftJoin(t.orders, eq(t.orders.id, t.invoices.orderId))
    .orderBy(desc(t.invoices.createdAt));

  const paidRows = await db
    .select({
      invoiceId: t.payments.invoiceId,
      amount: t.payments.amount,
      status: t.payments.status,
      direction: t.payments.direction,
    })
    .from(t.payments);

  const paidByInvoice = new Map<number, number>();
  let receivableOutstanding = 0;
  let payableOutstanding = 0;
  for (const p of paidRows) {
    if (!p.invoiceId) continue;
    if (p.status === "paid" || p.status === "partially_paid") {
      paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + p.amount);
    }
  }

  const invoices: InvoiceFact[] = invoiceRows.map((i) => {
    const paid = paidByInvoice.get(i.id) ?? 0;
    const balance = Math.max(0, i.total - paid);
    if (i.invoiceType === "customer_tax_invoice") receivableOutstanding += balance;
    else payableOutstanding += balance;
    return {
      id: i.id,
      invoiceNo: i.invoiceNo,
      orderId: i.orderId,
      orderNo: i.orderNo ?? null,
      invoiceType: i.invoiceType,
      dueDate: i.dueDate,
      total: i.total,
      paid,
      balance,
      status: i.status,
    };
  });

  const overdueInvoices = invoices.filter(
    (i) => i.balance > 0 && i.dueDate && new Date(i.dueDate) < now,
  ).length;

  // Documents + expiry
  const docRows = await db.select().from(t.documents).orderBy(desc(t.documents.createdAt));
  const documents: DocumentFact[] = docRows.map((d) => {
    const expiry = toDate(d.expiryDate);
    const daysToExpiry = expiry
      ? Math.round((expiry.getTime() - now.getTime()) / 86_400_000)
      : null;
    return {
      id: d.id,
      title: d.title,
      docType: d.docType,
      source: d.source,
      status: d.status,
      expiryDate: d.expiryDate,
      daysToExpiry,
      oemId: d.oemId,
      requirementId: d.requirementId,
      orderId: d.orderId,
      ownerUserId: d.uploadedBy,
    };
  });

  // OEM requests awaiting a response
  const pendingReqRows = await db
    .select({
      id: t.oemRequests.id,
      requirementId: t.oemRequests.requirementId,
      requirementRef: t.requirements.ref,
      oemId: t.oemRequests.oemId,
      oemName: t.oems.name,
      sentAt: t.oemRequests.sentAt,
      dueBy: t.oemRequests.dueBy,
      createdBy: t.oemRequests.createdBy,
    })
    .from(t.oemRequests)
    .leftJoin(t.requirements, eq(t.requirements.id, t.oemRequests.requirementId))
    .leftJoin(t.oems, eq(t.oems.id, t.oemRequests.oemId))
    .where(eq(t.oemRequests.status, "sent"));
  const oemPending = pendingReqRows.map((r) => ({
    id: r.id,
    requirementId: r.requirementId,
    requirementRef: r.requirementRef ?? "—",
    oemName: r.oemName ?? "—",
    oemId: r.oemId,
    sentAt: r.sentAt ?? now,
    dueBy: r.dueBy,
    ownerUserId: r.createdBy ?? null,
  }));

  // Requirements by status
  const reqRows = await db
    .select({
      id: t.requirements.id,
      ref: t.requirements.ref,
      title: t.requirements.title,
      status: t.requirements.status,
      submissionDeadline: t.requirements.submissionDeadline,
      ownerUserId: t.requirements.ownerUserId,
    })
    .from(t.requirements);
  const reqStatusCounts = new Map<string, number>();
  for (const r of reqRows) reqStatusCounts.set(r.status, (reqStatusCounts.get(r.status) ?? 0) + 1);

  // Wins this month: requirement status events / government responses this month.
  const wonEventsThisMonth = await db
    .select({ requirementId: t.requirementStatusEvents.requirementId })
    .from(t.requirementStatusEvents)
    .where(
      and(
        eq(t.requirementStatusEvents.toStatus, "won"),
        gte(t.requirementStatusEvents.createdAt, mStart),
      ),
    );
  const wonResponsesThisMonth = await db
    .select({ requirementId: t.governmentResponses.requirementId })
    .from(t.governmentResponses)
    .where(
      and(
        eq(t.governmentResponses.status, "won"),
        gte(t.governmentResponses.createdAt, mStart),
      ),
    );
  const wonSet = new Set<number>([
    ...wonEventsThisMonth.map((e) => e.requirementId),
    ...wonResponsesThisMonth.map((e) => e.requirementId),
  ]);

  // Losses
  const lossRows = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.status, "lost"))
    .orderBy(desc(t.requirements.updatedAt));
  const reasonMap = new Map<string, { count: number; value: number }>();
  let lostThisMonth = 0;
  for (const l of lossRows) {
    const code = l.lossReasonCode ?? "other";
    const agg = reasonMap.get(code) ?? { count: 0, value: 0 };
    agg.count += 1;
    agg.value += l.lossQuotedPrice ?? 0;
    reasonMap.set(code, agg);
    if (l.updatedAt >= mStart) lostThisMonth += 1;
  }
  const losses = {
    totalAllTime: lossRows.length,
    thisMonth: lostThisMonth,
    byReason: [...reasonMap.entries()]
      .map(([code, v]) => ({
        code,
        label: LOSS_REASON_LABELS[code] ?? code,
        count: v.count,
        value: v.value,
      }))
      .sort((a, b) => b.count - a.count),
    recent: lossRows.slice(0, 10).map((l) => ({
      ref: l.ref,
      title: l.title,
      reason: LOSS_REASON_LABELS[l.lossReasonCode ?? "other"] ?? "—",
      notes: l.lossReasonNotes,
      competitor: l.lossCompetitor,
      quoted: l.lossQuotedPrice,
      winning: l.lossWinningPrice,
    })),
  };

  // Quotes awaiting a response
  const awaitingRows = await db
    .select({
      id: t.quotes.id,
      quoteNo: t.quotes.quoteNo,
      requirementId: t.quotes.requirementId,
      requirementRef: t.requirements.ref,
      requirementStatus: t.requirements.status,
      submittedAt: t.quotes.submittedAt,
    })
    .from(t.quotes)
    .leftJoin(t.requirements, eq(t.requirements.id, t.quotes.requirementId))
    .where(inArray(t.quotes.status, ["approved"]))
    .orderBy(desc(t.quotes.submittedAt));
  const quotesAwaitingResponse = awaitingRows
    .filter((q) => q.requirementStatus === "submitted")
    .map((q) => ({
      id: q.id,
      quoteNo: q.quoteNo,
      requirementId: q.requirementId,
      requirementRef: q.requirementRef ?? "—",
      submittedAt: q.submittedAt,
      ageDays: q.submittedAt
        ? Math.round((now.getTime() - new Date(q.submittedAt).getTime()) / 86_400_000)
        : null,
    }));

  // Coverage gaps
  const lineAgg = await db
    .select({
      requirementId: t.requirementLineItems.requirementId,
      required: sql<number>`coalesce(sum(${t.requirementLineItems.quantity}), 0)`.as("required"),
    })
    .from(t.requirementLineItems)
    .groupBy(t.requirementLineItems.requirementId);
  const firmAgg = await db
    .select({
      requirementId: t.oemResponses.requirementId,
      committed: sql<number>`coalesce(sum(${t.oemResponses.firmQuantity}), 0)`.as("committed"),
    })
    .from(t.oemResponses)
    .where(eq(t.oemResponses.responseType, "firm_commitment"))
    .groupBy(t.oemResponses.requirementId);
  const committedByReq = new Map(firmAgg.map((f) => [f.requirementId, Number(f.committed)]));
  const openStatuses = ["received", "qualifying", "quoted", "submitted"];
  const reqById = new Map(reqRows.map((r) => [r.id, r]));
  const coverageGaps = lineAgg
    .map((l) => {
      const r = reqById.get(l.requirementId);
      const required = Number(l.required);
      const committed = committedByReq.get(l.requirementId) ?? 0;
      return {
        requirementId: l.requirementId,
        ref: r?.ref ?? "—",
        title: r?.title ?? "—",
        uncovered: Math.max(0, required - committed),
        required,
        status: r?.status ?? "received",
      };
    })
    .filter((g) => g.uncovered > 0 && openStatuses.includes(g.status))
    .sort((a, b) => b.uncovered - a.uncovered);

  const [pendingAppr] = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(t.approvalRequests)
    .where(eq(t.approvalRequests.status, "pending"));
  const [openTasks] = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(t.followUpTasks)
    .where(eq(t.followUpTasks.status, "open"));

  return {
    generatedAt: now,
    monthLabel: now.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    orders,
    ordersByState: [...orderStateCounts.entries()].map(([state, count]) => ({
      state,
      label: ORDER_STATUS_LABELS[state] ?? state,
      count,
    })),
    invoices,
    documents,
    oemPending,
    requirementsByStatus: [...reqStatusCounts.entries()].map(([status, count]) => ({
      status,
      label: REQUIREMENT_STATUS_LABELS[status] ?? status,
      count,
    })),
    requirementTotal: reqRows.length,
    requirementOpen: reqRows.filter((r) => openStatuses.includes(r.status)).length,
    wonThisMonth: wonSet.size,
    lostThisMonth,
    losses,
    quotesAwaitingResponse,
    pendingApprovals: Number(pendingAppr?.count ?? 0),
    openFollowUps: Number(openTasks?.count ?? 0),
    receivableOutstanding,
    payableOutstanding,
    overdueInvoices,
    coverageGaps,
  };
}
