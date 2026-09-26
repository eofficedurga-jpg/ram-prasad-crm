// Rule-based follow-up generation. Deterministic: same facts -> same tasks.
// dedupeKey makes generation idempotent so re-running never duplicates tasks.

import { daysBetween } from "@/lib/format";

export type FollowUpRuleName =
  | "no_response_7d"
  | "document_requested"
  | "clarification_overdue"
  | "submission_deadline"
  | "payment_due"
  | "document_expiring"
  | "delivery_deadline"
  | "oem_response_pending";

export type GeneratedTask = {
  rule: FollowUpRuleName;
  title: string;
  requirementId?: number;
  orderId?: number;
  invoiceId?: number;
  documentId?: number;
  ownerUserId?: number | null;
  dueDate: string;
  notes?: string;
  dedupeKey: string;
};

export type FollowUpFacts = {
  today?: Date;
  noResponseQuotes: {
    requirementId: number;
    requirementRef: string;
    submittedAt: Date | string;
    ownerUserId?: number | null;
  }[];
  governmentResponses: {
    requirementId: number;
    requirementRef: string;
    status: string;
    responseDate?: Date | string | null;
    documentId?: number | null;
    ownerUserId?: number | null;
  }[];
  pendingOemRequests: {
    id: number;
    requirementId: number;
    requirementRef: string;
    oemName: string;
    sentAt: Date | string;
    dueBy?: Date | string | null;
    ownerUserId?: number | null;
  }[];
  upcomingDeadlines: {
    requirementId: number;
    requirementRef: string;
    title: string;
    submissionDeadline: Date | string;
    ownerUserId?: number | null;
  }[];
  invoices: {
    id: number;
    invoiceNo: string;
    orderId: number;
    dueDate: Date | string;
    balance: number;
    ownerUserId?: number | null;
  }[];
  expiringDocuments: {
    id: number;
    title: string;
    expiryDate: Date | string;
    ownerUserId?: number | null;
  }[];
  atRiskOrders: {
    id: number;
    orderNo: string;
    deliveryDeadline: Date | string;
    outstandingQuantity: number;
    riskLevel: string;
    ownerUserId?: number | null;
  }[];
};

function iso(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function buildFollowUpTasks(facts: FollowUpFacts): GeneratedTask[] {
  const today = facts.today ?? new Date();
  const tasks: GeneratedTask[] = [];

  for (const q of facts.noResponseQuotes) {
    const age = daysBetween(today, q.submittedAt);
    if (age >= 7) {
      tasks.push({
        rule: "no_response_7d",
        title: `No response for ${age} days on ${q.requirementRef}`,
        requirementId: q.requirementId,
        ownerUserId: q.ownerUserId ?? null,
        dueDate: iso(today),
        notes: "Government/agency has not responded since submission.",
        dedupeKey: `no_response_7d:${q.requirementId}:${iso(q.submittedAt)}`,
      });
    }
  }

  for (const r of facts.governmentResponses) {
    if (r.status === "clarification_requested" && !r.documentId) {
      tasks.push({
        rule: "document_requested",
        title: `Document requested on ${r.requirementRef} — not yet attached`,
        requirementId: r.requirementId,
        ownerUserId: r.ownerUserId ?? null,
        dueDate: iso(today),
        dedupeKey: `document_requested:${r.requirementId}:${iso(r.responseDate ?? today)}`,
      });
    }
    const clarificationStates = ["clarification_requested", "technical_clarification"];
    if (clarificationStates.includes(r.status)) {
      const age = r.responseDate ? daysBetween(today, r.responseDate) : 0;
      if (age >= 3) {
        tasks.push({
          rule: "clarification_overdue",
          title: `Clarification on ${r.requirementRef} open ${age} days`,
          requirementId: r.requirementId,
          ownerUserId: r.ownerUserId ?? null,
          dueDate: iso(today),
          dedupeKey: `clarification_overdue:${r.requirementId}:${iso(r.responseDate ?? today)}`,
        });
      }
    }
  }

  for (const d of facts.upcomingDeadlines) {
    const days = daysBetween(d.submissionDeadline, today);
    if (days <= 7) {
      tasks.push({
        rule: "submission_deadline",
        title: `Submission deadline for ${d.requirementRef} in ${days} day(s)`,
        requirementId: d.requirementId,
        ownerUserId: d.ownerUserId ?? null,
        dueDate: iso(d.submissionDeadline),
        dedupeKey: `submission_deadline:${d.requirementId}:${iso(d.submissionDeadline)}`,
      });
    }
  }

  for (const o of facts.pendingOemRequests) {
    const age = daysBetween(today, o.sentAt);
    if (age >= 5) {
      tasks.push({
        rule: "oem_response_pending",
        title: `OEM ${o.oemName} response pending ${age} days on ${o.requirementRef}`,
        requirementId: o.requirementId,
        ownerUserId: o.ownerUserId ?? null,
        dueDate: o.dueBy ? iso(o.dueBy) : iso(today),
        dedupeKey: `oem_response_pending:${o.id}`,
      });
    }
  }

  for (const inv of facts.invoices) {
    if (inv.balance > 0) {
      const days = daysBetween(inv.dueDate, today);
      if (days >= 0) {
        tasks.push({
          rule: "payment_due",
          title: `Payment due for invoice ${inv.invoiceNo} (balance outstanding)`,
          orderId: inv.orderId,
          invoiceId: inv.id,
          ownerUserId: inv.ownerUserId ?? null,
          dueDate: iso(inv.dueDate),
          notes: `Outstanding balance: ${inv.balance} (minor units).`,
          dedupeKey: `payment_due:${inv.id}:${iso(inv.dueDate)}`,
        });
      }
    }
  }

  for (const doc of facts.expiringDocuments) {
    const days = daysBetween(doc.expiryDate, today);
    if (days <= 90) {
      tasks.push({
        rule: "document_expiring",
        title: `Document "${doc.title}" expires in ${days} day(s)`,
        documentId: doc.id,
        ownerUserId: doc.ownerUserId ?? null,
        dueDate: iso(doc.expiryDate),
        dedupeKey: `document_expiring:${doc.id}:${iso(doc.expiryDate)}`,
      });
    }
  }

  for (const order of facts.atRiskOrders) {
    if (order.riskLevel === "at_risk" || order.riskLevel === "late") {
      tasks.push({
        rule: "delivery_deadline",
        title: `${order.orderNo} ${order.riskLevel === "late" ? "is late" : "at delivery risk"} (${order.outstandingQuantity} units outstanding)`,
        orderId: order.id,
        ownerUserId: order.ownerUserId ?? null,
        dueDate: iso(order.deliveryDeadline),
        dedupeKey: `delivery_deadline:${order.id}:${iso(order.deliveryDeadline)}:${order.riskLevel}`,
      });
    }
  }

  return tasks;
}
