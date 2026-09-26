CREATE TYPE "public"."approval_entity_type" AS ENUM('quote', 'document', 'order', 'compliance_item', 'coverage_override');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'earned', 'invoiced', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('scheduled', 'in_transit', 'delivered', 'accepted', 'partially_rejected');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('generated_from_data', 'reused', 'obtained_from_oem', 'prepared_by_hand');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('valid', 'expiring', 'expired', 'pending');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('compliance_certificate', 'approved_item_list', 'test_report', 'datasheet', 'license', 'insurance', 'invoice', 'purchase_order', 'other');--> statement-breakpoint
CREATE TYPE "public"."follow_up_rule" AS ENUM('no_response_7d', 'document_requested', 'clarification_overdue', 'submission_deadline', 'payment_due', 'document_expiring', 'delivery_deadline', 'oem_response_pending');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_stage" AS ENUM('oem_po_placed', 'production_started', 'production_done', 'pdi_scheduled', 'pdi_passed', 'government_inspection', 'dispatched', 'delivered', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_state" AS ENUM('pending', 'in_progress', 'done', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."government_response_status" AS ENUM('submitted', 'clarification_requested', 'technical_clarification', 'commercial_negotiation', 'awaiting_approval', 'won', 'lost', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('customer_tax_invoice', 'supplier_invoice');--> statement-breakpoint
CREATE TYPE "public"."loss_reason_code" AS ENUM('price', 'technical_non_compliance', 'delivery_timeline', 'competitor_preference', 'quantity_capacity', 'cancelled', 'not_pursued', 'other');--> statement-breakpoint
CREATE TYPE "public"."oem_response_type" AS ENUM('firm_commitment', 'availability_indication', 'quote_indication', 'decline');--> statement-breakpoint
CREATE TYPE "public"."oem_status" AS ENUM('approved', 'pending', 'not_approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('open', 'in_progress', 'at_risk', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_direction" AS ENUM('receivable_from_customer', 'payable_to_oem');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'partially_paid', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pdi_status" AS ENUM('scheduled', 'in_progress', 'passed', 'failed', 'held');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."requirement_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('received', 'qualifying', 'quoted', 'submitted', 'won', 'lost', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sourcing_request_status" AS ENUM('draft', 'sent', 'responded', 'closed', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'management', 'sales', 'operations', 'finance');--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" "approval_entity_type" NOT NULL,
	"entity_id" integer NOT NULL,
	"requirement_id" integer,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" integer,
	"decided_by" integer,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"comment" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" integer,
	"actor_role" "user_role",
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"oem_id" integer,
	"oem_payment_id" integer,
	"milestone" text DEFAULT 'oem_payment_paid' NOT NULL,
	"base_amount" bigint DEFAULT 0 NOT NULL,
	"rate_percent" numeric(6, 2),
	"amount" bigint DEFAULT 0 NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"earned_at" timestamp with time zone,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"segment" text DEFAULT 'government' NOT NULL,
	"agency_code" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_line_item_id" integer,
	"invoice_id" integer,
	"stage" "fulfilment_stage" DEFAULT 'dispatched' NOT NULL,
	"status" "delivery_status" DEFAULT 'scheduled' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"scheduled_date" date,
	"actual_date" date,
	"owner_user_id" integer,
	"received_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"doc_type" "document_type" DEFAULT 'other' NOT NULL,
	"source" "document_source" DEFAULT 'obtained_from_oem' NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"reference_no" text,
	"oem_id" integer,
	"customer_id" integer,
	"requirement_id" integer,
	"order_id" integer,
	"product_name" text,
	"issue_date" date,
	"expiry_date" date,
	"renew_after_months" integer,
	"file_url" text,
	"processing_days" integer,
	"notes" text,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule" "follow_up_rule" NOT NULL,
	"title" text NOT NULL,
	"requirement_id" integer,
	"order_id" integer,
	"invoice_id" integer,
	"document_id" integer,
	"owner_user_id" integer,
	"due_date" date NOT NULL,
	"status" "follow_up_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fulfilment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_line_item_id" integer,
	"stage" "fulfilment_stage" NOT NULL,
	"state" "fulfilment_state" DEFAULT 'pending' NOT NULL,
	"owner_user_id" integer,
	"expected_date" date,
	"actual_date" date,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "government_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"quote_id" integer,
	"status" "government_response_status" DEFAULT 'submitted' NOT NULL,
	"response_date" date,
	"notes" text,
	"document_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_no" text NOT NULL,
	"order_id" integer NOT NULL,
	"invoice_type" "invoice_type" NOT NULL,
	"invoice_date" date,
	"due_date" date,
	"amount" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "loss_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" "loss_reason_code" NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "loss_reasons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "oem_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"oem_id" integer NOT NULL,
	"name" text NOT NULL,
	"role_title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oem_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"oem_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"part_number" text,
	"category" text,
	"unit_price" bigint,
	"currency" text DEFAULT 'INR' NOT NULL,
	"lead_time_days" integer,
	"capacity_per_month" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oem_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"requirement_line_item_id" integer NOT NULL,
	"oem_id" integer NOT NULL,
	"status" "sourcing_request_status" DEFAULT 'draft' NOT NULL,
	"request_ref" text,
	"method" text DEFAULT 'email' NOT NULL,
	"sent_at" timestamp with time zone,
	"due_by" date,
	"requested_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oem_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"oem_request_id" integer NOT NULL,
	"oem_id" integer NOT NULL,
	"requirement_id" integer NOT NULL,
	"requirement_line_item_id" integer NOT NULL,
	"response_type" "oem_response_type" NOT NULL,
	"response_date" date,
	"firm_quantity" integer DEFAULT 0 NOT NULL,
	"available_quantity" integer,
	"unit_price" bigint,
	"currency" text DEFAULT 'INR' NOT NULL,
	"lead_time_days" integer,
	"valid_until" date,
	"document_id" integer,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oem_responses_firm_nonneg" CHECK ("oem_responses"."firm_quantity" >= 0),
	CONSTRAINT "oem_responses_firm_requires_commitment" CHECK (("oem_responses"."response_type" <> 'firm_commitment') OR ("oem_responses"."firm_quantity" >= 0))
);
--> statement-breakpoint
CREATE TABLE "oems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"status" "oem_status" DEFAULT 'pending' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"products_supplied" text,
	"capabilities" text,
	"categories" text,
	"typical_lead_time_days" integer,
	"price_list_notes" text,
	"past_performance" text,
	"rating" integer,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oems_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "order_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"quote_line_item_id" integer,
	"requirement_line_item_id" integer NOT NULL,
	"part_number" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"oem_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"quote_id" integer NOT NULL,
	"requirement_id" integer NOT NULL,
	"customer_id" integer,
	"po_number" text NOT NULL,
	"po_date" date NOT NULL,
	"status" "order_status" DEFAULT 'open' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"delivery_deadline" date,
	"expected_completion_date" date,
	"oem_id" integer,
	"supplier_po_number" text,
	"supplier_po_date" date,
	"compliance_requirements" text,
	"inspection_requirements" text,
	"pdi_requirements" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer,
	"order_id" integer,
	"direction" "payment_direction" NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"paid_at" date,
	"due_date" date,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"reference" text,
	"method" text,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdi_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_line_item_id" integer,
	"pdi_ref" text NOT NULL,
	"status" "pdi_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_date" date,
	"completed_date" date,
	"quantity_offered" integer DEFAULT 0 NOT NULL,
	"quantity_cleared" integer DEFAULT 0 NOT NULL,
	"quantity_rejected" integer DEFAULT 0 NOT NULL,
	"inspector" text,
	"report_document_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdi_quantity_nonneg" CHECK ("pdi_records"."quantity_offered" >= 0 AND "pdi_records"."quantity_cleared" >= 0 AND "pdi_records"."quantity_rejected" >= 0),
	CONSTRAINT "pdi_cleared_plus_rejected_le_offered" CHECK ("pdi_records"."quantity_cleared" + "pdi_records"."quantity_rejected" <= "pdi_records"."quantity_offered")
);
--> statement-breakpoint
CREATE TABLE "qna_query_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"matched_intent" text,
	"params" jsonb,
	"answered" boolean DEFAULT false NOT NULL,
	"result_summary" text,
	"actor_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"requirement_line_item_id" integer NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"oem_id" integer,
	"oem_unit_price" bigint DEFAULT 0 NOT NULL,
	"freight_unit" bigint DEFAULT 0 NOT NULL,
	"other_unit" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"target_margin_percent" numeric(6, 2),
	"recommended_unit_price" bigint DEFAULT 0 NOT NULL,
	"final_unit_price" bigint DEFAULT 0 NOT NULL,
	"lead_time_days" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_no" text NOT NULL,
	"requirement_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"target_margin_percent" numeric(6, 2),
	"total_cost" bigint DEFAULT 0 NOT NULL,
	"total_recommended_price" bigint DEFAULT 0 NOT NULL,
	"total_final_price" bigint DEFAULT 0 NOT NULL,
	"valid_until" date,
	"notes" text,
	"supersedes_quote_id" integer,
	"submitted_at" timestamp with time zone,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"part_number" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'nos' NOT NULL,
	"technical_specs" text,
	"target_unit_price" bigint,
	"currency" text DEFAULT 'INR' NOT NULL,
	"hs_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_line_items_qty_positive" CHECK ("requirement_line_items"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "requirement_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"from_status" "requirement_status",
	"to_status" "requirement_status" NOT NULL,
	"note" text,
	"actor_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"customer_id" integer,
	"product_summary" text,
	"quantity_total" integer DEFAULT 0 NOT NULL,
	"required_delivery_date" date,
	"submission_deadline" timestamp with time zone,
	"tender_ref" text,
	"enquiry_ref" text,
	"technical_specs" text,
	"status" "requirement_status" DEFAULT 'received' NOT NULL,
	"priority" "requirement_priority" DEFAULT 'normal' NOT NULL,
	"owner_user_id" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loss_reason_code" "loss_reason_code",
	"loss_reason_notes" text,
	"loss_competitor" text,
	"loss_quoted_price" bigint,
	"loss_winning_price" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'sales' NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_oem_payment_id_payments_id_fk" FOREIGN KEY ("oem_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_order_line_item_id_order_line_items_id_fk" FOREIGN KEY ("order_line_item_id") REFERENCES "public"."order_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfilment_events" ADD CONSTRAINT "fulfilment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfilment_events" ADD CONSTRAINT "fulfilment_events_order_line_item_id_order_line_items_id_fk" FOREIGN KEY ("order_line_item_id") REFERENCES "public"."order_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfilment_events" ADD CONSTRAINT "fulfilment_events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfilment_events" ADD CONSTRAINT "fulfilment_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_responses" ADD CONSTRAINT "government_responses_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_responses" ADD CONSTRAINT "government_responses_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_responses" ADD CONSTRAINT "government_responses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_contacts" ADD CONSTRAINT "oem_contacts_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_products" ADD CONSTRAINT "oem_products_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_requests" ADD CONSTRAINT "oem_requests_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_requests" ADD CONSTRAINT "oem_requests_requirement_line_item_id_requirement_line_items_id_fk" FOREIGN KEY ("requirement_line_item_id") REFERENCES "public"."requirement_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_requests" ADD CONSTRAINT "oem_requests_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_requests" ADD CONSTRAINT "oem_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_responses" ADD CONSTRAINT "oem_responses_oem_request_id_oem_requests_id_fk" FOREIGN KEY ("oem_request_id") REFERENCES "public"."oem_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_responses" ADD CONSTRAINT "oem_responses_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_responses" ADD CONSTRAINT "oem_responses_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_responses" ADD CONSTRAINT "oem_responses_requirement_line_item_id_requirement_line_items_id_fk" FOREIGN KEY ("requirement_line_item_id") REFERENCES "public"."requirement_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oem_responses" ADD CONSTRAINT "oem_responses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_quote_line_item_id_quote_line_items_id_fk" FOREIGN KEY ("quote_line_item_id") REFERENCES "public"."quote_line_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_requirement_line_item_id_requirement_line_items_id_fk" FOREIGN KEY ("requirement_line_item_id") REFERENCES "public"."requirement_line_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_records" ADD CONSTRAINT "pdi_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_records" ADD CONSTRAINT "pdi_records_order_line_item_id_order_line_items_id_fk" FOREIGN KEY ("order_line_item_id") REFERENCES "public"."order_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qna_query_log" ADD CONSTRAINT "qna_query_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_requirement_line_item_id_requirement_line_items_id_fk" FOREIGN KEY ("requirement_line_item_id") REFERENCES "public"."requirement_line_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_oem_id_oems_id_fk" FOREIGN KEY ("oem_id") REFERENCES "public"."oems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supersedes_quote_id_quotes_id_fk" FOREIGN KEY ("supersedes_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_line_items" ADD CONSTRAINT "requirement_line_items_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_status_events" ADD CONSTRAINT "requirement_status_events_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_status_events" ADD CONSTRAINT "requirement_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "documents_expiry_idx" ON "documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "oem_requests_requirement_idx" ON "oem_requests" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "oem_responses_line_item_idx" ON "oem_responses" USING btree ("requirement_line_item_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_requirement_idx" ON "orders" USING btree ("requirement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_no_uq" ON "quotes" USING btree ("quote_no");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_requirement_version_uq" ON "quotes" USING btree ("requirement_id","version");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_line_items_uq" ON "requirement_line_items" USING btree ("requirement_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "requirements_ref_uq" ON "requirements" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "requirements_status_idx" ON "requirements" USING btree ("status");