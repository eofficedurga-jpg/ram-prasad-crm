"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission, requireUser } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { toMinor } from "@/lib/format";
import { computePrice } from "@/domain/pricing";
import { canSubmitQuote } from "@/domain/coverage";
import { getCoverageForRequirement, hasApprovedCoverageOverride } from "@/server/requirements";

async function nextQuoteNo(): Promise<string> {
  const db = await getDbAsync();
  const year = new Date().getFullYear();
  const rows = await db.select({ quoteNo: t.quotes.quoteNo }).from(t.quotes);
  const max = rows.reduce((acc, r) => {
    const n = Number(r.quoteNo.split("-").pop());
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `QT-${year}-${String(max + 1).padStart(3, "0")}`;
}

async function recomputeQuoteTotals(tx: any, quoteId: number): Promise<void> {
  const lines = await tx
    .select()
    .from(t.quoteLineItems)
    .where(eq(t.quoteLineItems.quoteId, quoteId));
  let totalCost = 0;
  let totalRecommended = 0;
  let totalFinal = 0;
  for (const l of lines) {
    totalCost += (l.unitCost ?? 0) * l.quantity;
    totalRecommended += (l.recommendedUnitPrice ?? 0) * l.quantity;
    totalFinal += (l.finalUnitPrice ?? 0) * l.quantity;
  }
  await tx
    .update(t.quotes)
    .set({ totalCost, totalRecommendedPrice: totalRecommended, totalFinalPrice: totalFinal, updatedAt: new Date() })
    .where(eq(t.quotes.id, quoteId));
}

export async function createQuoteAction(formData: FormData): Promise<void> {
  const user = await requirePermission("quotes:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const margin = Number(formData.get("targetMarginPercent") ?? 15);
  const validUntil = String(formData.get("validUntil") ?? "") || null;

  const lines = await db
    .select()
    .from(t.requirementLineItems)
    .where(eq(t.requirementLineItems.requirementId, requirementId));
  if (lines.length === 0) throw new Error("Add line items to the requirement before quoting.");

  const responses = await db
    .select()
    .from(t.oemResponses)
    .where(eq(t.oemResponses.requirementId, requirementId))
    .orderBy(desc(t.oemResponses.responseDate));

  const existing = await db
    .select({ version: t.quotes.version })
    .from(t.quotes)
    .where(eq(t.quotes.requirementId, requirementId));
  const nextVersion = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  const quoteNo = await nextQuoteNo();

  const quoteId = await db.transaction(async (tx) => {
    const [quote] = await tx
      .insert(t.quotes)
      .values({
        quoteNo,
        requirementId,
        version: nextVersion,
        status: "draft",
        targetMarginPercent: String(margin),
        validUntil,
        createdBy: user.id,
      })
      .returning({ id: t.quotes.id });

    for (const line of lines) {
      // Prefer the cheapest firm commitment; fall back to the cheapest indication.
      const candidates = responses.filter((r) => r.requirementLineItemId === line.id);
      const firm = candidates.filter((r) => r.responseType === "firm_commitment" && r.unitPrice);
      const pool = firm.length ? firm : candidates.filter((r) => r.unitPrice);
      const chosen = pool.sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0))[0];
      const oemUnitPrice = chosen?.unitPrice ?? 0;
      const price = computePrice({ oemUnitPrice, quantity: line.quantity, targetMarginPercent: margin });
      await tx.insert(t.quoteLineItems).values({
        quoteId: quote.id,
        requirementLineItemId: line.id,
        description: line.description ?? line.partNumber,
        quantity: line.quantity,
        oemId: chosen?.oemId ?? null,
        oemUnitPrice,
        unitCost: price.unitCost,
        targetMarginPercent: String(margin),
        recommendedUnitPrice: price.recommendedUnitPrice,
        finalUnitPrice: price.recommendedUnitPrice,
        leadTimeDays: chosen?.leadTimeDays ?? null,
        notes: chosen ? null : "No OEM price yet — recommended price is zero until a response is recorded.",
      });
    }
    await recomputeQuoteTotals(tx, quote.id);
    await writeAudit(tx, {
      entityType: "quote",
      entityId: quote.id,
      action: "quote.created",
      actor: { userId: user.id, role: user.role },
      after: { quoteNo, requirementId, version: nextVersion, lineItems: lines.length },
    });
    return quote.id;
  });

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/quotes");
  redirect(`/quotes/${quoteId}`);
}

export async function updateQuoteLineAction(formData: FormData): Promise<void> {
  const user = await requirePermission("quotes:write");
  const db = await getDbAsync();
  const quoteLineId = Number(formData.get("quoteLineId"));
  const [line] = await db
    .select()
    .from(t.quoteLineItems)
    .where(eq(t.quoteLineItems.id, quoteLineId))
    .limit(1);
  if (!line) throw new Error("Quote line not found.");
  const [quote] = await db.select().from(t.quotes).where(eq(t.quotes.id, line.quoteId)).limit(1);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "approved") throw new Error("Approved quotes are immutable. Create a new version.");

  const freight = toMinor(String(formData.get("freightUnit") ?? "0"));
  const other = toMinor(String(formData.get("otherUnit") ?? "0"));
  const margin = Number(formData.get("targetMarginPercent") ?? 15);
  const finalRaw = String(formData.get("finalUnitPrice") ?? "");
  const oemUnitPrice = line.oemUnitPrice;
  const price = computePrice({
    oemUnitPrice,
    quantity: line.quantity,
    freightUnit: freight,
    otherUnit: other,
    targetMarginPercent: margin,
  });
  const finalUnitPrice = finalRaw ? toMinor(finalRaw) : price.recommendedUnitPrice;

  await db.transaction(async (tx) => {
    await tx
      .update(t.quoteLineItems)
      .set({
        freightUnit: freight,
        otherUnit: other,
        unitCost: price.unitCost,
        targetMarginPercent: String(margin),
        recommendedUnitPrice: price.recommendedUnitPrice,
        finalUnitPrice,
        leadTimeDays: formData.get("leadTimeDays") ? Number(formData.get("leadTimeDays")) : line.leadTimeDays,
      })
      .where(eq(t.quoteLineItems.id, quoteLineId));
    await recomputeQuoteTotals(tx, line.quoteId);
    await writeAudit(tx, {
      entityType: "quote_line_item",
      entityId: quoteLineId,
      action: "quote.line_priced",
      actor: { userId: user.id, role: user.role },
      before: { finalUnitPrice: line.finalUnitPrice, targetMarginPercent: line.targetMarginPercent },
      after: { finalUnitPrice, targetMarginPercent: String(margin), recommendedUnitPrice: price.recommendedUnitPrice },
    });
  });

  revalidatePath(`/quotes/${line.quoteId}`);
}

export async function submitQuoteForApprovalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDbAsync();
  const quoteId = Number(formData.get("quoteId"));
  const [quote] = await db.select().from(t.quotes).where(eq(t.quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "approved") throw new Error("Quote is already approved.");

  const coverage = await getCoverageForRequirement(quote.requirementId);
  const override = await hasApprovedCoverageOverride(quote.requirementId);
  const gate = canSubmitQuote(coverage, { approved: override });
  if (!gate.allowed) {
    throw new Error(gate.reason);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(t.quotes)
      .set({ status: "pending_approval", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(t.quotes.id, quoteId));
    await tx.insert(t.approvalRequests).values({
      entityType: "quote",
      entityId: quoteId,
      requirementId: quote.requirementId,
      status: "pending",
      requestedBy: user.id,
      comment: override
        ? `Submitted with owner coverage override (${coverage.totalUncovered} uncovered unit(s)).`
        : "All line items covered by firm commitments.",
      payload: {
        uncovered: coverage.totalUncovered,
        coveragePercent: coverage.coveragePercent,
        overrideUsed: override,
      },
    });
    await writeAudit(tx, {
      entityType: "quote",
      entityId: quoteId,
      action: "quote.submitted_for_approval",
      actor: { userId: user.id, role: user.role },
      before: { status: quote.status },
      after: { status: "pending_approval" },
      reason: override ? "Coverage override in force" : "Coverage complete",
    });
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/requirements/${quote.requirementId}`);
  revalidatePath("/admin");
}

export async function decideQuoteAction(formData: FormData): Promise<void> {
  const user = await requirePermission("quotes:approve");
  const db = await getDbAsync();
  const quoteId = Number(formData.get("quoteId"));
  const decision = String(formData.get("decision"));
  const comment = String(formData.get("comment") ?? "") || null;
  const [quote] = await db.select().from(t.quotes).where(eq(t.quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error("Quote not found.");

  await db.transaction(async (tx) => {
    if (decision === "approve") {
      await tx
        .update(t.quotes)
        .set({ status: "approved", approvedBy: user.id, approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(t.quotes.id, quoteId));
      await tx
        .update(t.quotes)
        .set({ status: "superseded" })
        .where(
          and(
            eq(t.quotes.requirementId, quote.requirementId),
            ne(t.quotes.id, quoteId),
            eq(t.quotes.status, "approved"),
          ),
        );
      await tx
        .update(t.requirements)
        .set({ status: "quoted", updatedAt: new Date() })
        .where(eq(t.requirements.id, quote.requirementId));
      await tx
        .update(t.approvalRequests)
        .set({ status: "approved", decidedBy: user.id, decidedAt: new Date(), comment })
        .where(
          and(
            eq(t.approvalRequests.entityType, "quote"),
            eq(t.approvalRequests.entityId, quoteId),
            eq(t.approvalRequests.status, "pending"),
          ),
        );
    } else {
      await tx
        .update(t.quotes)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(t.quotes.id, quoteId));
      await tx
        .update(t.approvalRequests)
        .set({ status: "rejected", decidedBy: user.id, decidedAt: new Date(), comment })
        .where(
          and(
            eq(t.approvalRequests.entityType, "quote"),
            eq(t.approvalRequests.entityId, quoteId),
            eq(t.approvalRequests.status, "pending"),
          ),
        );
    }
    await writeAudit(tx, {
      entityType: "quote",
      entityId: quoteId,
      action: decision === "approve" ? "quote.approved" : "quote.rejected",
      actor: { userId: user.id, role: user.role },
      before: { status: quote.status },
      after: { status: decision === "approve" ? "approved" : "rejected" },
      reason: comment,
    });
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  revalidatePath("/admin");
}

export async function createQuoteVersionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("quotes:write");
  const db = await getDbAsync();
  const quoteId = Number(formData.get("quoteId"));
  const [quote] = await db.select().from(t.quotes).where(eq(t.quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error("Quote not found.");
  const lines = await db.select().from(t.quoteLineItems).where(eq(t.quoteLineItems.quoteId, quoteId));

  const existing = await db
    .select({ version: t.quotes.version })
    .from(t.quotes)
    .where(eq(t.quotes.requirementId, quote.requirementId));
  const nextVersion = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  const quoteNo = await nextQuoteNo();

  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(t.quotes)
      .values({
        quoteNo,
        requirementId: quote.requirementId,
        version: nextVersion,
        status: "draft",
        targetMarginPercent: quote.targetMarginPercent,
        validUntil: quote.validUntil,
        supersedesQuoteId: quoteId,
        createdBy: user.id,
        notes: `Version ${nextVersion} from ${quote.quoteNo}.`,
      })
      .returning({ id: t.quotes.id });
    for (const l of lines) {
      await tx.insert(t.quoteLineItems).values({
        quoteId: created.id,
        requirementLineItemId: l.requirementLineItemId,
        description: l.description,
        quantity: l.quantity,
        oemId: l.oemId,
        oemUnitPrice: l.oemUnitPrice,
        freightUnit: l.freightUnit,
        otherUnit: l.otherUnit,
        unitCost: l.unitCost,
        targetMarginPercent: l.targetMarginPercent,
        recommendedUnitPrice: l.recommendedUnitPrice,
        finalUnitPrice: l.finalUnitPrice,
        leadTimeDays: l.leadTimeDays,
        notes: l.notes,
      });
    }
    await recomputeQuoteTotals(tx, created.id);
    await writeAudit(tx, {
      entityType: "quote",
      entityId: created.id,
      action: "quote.version_created",
      actor: { userId: user.id, role: user.role },
      after: { quoteNo, version: nextVersion, supersedesQuoteId: quoteId },
    });
    return created.id;
  });

  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${newId}`);
}

export async function recordGovernmentResponseAction(formData: FormData): Promise<void> {
  const user = await requirePermission("requirements:write");
  const db = await getDbAsync();
  const requirementId = Number(formData.get("requirementId"));
  const quoteIdRaw = String(formData.get("quoteId") ?? "");
  const status = String(formData.get("status") ?? "submitted");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.governmentResponses)
      .values({
        requirementId,
        quoteId: quoteIdRaw ? Number(quoteIdRaw) : null,
        status: status as any,
        responseDate: String(formData.get("responseDate") ?? "") || new Date().toISOString().slice(0, 10),
        notes: String(formData.get("notes") ?? "") || null,
        createdBy: user.id,
      })
      .returning({ id: t.governmentResponses.id });

    const derivedRequirementStatus =
      status === "won" ? "won" : status === "lost" ? "lost" : status === "cancelled" ? "cancelled" : "submitted";
    const [current] = await tx
      .select()
      .from(t.requirements)
      .where(eq(t.requirements.id, requirementId))
      .limit(1);
    await tx
      .update(t.requirements)
      .set({ status: derivedRequirementStatus as any, updatedAt: new Date() })
      .where(eq(t.requirements.id, requirementId));
    await tx.insert(t.requirementStatusEvents).values({
      requirementId,
      fromStatus: current?.status ?? null,
      toStatus: derivedRequirementStatus as any,
      note: `Government response: ${status}`,
      actorUserId: user.id,
    });
    await writeAudit(tx, {
      entityType: "government_response",
      entityId: row.id,
      action: "response.recorded",
      actor: { userId: user.id, role: user.role },
      before: { requirementStatus: current?.status ?? null },
      after: { status, requirementStatus: derivedRequirementStatus },
    });
  });

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/followups");
  revalidatePath("/dashboard");
}
