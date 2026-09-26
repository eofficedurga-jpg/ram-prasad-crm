import { asc, desc, eq, inArray, ne, and } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";

export async function listQuotes() {
  const db = await getDbAsync();
  const rows = await db
    .select({
      id: t.quotes.id,
      quoteNo: t.quotes.quoteNo,
      version: t.quotes.version,
      status: t.quotes.status,
      totalCost: t.quotes.totalCost,
      totalRecommendedPrice: t.quotes.totalRecommendedPrice,
      totalFinalPrice: t.quotes.totalFinalPrice,
      submittedAt: t.quotes.submittedAt,
      approvedAt: t.quotes.approvedAt,
      requirementId: t.quotes.requirementId,
      requirementRef: t.requirements.ref,
      requirementTitle: t.requirements.title,
      requirementStatus: t.requirements.status,
      customer: t.customers.name,
    })
    .from(t.quotes)
    .leftJoin(t.requirements, eq(t.requirements.id, t.quotes.requirementId))
    .leftJoin(t.customers, eq(t.customers.id, t.requirements.customerId))
    .orderBy(desc(t.quotes.createdAt));
  return rows;
}

export type ComparableBid = {
  quoteId: number;
  quoteNo: string;
  partNumber: string;
  quantity: number;
  finalUnitPrice: number;
  recommendedUnitPrice: number;
  oemName: string | null;
  requirementRef: string;
  requirementTitle: string;
  requirementStatus: string;
  outcome: "won" | "lost" | "open";
  lossReasonCode: string | null;
  lossWinningPrice: number | null;
};

export async function getComparableBids(
  partNumbers: string[],
  excludeQuoteId: number,
): Promise<ComparableBid[]> {
  if (partNumbers.length === 0) return [];
  const db = await getDbAsync();
  const rows = await db
    .select({
      quoteId: t.quotes.id,
      quoteNo: t.quotes.quoteNo,
      partNumber: t.requirementLineItems.partNumber,
      quantity: t.quoteLineItems.quantity,
      finalUnitPrice: t.quoteLineItems.finalUnitPrice,
      recommendedUnitPrice: t.quoteLineItems.recommendedUnitPrice,
      oemName: t.oems.name,
      requirementRef: t.requirements.ref,
      requirementTitle: t.requirements.title,
      requirementStatus: t.requirements.status,
      lossReasonCode: t.requirements.lossReasonCode,
      lossWinningPrice: t.requirements.lossWinningPrice,
    })
    .from(t.quoteLineItems)
    .innerJoin(t.quotes, eq(t.quotes.id, t.quoteLineItems.quoteId))
    .innerJoin(t.requirementLineItems, eq(t.requirementLineItems.id, t.quoteLineItems.requirementLineItemId))
    .innerJoin(t.requirements, eq(t.requirements.id, t.quotes.requirementId))
    .leftJoin(t.oems, eq(t.oems.id, t.quoteLineItems.oemId))
    .where(
      and(
        inArray(t.requirementLineItems.partNumber, partNumbers),
        ne(t.quotes.id, excludeQuoteId),
        inArray(t.quotes.status, ["approved", "superseded", "rejected"]),
      ),
    )
    .orderBy(desc(t.quotes.createdAt));

  return rows.map((r) => ({
    quoteId: r.quoteId,
    quoteNo: r.quoteNo,
    partNumber: r.partNumber,
    quantity: r.quantity,
    finalUnitPrice: r.finalUnitPrice,
    recommendedUnitPrice: r.recommendedUnitPrice,
    oemName: r.oemName ?? null,
    requirementRef: r.requirementRef,
    requirementTitle: r.requirementTitle,
    requirementStatus: r.requirementStatus,
    outcome:
      r.requirementStatus === "won" ? "won" : r.requirementStatus === "lost" ? "lost" : "open",
    lossReasonCode: r.lossReasonCode,
    lossWinningPrice: r.lossWinningPrice,
  }));
}

export async function getQuoteDetail(id: number) {
  const db = await getDbAsync();
  const [quote] = await db.select().from(t.quotes).where(eq(t.quotes.id, id)).limit(1);
  if (!quote) return null;
  const [requirement] = await db
    .select()
    .from(t.requirements)
    .where(eq(t.requirements.id, quote.requirementId))
    .limit(1);
  const lines = await db
    .select({
      id: t.quoteLineItems.id,
      requirementLineItemId: t.quoteLineItems.requirementLineItemId,
      description: t.quoteLineItems.description,
      quantity: t.quoteLineItems.quantity,
      oemId: t.quoteLineItems.oemId,
      oemUnitPrice: t.quoteLineItems.oemUnitPrice,
      freightUnit: t.quoteLineItems.freightUnit,
      otherUnit: t.quoteLineItems.otherUnit,
      unitCost: t.quoteLineItems.unitCost,
      targetMarginPercent: t.quoteLineItems.targetMarginPercent,
      recommendedUnitPrice: t.quoteLineItems.recommendedUnitPrice,
      finalUnitPrice: t.quoteLineItems.finalUnitPrice,
      leadTimeDays: t.quoteLineItems.leadTimeDays,
      notes: t.quoteLineItems.notes,
      partNumber: t.requirementLineItems.partNumber,
      oemName: t.oems.name,
    })
    .from(t.quoteLineItems)
    .leftJoin(t.requirementLineItems, eq(t.requirementLineItems.id, t.quoteLineItems.requirementLineItemId))
    .leftJoin(t.oems, eq(t.oems.id, t.quoteLineItems.oemId))
    .where(eq(t.quoteLineItems.quoteId, id))
    .orderBy(asc(t.quoteLineItems.id));
  const versions = await db
    .select()
    .from(t.quotes)
    .where(eq(t.quotes.requirementId, quote.requirementId))
    .orderBy(desc(t.quotes.version));
  const approvals = await db
    .select()
    .from(t.approvalRequests)
    .where(and(eq(t.approvalRequests.entityType, "quote"), eq(t.approvalRequests.entityId, id)))
    .orderBy(desc(t.approvalRequests.requestedAt));
  const [existingOrder] = await db
    .select({ id: t.orders.id, orderNo: t.orders.orderNo })
    .from(t.orders)
    .where(eq(t.orders.quoteId, id))
    .limit(1);
  const [customer] = requirement?.customerId
    ? await db.select().from(t.customers).where(eq(t.customers.id, requirement.customerId)).limit(1)
    : [];

  const comparable = await getComparableBids(
    lines.map((l) => l.partNumber).filter((p): p is string => Boolean(p)),
    id,
  );

  const oems = await db.select({ id: t.oems.id, name: t.oems.name }).from(t.oems).orderBy(asc(t.oems.name));

  return {
    quote,
    requirement: requirement ?? null,
    customer: customer ?? null,
    lines,
    versions,
    approvals,
    existingOrder: existingOrder ?? null,
    comparable,
    oems,
  };
}
