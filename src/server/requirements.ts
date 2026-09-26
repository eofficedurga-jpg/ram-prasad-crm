import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import {
  computeRequirementCoverage,
  type OemResponseSlice,
  type RequirementCoverage,
} from "@/domain/coverage";

export type RequirementListRow = {
  id: number;
  ref: string;
  title: string;
  status: string;
  priority: string;
  customer: string | null;
  customerId: number | null;
  productSummary: string | null;
  requiredDeliveryDate: string | null;
  submissionDeadline: Date | null;
  receivedAt: Date;
  lineCount: number;
  required: number;
  committed: number;
  uncovered: number;
  coveragePercent: number;
  ownerName: string | null;
  lossReasonCode: string | null;
  tenderRef: string | null;
  enquiryRef: string | null;
};

export async function listRequirements(): Promise<RequirementListRow[]> {
  const db = await getDbAsync();
  const reqs = await db
    .select({
      id: t.requirements.id,
      ref: t.requirements.ref,
      title: t.requirements.title,
      status: t.requirements.status,
      priority: t.requirements.priority,
      customer: t.customers.name,
      customerId: t.requirements.customerId,
      productSummary: t.requirements.productSummary,
      requiredDeliveryDate: t.requirements.requiredDeliveryDate,
      submissionDeadline: t.requirements.submissionDeadline,
      receivedAt: t.requirements.receivedAt,
      ownerUserId: t.requirements.ownerUserId,
      lossReasonCode: t.requirements.lossReasonCode,
      tenderRef: t.requirements.tenderRef,
      enquiryRef: t.requirements.enquiryRef,
    })
    .from(t.requirements)
    .leftJoin(t.customers, eq(t.customers.id, t.requirements.customerId))
    .orderBy(desc(t.requirements.receivedAt));

  const lines = await db
    .select({
      id: t.requirementLineItems.id,
      requirementId: t.requirementLineItems.requirementId,
      quantity: t.requirementLineItems.quantity,
    })
    .from(t.requirementLineItems);

  const firm = await db
    .select({
      requirementId: t.oemResponses.requirementId,
      requirementLineItemId: t.oemResponses.requirementLineItemId,
      firmQuantity: t.oemResponses.firmQuantity,
    })
    .from(t.oemResponses)
    .where(eq(t.oemResponses.responseType, "firm_commitment"));

  const users = await db.select({ id: t.users.id, name: t.users.name }).from(t.users);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const committedByLine = new Map<number, number>();
  for (const f of firm) {
    committedByLine.set(
      f.requirementLineItemId,
      (committedByLine.get(f.requirementLineItemId) ?? 0) + (f.firmQuantity ?? 0),
    );
  }

  const lineAgg = new Map<number, { count: number; required: number; committed: number }>();
  for (const l of lines) {
    const agg = lineAgg.get(l.requirementId) ?? { count: 0, required: 0, committed: 0 };
    agg.count += 1;
    agg.required += l.quantity;
    agg.committed += committedByLine.get(l.id) ?? 0;
    lineAgg.set(l.requirementId, agg);
  }

  return reqs.map((r) => {
    const agg = lineAgg.get(r.id) ?? { count: 0, required: 0, committed: 0 };
    const uncovered = Math.max(0, agg.required - agg.committed);
    return {
      id: r.id,
      ref: r.ref,
      title: r.title,
      status: r.status,
      priority: r.priority,
      customer: r.customer,
      customerId: r.customerId,
      productSummary: r.productSummary,
      requiredDeliveryDate: r.requiredDeliveryDate,
      submissionDeadline: r.submissionDeadline,
      receivedAt: r.receivedAt,
      lineCount: agg.count,
      required: agg.required,
      committed: agg.committed,
      uncovered,
      coveragePercent:
        agg.required > 0 ? Math.round((Math.min(agg.committed, agg.required) / agg.required) * 100) : 100,
      ownerName: r.ownerUserId ? userName.get(r.ownerUserId) ?? null : null,
      lossReasonCode: r.lossReasonCode,
      tenderRef: r.tenderRef,
      enquiryRef: r.enquiryRef,
    };
  });
}

export type SourcingRequestRow = {
  id: number;
  oemId: number;
  oemName: string;
  lineItemId: number;
  partNumber: string;
  status: string;
  method: string;
  sentAt: Date | null;
  dueBy: string | null;
  requestedQuantity: number;
  notes: string | null;
  responses: {
    id: number;
    responseType: string;
    responseDate: string | null;
    firmQuantity: number;
    availableQuantity: number | null;
    unitPrice: number | null;
    currency: string;
    leadTimeDays: number | null;
    notes: string | null;
  }[];
};

export async function getCoverageForRequirement(id: number): Promise<RequirementCoverage> {
  const db = await getDbAsync();
  const lines = await db
    .select({
      id: t.requirementLineItems.id,
      partNumber: t.requirementLineItems.partNumber,
      quantity: t.requirementLineItems.quantity,
    })
    .from(t.requirementLineItems)
    .where(eq(t.requirementLineItems.requirementId, id));
  const lineIds = lines.map((l) => l.id);
  const responses = lineIds.length
    ? await db
        .select()
        .from(t.oemResponses)
        .where(inArray(t.oemResponses.requirementLineItemId, lineIds))
    : [];
  const oems = await db.select({ id: t.oems.id, name: t.oems.name }).from(t.oems);
  const oemName = new Map(oems.map((o) => [o.id, o.name]));
  const byLine = new Map<number, OemResponseSlice[]>();
  for (const r of responses) {
    const arr = byLine.get(r.requirementLineItemId) ?? [];
    arr.push({
      oemId: r.oemId,
      oemName: oemName.get(r.oemId) ?? `OEM #${r.oemId}`,
      responseType: r.responseType,
      firmQuantity: r.firmQuantity,
      availableQuantity: r.availableQuantity,
    });
    byLine.set(r.requirementLineItemId, arr);
  }
  return computeRequirementCoverage(lines, byLine);
}

export async function hasApprovedCoverageOverride(requirementId: number): Promise<boolean> {
  const db = await getDbAsync();
  const rows = await db
    .select({ id: t.approvalRequests.id })
    .from(t.approvalRequests)
    .where(
      and(
        eq(t.approvalRequests.entityType, "coverage_override"),
        eq(t.approvalRequests.requirementId, requirementId),
        eq(t.approvalRequests.status, "approved"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export type RequirementDetail = {
  requirement: typeof t.requirements.$inferSelect;
  customerName: string | null;
  ownerName: string | null;
  lines: (typeof t.requirementLineItems.$inferSelect)[];
  coverage: RequirementCoverage;
  sourcing: SourcingRequestRow[];
  quotes: (typeof t.quotes.$inferSelect)[];
  governmentResponses: (typeof t.governmentResponses.$inferSelect)[];
  orders: (typeof t.orders.$inferSelect)[];
  documents: (typeof t.documents.$inferSelect)[];
  statusEvents: (typeof t.requirementStatusEvents.$inferSelect)[];
  approvals: (typeof t.approvalRequests.$inferSelect)[];
  followUps: (typeof t.followUpTasks.$inferSelect)[];
  audits: (typeof t.auditLogs.$inferSelect)[];
};

export async function getRequirementDetail(id: number): Promise<RequirementDetail | null> {
  const db = await getDbAsync();
  const [requirement] = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.id, id))
    .limit(1);
  if (!requirement) return null;

  const [customerRow] = requirement.customerId
    ? await db
        .select({ name: t.customers.name })
        .from(t.customers)
        .where(eq(t.customers.id, requirement.customerId))
        .limit(1)
    : [];
  const [ownerRow] = requirement.ownerUserId
    ? await db
        .select({ name: t.users.name })
        .from(t.users)
        .where(eq(t.users.id, requirement.ownerUserId))
        .limit(1)
    : [];

  const lines = await db
    .select()
    .from(t.requirementLineItems)
    .where(eq(t.requirementLineItems.requirementId, id))
    .orderBy(asc(t.requirementLineItems.lineNo));

  const lineIds = lines.map((l) => l.id);
  const responses = lineIds.length
    ? await db
        .select()
        .from(t.oemResponses)
        .where(inArray(t.oemResponses.requirementLineItemId, lineIds))
        .orderBy(desc(t.oemResponses.responseDate))
    : [];

  const oems = await db.select({ id: t.oems.id, name: t.oems.name }).from(t.oems);
  const oemName = new Map(oems.map((o) => [o.id, o.name]));

  const byLine = new Map<number, OemResponseSlice[]>();
  for (const r of responses) {
    const slice: OemResponseSlice = {
      oemId: r.oemId,
      oemName: oemName.get(r.oemId) ?? `OEM #${r.oemId}`,
      responseType: r.responseType,
      firmQuantity: r.firmQuantity,
      availableQuantity: r.availableQuantity,
    };
    const arr = byLine.get(r.requirementLineItemId) ?? [];
    arr.push(slice);
    byLine.set(r.requirementLineItemId, arr);
  }

  const coverage = computeRequirementCoverage(
    lines.map((l) => ({ id: l.id, partNumber: l.partNumber, quantity: l.quantity })),
    byLine,
  );

  const requests = await db
    .select({
      id: t.oemRequests.id,
      oemId: t.oemRequests.oemId,
      lineItemId: t.oemRequests.requirementLineItemId,
      status: t.oemRequests.status,
      method: t.oemRequests.method,
      sentAt: t.oemRequests.sentAt,
      dueBy: t.oemRequests.dueBy,
      requestedQuantity: t.oemRequests.requestedQuantity,
      notes: t.oemRequests.notes,
    })
    .from(t.oemRequests)
    .where(eq(t.oemRequests.requirementId, id))
    .orderBy(desc(t.oemRequests.createdAt));

  const partByLine = new Map(lines.map((l) => [l.id, l.partNumber]));
  const responsesByRequest = new Map<number, SourcingRequestRow["responses"]>();
  for (const r of responses) {
    const arr = responsesByRequest.get(r.oemRequestId) ?? [];
    arr.push({
      id: r.id,
      responseType: r.responseType,
      responseDate: r.responseDate,
      firmQuantity: r.firmQuantity,
      availableQuantity: r.availableQuantity,
      unitPrice: r.unitPrice,
      currency: r.currency,
      leadTimeDays: r.leadTimeDays,
      notes: r.notes,
    });
    responsesByRequest.set(r.oemRequestId, arr);
  }

  const sourcing: SourcingRequestRow[] = requests.map((r) => ({
    id: r.id,
    oemId: r.oemId,
    oemName: oemName.get(r.oemId) ?? `OEM #${r.oemId}`,
    lineItemId: r.lineItemId,
    partNumber: partByLine.get(r.lineItemId) ?? "—",
    status: r.status,
    method: r.method,
    sentAt: r.sentAt,
    dueBy: r.dueBy,
    requestedQuantity: r.requestedQuantity,
    notes: r.notes,
    responses: responsesByRequest.get(r.id) ?? [],
  }));

  const [quotes, governmentResponses, orders, documents, statusEvents, approvals, followUps, audits] =
    await Promise.all([
      db.select().from(t.quotes).where(eq(t.quotes.requirementId, id)).orderBy(desc(t.quotes.version)),
      db
        .select()
        .from(t.governmentResponses)
        .where(eq(t.governmentResponses.requirementId, id))
        .orderBy(desc(t.governmentResponses.createdAt)),
      db.select().from(t.orders).where(eq(t.orders.requirementId, id)),
      db.select().from(t.documents).where(eq(t.documents.requirementId, id)),
      db
        .select()
        .from(t.requirementStatusEvents)
        .where(eq(t.requirementStatusEvents.requirementId, id))
        .orderBy(desc(t.requirementStatusEvents.createdAt)),
      db
        .select()
        .from(t.approvalRequests)
        .where(eq(t.approvalRequests.requirementId, id))
        .orderBy(desc(t.approvalRequests.requestedAt)),
      db
        .select()
        .from(t.followUpTasks)
        .where(eq(t.followUpTasks.requirementId, id))
        .orderBy(asc(t.followUpTasks.dueDate)),
      db
        .select()
        .from(t.auditLogs)
        .where(eq(t.auditLogs.entityId, id))
        .orderBy(desc(t.auditLogs.createdAt))
        .limit(50),
    ]);

  return {
    requirement,
    customerName: customerRow?.name ?? null,
    ownerName: ownerRow?.name ?? null,
    lines,
    coverage,
    sourcing,
    quotes,
    governmentResponses,
    orders,
    documents,
    statusEvents,
    approvals,
    followUps,
    audits,
  };
}
