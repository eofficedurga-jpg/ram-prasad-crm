import { eq, ilike, or } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";

export type SearchResults = {
  query: string;
  requirements: { id: number; ref: string; title: string; status: string }[];
  quotes: { id: number; quoteNo: string; requirementId: number; status: string; total: number }[];
  orders: { id: number; orderNo: string; poNumber: string; status: string; total: number }[];
  oems: { id: number; name: string; code: string; status: string }[];
  documents: { id: number; title: string; docType: string; status: string; expiryDate: string | null }[];
  parts: { requirementId: number; partNumber: string; description: string | null; quantity: number }[];
};

export async function searchAll(rawQuery: string): Promise<SearchResults> {
  const q = rawQuery.trim();
  const term = `%${q}%`;
  const db = await getDbAsync();
  if (!q) {
    return { query: q, requirements: [], quotes: [], orders: [], oems: [], documents: [], parts: [] };
  }

  const [requirements, parts, quotes, orders, oems, documents] = await Promise.all([
    db
      .select({ id: t.requirements.id, ref: t.requirements.ref, title: t.requirements.title, status: t.requirements.status })
      .from(t.requirements)
      .where(
        or(
          ilike(t.requirements.ref, term),
          ilike(t.requirements.title, term),
          ilike(t.requirements.productSummary, term),
          ilike(t.requirements.technicalSpecs, term),
          ilike(t.requirements.tenderRef, term),
          ilike(t.requirements.enquiryRef, term),
        ),
      )
      .limit(25),
    db
      .select({
        requirementId: t.requirementLineItems.requirementId,
        partNumber: t.requirementLineItems.partNumber,
        description: t.requirementLineItems.description,
        quantity: t.requirementLineItems.quantity,
      })
      .from(t.requirementLineItems)
      .where(or(ilike(t.requirementLineItems.partNumber, term), ilike(t.requirementLineItems.description, term)))
      .limit(25),
    db
      .select({
        id: t.quotes.id,
        quoteNo: t.quotes.quoteNo,
        requirementId: t.quotes.requirementId,
        status: t.quotes.status,
        total: t.quotes.totalFinalPrice,
      })
      .from(t.quotes)
      .where(ilike(t.quotes.quoteNo, term))
      .limit(25),
    db
      .select({
        id: t.orders.id,
        orderNo: t.orders.orderNo,
        poNumber: t.orders.poNumber,
        status: t.orders.status,
        total: t.orders.totalValue,
      })
      .from(t.orders)
      .where(or(ilike(t.orders.orderNo, term), ilike(t.orders.poNumber, term)))
      .limit(25),
    db
      .select({ id: t.oems.id, name: t.oems.name, code: t.oems.code, status: t.oems.status })
      .from(t.oems)
      .where(
        or(
          ilike(t.oems.name, term),
          ilike(t.oems.code, term),
          ilike(t.oems.productsSupplied, term),
          ilike(t.oems.capabilities, term),
          ilike(t.oems.categories, term),
        ),
      )
      .limit(25),
    db
      .select({
        id: t.documents.id,
        title: t.documents.title,
        docType: t.documents.docType,
        status: t.documents.status,
        expiryDate: t.documents.expiryDate,
      })
      .from(t.documents)
      .where(or(ilike(t.documents.title, term), ilike(t.documents.productName, term), ilike(t.documents.referenceNo, term)))
      .limit(25),
  ]);

  return { query: q, requirements, quotes, orders, oems, documents, parts };
}

/**
 * Comparable-requirement history: past requirements sharing a part number,
 * with the OEMs, prices, delivery, margin, documents and problems recorded.
 */
export async function searchHistory(partNumber: string) {
  const db = await getDbAsync();
  const term = `%${partNumber.trim()}%`;
  if (!partNumber.trim()) return [];
  const rows = await db
    .select({
      requirementId: t.requirements.id,
      ref: t.requirements.ref,
      title: t.requirements.title,
      status: t.requirements.status,
      partNumber: t.requirementLineItems.partNumber,
      quantity: t.requirementLineItems.quantity,
      oemName: t.oems.name,
      firmQuantity: t.oemResponses.firmQuantity,
      unitPrice: t.oemResponses.unitPrice,
      leadTimeDays: t.oemResponses.leadTimeDays,
      lossReasonCode: t.requirements.lossReasonCode,
      lossCompetitor: t.requirements.lossCompetitor,
      lossWinningPrice: t.requirements.lossWinningPrice,
    })
    .from(t.requirementLineItems)
    .innerJoin(t.requirements, eq(t.requirements.id, t.requirementLineItems.requirementId))
    .leftJoin(t.oemResponses, eq(t.oemResponses.requirementLineItemId, t.requirementLineItems.id))
    .leftJoin(t.oems, eq(t.oems.id, t.oemResponses.oemId))
    .where(ilike(t.requirementLineItems.partNumber, term))
    .limit(50);
  return rows;
}
