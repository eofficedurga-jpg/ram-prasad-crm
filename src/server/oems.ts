import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { computeOemAvailability, type CapacityAvailability } from "@/domain/coverage";

export async function listOems() {
  const db = await getDbAsync();
  const oems = await db.select().from(t.oems).orderBy(asc(t.oems.name));
  const products = await db.select().from(t.oemProducts);
  const responses = await db
    .select({
      oemId: t.oemResponses.oemId,
      responseType: t.oemResponses.responseType,
      firmQuantity: t.oemResponses.firmQuantity,
    })
    .from(t.oemResponses);
  const committedByOem = new Map<number, number>();
  for (const r of responses) {
    if (r.responseType !== "firm_commitment") continue;
    committedByOem.set(r.oemId, (committedByOem.get(r.oemId) ?? 0) + r.firmQuantity);
  }
  const productCount = new Map<number, number>();
  for (const p of products) productCount.set(p.oemId, (productCount.get(p.oemId) ?? 0) + 1);
  return oems.map((o) => ({
    ...o,
    productCount: productCount.get(o.id) ?? 0,
    committedUnits: committedByOem.get(o.id) ?? 0,
  }));
}

export async function getOemDetail(id: number) {
  const db = await getDbAsync();
  const [oem] = await db.select().from(t.oems).where(eq(t.oems.id, id)).limit(1);
  if (!oem) return null;
  const [contacts, products, documents, responses] = await Promise.all([
    db.select().from(t.oemContacts).where(eq(t.oemContacts.oemId, id)),
    db.select().from(t.oemProducts).where(eq(t.oemProducts.oemId, id)).orderBy(asc(t.oemProducts.productName)),
    db.select().from(t.documents).where(eq(t.documents.oemId, id)).orderBy(desc(t.documents.createdAt)),
    db
      .select({
        id: t.oemResponses.id,
        responseType: t.oemResponses.responseType,
        responseDate: t.oemResponses.responseDate,
        firmQuantity: t.oemResponses.firmQuantity,
        availableQuantity: t.oemResponses.availableQuantity,
        unitPrice: t.oemResponses.unitPrice,
        leadTimeDays: t.oemResponses.leadTimeDays,
        notes: t.oemResponses.notes,
        requirementId: t.oemResponses.requirementId,
        requirementRef: t.requirements.ref,
      })
      .from(t.oemResponses)
      .leftJoin(t.requirements, eq(t.requirements.id, t.oemResponses.requirementId))
      .where(eq(t.oemResponses.oemId, id))
      .orderBy(desc(t.oemResponses.responseDate)),
  ]);
  return { oem, contacts, products, documents, responses };
}

export type OemAvailabilityRow = {
  oemId: number;
  oemName: string;
  productId: number;
  productName: string;
  partNumber: string | null;
  capacityPerMonth: number | null;
  committedElsewhere: number;
} & CapacityAvailability;

/**
 * Global capacity view (PRD open question 1): each OEM product's capacity is
 * netted against the firm quantity already committed to OTHER requirements,
 * so a new requirement sees only the genuinely available balance.
 */
export async function getOemAvailability(): Promise<OemAvailabilityRow[]> {
  const db = await getDbAsync();
  const products = await db
    .select({
      id: t.oemProducts.id,
      oemId: t.oemProducts.oemId,
      productName: t.oemProducts.productName,
      partNumber: t.oemProducts.partNumber,
      capacityPerMonth: t.oemProducts.capacityPerMonth,
      oemName: t.oems.name,
    })
    .from(t.oemProducts)
    .innerJoin(t.oems, eq(t.oems.id, t.oemProducts.oemId));

  const firm = await db
    .select({
      oemId: t.oemResponses.oemId,
      partNumber: t.requirementLineItems.partNumber,
      firmQuantity: t.oemResponses.firmQuantity,
    })
    .from(t.oemResponses)
    .leftJoin(
      t.requirementLineItems,
      eq(t.requirementLineItems.id, t.oemResponses.requirementLineItemId),
    )
    .where(eq(t.oemResponses.responseType, "firm_commitment"));

  const committedKey = new Map<string, number>();
  for (const r of firm) {
    const key = `${r.oemId}::${r.partNumber ?? ""}`;
    committedKey.set(key, (committedKey.get(key) ?? 0) + r.firmQuantity);
  }

  return products
    .map((p) => {
      const committedElsewhere = committedKey.get(`${p.oemId}::${p.partNumber ?? ""}`) ?? 0;
      const availability = computeOemAvailability(p.capacityPerMonth, committedElsewhere);
      return {
        oemId: p.oemId,
        oemName: p.oemName,
        productId: p.id,
        productName: p.productName,
        partNumber: p.partNumber,
        capacityPerMonth: p.capacityPerMonth,
        ...availability,
      };
    })
    .sort((a, b) => a.oemName.localeCompare(b.oemName));
}

export async function listApprovedOemsForSourcing() {
  const db = await getDbAsync();
  return db
    .select({ id: t.oems.id, name: t.oems.name, approved: t.oems.approved, status: t.oems.status })
    .from(t.oems)
    .orderBy(desc(t.oems.approved), asc(t.oems.name));
}

export async function listOemsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDbAsync();
  return db
    .select({ id: t.oems.id, name: t.oems.name })
    .from(t.oems)
    .where(inArray(t.oems.id, ids));
}
