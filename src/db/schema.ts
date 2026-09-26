import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", [
  "owner",
  "management",
  "sales",
  "operations",
  "finance",
]);

export const requirementStatus = pgEnum("requirement_status", [
  "received",
  "qualifying",
  "quoted",
  "submitted",
  "won",
  "lost",
  "cancelled",
]);

export const requirementPriority = pgEnum("requirement_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const governmentResponseStatus = pgEnum("government_response_status", [
  "submitted",
  "clarification_requested",
  "technical_clarification",
  "commercial_negotiation",
  "awaiting_approval",
  "won",
  "lost",
  "cancelled",
]);

export const quotationStatus = pgEnum("quotation_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "superseded",
]);

export const oemStatus = pgEnum("oem_status", [
  "approved",
  "pending",
  "not_approved",
  "suspended",
]);

export const sourcingRequestStatus = pgEnum("sourcing_request_status", [
  "draft",
  "sent",
  "responded",
  "closed",
  "no_response",
]);

export const oemResponseType = pgEnum("oem_response_type", [
  "firm_commitment",
  "availability_indication",
  "quote_indication",
  "decline",
]);

export const orderStatus = pgEnum("order_status", [
  "open",
  "in_progress",
  "at_risk",
  "delivered",
  "completed",
  "cancelled",
]);

export const invoiceType = pgEnum("invoice_type", [
  "customer_tax_invoice",
  "supplier_invoice",
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);

export const paymentDirection = pgEnum("payment_direction", [
  "receivable_from_customer",
  "payable_to_oem",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);

export const commissionStatus = pgEnum("commission_status", [
  "pending",
  "earned",
  "invoiced",
  "received",
  "cancelled",
]);

export const fulfilmentStage = pgEnum("fulfilment_stage", [
  "oem_po_placed",
  "production_started",
  "production_done",
  "pdi_scheduled",
  "pdi_passed",
  "government_inspection",
  "dispatched",
  "delivered",
  "accepted",
]);

export const fulfilmentState = pgEnum("fulfilment_state", [
  "pending",
  "in_progress",
  "done",
  "blocked",
]);

export const pdiStatus = pgEnum("pdi_status", [
  "scheduled",
  "in_progress",
  "passed",
  "failed",
  "held",
]);

export const deliveryStatus = pgEnum("delivery_status", [
  "scheduled",
  "in_transit",
  "delivered",
  "accepted",
  "partially_rejected",
]);

export const documentType = pgEnum("document_type", [
  "compliance_certificate",
  "approved_item_list",
  "test_report",
  "datasheet",
  "license",
  "insurance",
  "invoice",
  "purchase_order",
  "other",
]);

export const documentSource = pgEnum("document_source", [
  "generated_from_data",
  "reused",
  "obtained_from_oem",
  "prepared_by_hand",
]);

export const documentStatus = pgEnum("document_status", [
  "valid",
  "expiring",
  "expired",
  "pending",
]);

export const approvalEntityType = pgEnum("approval_entity_type", [
  "quote",
  "document",
  "order",
  "compliance_item",
  "coverage_override",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const followUpRule = pgEnum("follow_up_rule", [
  "no_response_7d",
  "document_requested",
  "clarification_overdue",
  "submission_deadline",
  "payment_due",
  "document_expiring",
  "delivery_deadline",
  "oem_response_pending",
]);

export const followUpStatus = pgEnum("follow_up_status", [
  "open",
  "done",
  "dismissed",
]);

export const lossReasonCode = pgEnum("loss_reason_code", [
  "price",
  "technical_non_compliance",
  "delivery_timeline",
  "competitor_preference",
  "quantity_capacity",
  "cancelled",
  "not_pursued",
  "other",
]);

/* ------------------------------------------------------------------ */
/* Auth & people                                                       */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("sales"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  segment: text("segment").notNull().default("government"),
  agencyCode: text("agency_code"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Module 1: Requirement / RFI                                         */
/* ------------------------------------------------------------------ */

export const requirements = pgTable(
  "requirements",
  {
    id: serial("id").primaryKey(),
    ref: text("ref").notNull(),
    title: text("title").notNull(),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    productSummary: text("product_summary"),
    quantityTotal: integer("quantity_total").notNull().default(0),
    requiredDeliveryDate: date("required_delivery_date"),
    submissionDeadline: timestamp("submission_deadline", { withTimezone: true }),
    tenderRef: text("tender_ref"),
    enquiryRef: text("enquiry_ref"),
    technicalSpecs: text("technical_specs"),
    status: requirementStatus("status").notNull().default("received"),
    priority: requirementPriority("priority").notNull().default("normal"),
    ownerUserId: integer("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    // Structured loss capture (module 9)
    lossReasonCode: lossReasonCode("loss_reason_code"),
    lossReasonNotes: text("loss_reason_notes"),
    lossCompetitor: text("loss_competitor"),
    lossQuotedPrice: bigint("loss_quoted_price", { mode: "number" }),
    lossWinningPrice: bigint("loss_winning_price", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("requirements_ref_uq").on(t.ref),
    index("requirements_status_idx").on(t.status),
  ],
);

export const requirementLineItems = pgTable(
  "requirement_line_items",
  {
    id: serial("id").primaryKey(),
    requirementId: integer("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    partNumber: text("part_number").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit").notNull().default("nos"),
    technicalSpecs: text("technical_specs"),
    targetUnitPrice: bigint("target_unit_price", { mode: "number" }),
    currency: text("currency").notNull().default("INR"),
    hsCode: text("hs_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("requirement_line_items_uq").on(t.requirementId, t.lineNo),
    check("requirement_line_items_qty_positive", sql`${t.quantity} >= 0`),
  ],
);

export const requirementStatusEvents = pgTable("requirement_status_events", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id")
    .notNull()
    .references(() => requirements.id, { onDelete: "cascade" }),
  fromStatus: requirementStatus("from_status"),
  toStatus: requirementStatus("to_status").notNull(),
  note: text("note"),
  actorUserId: integer("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Module 2: OEM master and sourcing                                   */
/* ------------------------------------------------------------------ */

export const oems = pgTable("oems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  status: oemStatus("status").notNull().default("pending"),
  approved: boolean("approved").notNull().default(false),
  productsSupplied: text("products_supplied"),
  capabilities: text("capabilities"),
  categories: text("categories"),
  typicalLeadTimeDays: integer("typical_lead_time_days"),
  priceListNotes: text("price_list_notes"),
  pastPerformance: text("past_performance"),
  rating: integer("rating"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oemContacts = pgTable("oem_contacts", {
  id: serial("id").primaryKey(),
  oemId: integer("oem_id")
    .notNull()
    .references(() => oems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  roleTitle: text("role_title"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const oemProducts = pgTable("oem_products", {
  id: serial("id").primaryKey(),
  oemId: integer("oem_id")
    .notNull()
    .references(() => oems.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  partNumber: text("part_number"),
  category: text("category"),
  unitPrice: bigint("unit_price", { mode: "number" }),
  currency: text("currency").notNull().default("INR"),
  leadTimeDays: integer("lead_time_days"),
  capacityPerMonth: integer("capacity_per_month"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oemRequests = pgTable(
  "oem_requests",
  {
    id: serial("id").primaryKey(),
    requirementId: integer("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    requirementLineItemId: integer("requirement_line_item_id")
      .notNull()
      .references(() => requirementLineItems.id, { onDelete: "cascade" }),
    oemId: integer("oem_id")
      .notNull()
      .references(() => oems.id, { onDelete: "restrict" }),
    status: sourcingRequestStatus("status").notNull().default("draft"),
    requestRef: text("request_ref"),
    method: text("method").notNull().default("email"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    dueBy: date("due_by"),
    requestedQuantity: integer("requested_quantity").notNull().default(0),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oem_requests_requirement_idx").on(t.requirementId)],
);

export const oemResponses = pgTable(
  "oem_responses",
  {
    id: serial("id").primaryKey(),
    oemRequestId: integer("oem_request_id")
      .notNull()
      .references(() => oemRequests.id, { onDelete: "cascade" }),
    oemId: integer("oem_id")
      .notNull()
      .references(() => oems.id, { onDelete: "restrict" }),
    requirementId: integer("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    requirementLineItemId: integer("requirement_line_item_id")
      .notNull()
      .references(() => requirementLineItems.id, { onDelete: "cascade" }),
    responseType: oemResponseType("response_type").notNull(),
    responseDate: date("response_date"),
    // firm_quantity is authoritative ONLY for firm_commitment rows.
    firmQuantity: integer("firm_quantity").notNull().default(0),
    // available_quantity is an indication and never counts toward coverage.
    availableQuantity: integer("available_quantity"),
    unitPrice: bigint("unit_price", { mode: "number" }),
    currency: text("currency").notNull().default("INR"),
    leadTimeDays: integer("lead_time_days"),
    validUntil: date("valid_until"),
    documentId: integer("document_id"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oem_responses_line_item_idx").on(t.requirementLineItemId),
    check("oem_responses_firm_nonneg", sql`${t.firmQuantity} >= 0`),
    check(
      "oem_responses_firm_requires_commitment",
      sql`(${t.responseType} <> 'firm_commitment') OR (${t.firmQuantity} >= 0)`,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* Module 4: Quotes and bid intelligence                               */
/* ------------------------------------------------------------------ */

export const quotes = pgTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    quoteNo: text("quote_no").notNull(),
    requirementId: integer("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    status: quotationStatus("status").notNull().default("draft"),
    currency: text("currency").notNull().default("INR"),
    targetMarginPercent: numeric("target_margin_percent", { precision: 6, scale: 2 }),
    totalCost: bigint("total_cost", { mode: "number" }).notNull().default(0),
    totalRecommendedPrice: bigint("total_recommended_price", { mode: "number" })
      .notNull()
      .default(0),
    totalFinalPrice: bigint("total_final_price", { mode: "number" }).notNull().default(0),
    validUntil: date("valid_until"),
    notes: text("notes"),
    supersedesQuoteId: integer("supersedes_quote_id").references(
      (): AnyPgColumn => quotes.id,
      { onDelete: "set null" },
    ),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("quotes_no_uq").on(t.quoteNo),
    uniqueIndex("quotes_requirement_version_uq").on(t.requirementId, t.version),
    index("quotes_status_idx").on(t.status),
  ],
);

export const quoteLineItems = pgTable("quote_line_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  requirementLineItemId: integer("requirement_line_item_id")
    .notNull()
    .references(() => requirementLineItems.id, { onDelete: "restrict" }),
  description: text("description"),
  quantity: integer("quantity").notNull().default(0),
  oemId: integer("oem_id").references(() => oems.id, { onDelete: "set null" }),
  oemUnitPrice: bigint("oem_unit_price", { mode: "number" }).notNull().default(0),
  freightUnit: bigint("freight_unit", { mode: "number" }).notNull().default(0),
  otherUnit: bigint("other_unit", { mode: "number" }).notNull().default(0),
  unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
  targetMarginPercent: numeric("target_margin_percent", { precision: 6, scale: 2 }),
  recommendedUnitPrice: bigint("recommended_unit_price", { mode: "number" })
    .notNull()
    .default(0),
  finalUnitPrice: bigint("final_unit_price", { mode: "number" }).notNull().default(0),
  leadTimeDays: integer("lead_time_days"),
  notes: text("notes"),
});

/* ------------------------------------------------------------------ */
/* Module 5: Government response                                       */
/* ------------------------------------------------------------------ */

export const governmentResponses = pgTable("government_responses", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id")
    .notNull()
    .references(() => requirements.id, { onDelete: "cascade" }),
  quoteId: integer("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  status: governmentResponseStatus("status").notNull().default("submitted"),
  responseDate: date("response_date"),
  notes: text("notes"),
  documentId: integer("document_id"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Module 6: Orders and POs                                            */
/* ------------------------------------------------------------------ */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull().unique(),
    // No orphan PO: every order maps to an approved quote.
    quoteId: integer("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    requirementId: integer("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "restrict" }),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    poNumber: text("po_number").notNull(),
    poDate: date("po_date").notNull(),
    status: orderStatus("status").notNull().default("open"),
    currency: text("currency").notNull().default("INR"),
    totalValue: bigint("total_value", { mode: "number" }).notNull().default(0),
    deliveryDeadline: date("delivery_deadline"),
    expectedCompletionDate: date("expected_completion_date"),
    oemId: integer("oem_id").references(() => oems.id, { onDelete: "set null" }),
    supplierPoNumber: text("supplier_po_number"),
    supplierPoDate: date("supplier_po_date"),
    complianceRequirements: text("compliance_requirements"),
    inspectionRequirements: text("inspection_requirements"),
    pdiRequirements: text("pdi_requirements"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_requirement_idx").on(t.requirementId),
  ],
);

export const orderLineItems = pgTable("order_line_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  quoteLineItemId: integer("quote_line_item_id").references(() => quoteLineItems.id, {
    onDelete: "set null",
  }),
  requirementLineItemId: integer("requirement_line_item_id")
    .notNull()
    .references(() => requirementLineItems.id, { onDelete: "restrict" }),
  partNumber: text("part_number").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull().default(0),
  unitPrice: bigint("unit_price", { mode: "number" }).notNull().default(0),
  oemId: integer("oem_id").references(() => oems.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Module 7: Fulfilment, PDI, delivery                                 */
/* ------------------------------------------------------------------ */

export const fulfilmentEvents = pgTable("fulfilment_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  orderLineItemId: integer("order_line_item_id").references(() => orderLineItems.id, {
    onDelete: "cascade",
  }),
  stage: fulfilmentStage("stage").notNull(),
  state: fulfilmentState("state").notNull().default("pending"),
  ownerUserId: integer("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  expectedDate: date("expected_date"),
  actualDate: date("actual_date"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pdiRecords = pgTable(
  "pdi_records",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderLineItemId: integer("order_line_item_id").references(() => orderLineItems.id, {
      onDelete: "cascade",
    }),
    pdiRef: text("pdi_ref").notNull(),
    status: pdiStatus("status").notNull().default("scheduled"),
    scheduledDate: date("scheduled_date"),
    completedDate: date("completed_date"),
    quantityOffered: integer("quantity_offered").notNull().default(0),
    quantityCleared: integer("quantity_cleared").notNull().default(0),
    quantityRejected: integer("quantity_rejected").notNull().default(0),
    inspector: text("inspector"),
    reportDocumentId: integer("report_document_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("pdi_quantity_nonneg", sql`${t.quantityOffered} >= 0 AND ${t.quantityCleared} >= 0 AND ${t.quantityRejected} >= 0`),
    check(
      "pdi_cleared_plus_rejected_le_offered",
      sql`${t.quantityCleared} + ${t.quantityRejected} <= ${t.quantityOffered}`,
    ),
  ],
);

export const deliveryEvents = pgTable("delivery_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  orderLineItemId: integer("order_line_item_id").references(() => orderLineItems.id, {
    onDelete: "cascade",
  }),
  invoiceId: integer("invoice_id"),
  stage: fulfilmentStage("stage").notNull().default("dispatched"),
  status: deliveryStatus("status").notNull().default("scheduled"),
  quantity: integer("quantity").notNull().default(0),
  scheduledDate: date("scheduled_date"),
  actualDate: date("actual_date"),
  ownerUserId: integer("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  receivedBy: text("received_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Module 8: Invoices, payments, commission, documents                 */
/* ------------------------------------------------------------------ */

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull().unique(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" }),
  invoiceType: invoiceType("invoice_type").notNull(),
  invoiceDate: date("invoice_date"),
  dueDate: date("due_date"),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  tax: bigint("tax", { mode: "number" }).notNull().default(0),
  total: bigint("total", { mode: "number" }).notNull().default(0),
  status: invoiceStatus("status").notNull().default("draft"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  direction: paymentDirection("direction").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  paidAt: date("paid_at"),
  dueDate: date("due_date"),
  status: paymentStatus("status").notNull().default("pending"),
  reference: text("reference"),
  method: text("method"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissionEntries = pgTable("commission_entries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  oemId: integer("oem_id").references(() => oems.id, { onDelete: "set null" }),
  oemPaymentId: integer("oem_payment_id").references(() => payments.id, {
    onDelete: "set null",
  }),
  // Commission is earned on an OEM-payment milestone.
  milestone: text("milestone").notNull().default("oem_payment_paid"),
  baseAmount: bigint("base_amount", { mode: "number" }).notNull().default(0),
  ratePercent: numeric("rate_percent", { precision: 6, scale: 2 }),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  status: commissionStatus("status").notNull().default("pending"),
  earnedAt: timestamp("earned_at", { withTimezone: true }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    docType: documentType("doc_type").notNull().default("other"),
    source: documentSource("source").notNull().default("obtained_from_oem"),
    status: documentStatus("status").notNull().default("pending"),
    referenceNo: text("reference_no"),
    oemId: integer("oem_id").references(() => oems.id, { onDelete: "set null" }),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    requirementId: integer("requirement_id").references(() => requirements.id, {
      onDelete: "set null",
    }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    productName: text("product_name"),
    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),
    renewAfterMonths: integer("renew_after_months"),
    fileUrl: text("file_url"),
    // How long this document took to produce, to find the real bottleneck.
    processingDays: integer("processing_days"),
    notes: text("notes"),
    uploadedBy: integer("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_expiry_idx").on(t.expiryDate)],
);

/* ------------------------------------------------------------------ */
/* Cross-cutting: loss reasons, follow-ups, approvals, audit, Q&A      */
/* ------------------------------------------------------------------ */

export const lossReasons = pgTable("loss_reasons", {
  id: serial("id").primaryKey(),
  code: lossReasonCode("code").notNull().unique(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const followUpTasks = pgTable("follow_up_tasks", {
  id: serial("id").primaryKey(),
  rule: followUpRule("rule").notNull(),
  title: text("title").notNull(),
  requirementId: integer("requirement_id").references(() => requirements.id, {
    onDelete: "cascade",
  }),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
  documentId: integer("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  ownerUserId: integer("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  dueDate: date("due_date").notNull(),
  status: followUpStatus("status").notNull().default("open"),
  notes: text("notes"),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const approvalRequests = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  entityType: approvalEntityType("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  requirementId: integer("requirement_id").references(() => requirements.id, {
    onDelete: "cascade",
  }),
  status: approvalStatus("status").notNull().default("pending"),
  requestedBy: integer("requested_by").references(() => users.id, {
    onDelete: "set null",
  }),
  decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  comment: text("comment"),
  payload: jsonb("payload"),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    action: text("action").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: userRole("actor_role"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

export const qnaQueryLog = pgTable("qna_query_log", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  matchedIntent: text("matched_intent"),
  params: jsonb("params"),
  answered: boolean("answered").notNull().default(false),
  resultSummary: text("result_summary"),
  actorUserId: integer("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
