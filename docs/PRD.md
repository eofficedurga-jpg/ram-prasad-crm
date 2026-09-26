# PRD — Ram Prasad CRM (Defence Contract Consultancy)

Status: v1.0, written from the requirement brief.
Owner: Ram Prasad (business owner / management)
Builder note: This PRD interprets the brief and resolves the open questions with documented assumptions (see §12). No workbook/sheets were supplied in the build environment, so the data model is designed to accept their columns rather than assume them.

---

## 1. Problem

Ram Prasad is a defence contract consultant. Government and defence agencies send him requirements; he fulfils them through a network of OEM suppliers. The business currently runs on Excel, email and memory.

Throughput (monthly): ~25–30 enquiries, ~20 quotations, ~10 orders, 20–25 active orders at any time.

Pain:
- Quotation prep takes 3–4 days (partly because it is never urgent).
- OEM communication takes 1–10 days.
- Document creation takes about a week.
- Follow-ups consume 3–4 hours a day.
- History is not searchable, so every new quote starts from scratch.
- Nothing enforces that OEMs have actually covered the quantity before a bid is committed.

The fix is **one requirement, one record, one timeline**: a single central record (the RFI / tender requirement) that every downstream artifact hangs off — OEM sourcing, quote, PO, PDI/inspection, delivery, payment and commission. History becomes searchable, and the dangerous gaps (uncovered quantity, missing OEM commitments, orphan POs, expiring compliance documents) become visible.

## 2. Goals and non-goals

Goals:
1. Replace Excel/email/memory as the system of record.
2. Cut quote prep time by reusing comparable past bids and OEM data.
3. Make quantity coverage explicit and impossible to over-commit silently.
4. Track every requirement from receipt to acceptance with owners, dates and audit.
5. Surface delivery risk, follow-ups, payments and document expiry proactively.
6. Answer plain-language questions from stored data only.

Non-goals (explicitly out of scope, per brief):
- No automatic legal or compliance judgement.
- No automatic final bid price.
- No OEM selected without human approval.
- Not a full accounting/ERP replacement.
- Not a generic document generator.
- No government-portal automation or auto-messaging as a baseline requirement.

## 3. Users and roles

| Role | Primary jobs | Approval rights |
|---|---|---|
| Owner / management | Everything, oversight, final approvals | Quote, order, document, compliance |
| Sales | Requirements, quotes, bid intelligence, follow-ups, loss reasons | Quote (submit for approval), loss reason |
| Operations | OEM sourcing, commitments, POs, PDI, delivery | Order, PO, PDI |
| Finance | Payments, invoices, commission, document/compliance vault | Payment, document, compliance |

Roles are enforced server-side on every mutating action; the audit trail records actor and role.

## 4. Central entity and relationships

The **requirement (RFI/tender)** is the root. Cardinality:

```
Requirement 1─* RequirementLineItem
Requirement 1─* OemRequest (sourcing)  ─* OemResponse
OemRequest   *─1 Oem
Requirement 1─* Quote ─* QuoteLineItem
QuoteLineItem *─1 RequirementLineItem
RequirementLineItem 1─* Commitment (firm, quantity)
RequirementLineItem 1─* Availability (indication only)
Quote 1─0..1 Order          (no orphan PO: an order always maps to an approved quote)
Order 1─* Invoice           (multiple invoices per PO)
Invoice 1─* DeliveryEvent   (one invoice fulfilled by several deliveries)
Order 1─* FulfilmentEvent   (timeline / PDI / inspection / delivery)
Requirement/Order/Invoice *─* Payment
Oem 1─* CommissionEntry     (earned on an OEM-payment milestone)
Document *─1 (Supplier, Product, Requirement)
ApprovalRequest *─1 approvable entity
AuditLog *─1 entity
FollowUpTask *─1 (Requirement | Order | Invoice | Document)
```

Comments on each requirement/order/quote form the timeline; the audit log records material changes.

## 5. Functional requirements

Statuses are explicit enumerations; transitions are validated server-side.

### 5.1 Requirement and RFI (module 1 — must-have)
- Capture: customer/agency, product/title, quantity, required delivery date, technical specifications, tender/enquiry reference, submission deadline, documents, priority.
- Many line items per requirement, **up to 500 part numbers**, each with part number, description, quantity, unit, specs, HSN/NSN-like ref, target price.
- A requirement cannot be saved with more than 500 line items.
- Statuses: `received → qualifying → quoted → submitted → won | lost | cancelled`.
- Requirement timeline shows status changes, sourcing, quotes, orders, follow-ups.

### 5.2 OEM master and sourcing (module 2 — must-have)
- OEM record: name, products supplied, capabilities, price lists, typical lead time, compliance documents, contacts, past performance, approved flag, categories.
- From a requirement, shortlist approved/eligible OEMs by capability/product match.
- Create an OEM request per line item; record the request (sent date, method) and the response (date, price, lead time, firm quantity, availability indication, notes, document).
- **Firm commitment and availability indication are separate fields with separate semantics.** A firm commitment contributes to coverage; an availability indication does not.

### 5.3 Quantity coverage (module 3 — must-have, the hard part)
- Per requirement line item: required quantity vs sum of firm OEM commitments, coverage and uncovered balance.
- Example: 1,000 required; OEM A 600 firm; OEM B 400 firm → coverage 1,000, uncovered 0.
- Multiple OEMs and multiple shipments may cover one line item.
- Coverage is computed live from commitments (never cached incorrectly) and also maintained as a per-line-item rollup for list views.
- A quote cannot be submitted for approval while uncovered quantity > 0 for the requirement, unless the owner explicitly overrides with a recorded reason (**override is an approval event**, audited).
- Covering a quantity across several orders is supported; see §12 open question and the chosen capacity model.

### 5.4 Quotation and bid intelligence (module 4 — must-have)
- Build a quote from the requirement. Each quote line item references a requirement line item and carries OEM cost, lead time, target margin, recommended price and final price.
- Recommended price = f(OEM price, target margin, quantity, freight/other), computed by a documented, deterministic formula — never auto-finalised (human sets final price).
- **Bid intelligence**: before pricing, show comparable past bids (same product/part/category/customer), what was quoted, won/lost, and the winning or losing price. He changes the bid from that history.
- Quotes are versioned (v1, v2, …). An approved quote is immutable; changes create a new version.
- Quote approval workflow with Approvals.

### 5.5 Government response and follow-up (module 5 — must-have)
- Post-submission states: `submitted`, `clarification_requested`, `technical_clarification`, `commercial_negotiation`, `awaiting_approval`, `won`, `lost`, `cancelled`.
- Response events are logged against the requirement/quote with date, type, notes, document.
- Automatic follow-up tasks on rules, e.g. "no response for 7 days", "document requested but not sent", "clarification overdue", "submission deadline approaching". Tasks have owner, due date, state and link.

### 5.6 Order and PO (module 6 — must-have)
- Convert an **approved** quote to an order. The whole history (requirement, line items, commitments, quote versions, documents) travels with it and is visible from the order.
- **No orphan PO**: `order.quote_id` is required and must reference an approved quote. Enforced by DB constraint + server validation.
- Track PO number and date, product, quantity, price, delivery deadline, OEM selected, supplier PO number/date, compliance requirements, inspection and PDI requirements.
- One PO can have multiple invoices.

### 5.7 Fulfilment, PDI and delivery (module 7 — must-have)
- Fulfilment timeline per order/line item: `OEM PO placed → production started → production done → PDI scheduled → PDI passed → government inspection → dispatch → delivered → accepted`. Each step has an owner and an expected date, actual date, notes.
- PDI is quantified: quantity offered, cleared, rejected. Cleared ≠ offered and cleared ≠ rejected. Rejected balance remains outstanding.
- A failed or held PDI blocks dispatch (dispatch cannot be recorded while PDI state is `failed`/`held` unless owner override, audited).
- Partial deliveries are supported; outstanding balance (ordered − delivered − accepted) is always visible.
- **Delivery risk flag**: expected completion date vs committed deadline; risk shown as `on_track`, `at_risk`, `late`, computed from dates and outstanding quantity.

### 5.8 Payments, commission and documents (module 8 — must-have)
- Partial payments supported, with due dates and reminders; invoice outstanding balance visible.
- One invoice can be fulfilled by several delivery events (delivery can partially fulfil an invoice).
- Payments recorded against invoice/order; customer receipts and OEM payments are distinct directions.
- Commission entry created/earned on an **OEM-payment milestone** (configurable: e.g. on OEM payment marked paid), not on customer payment. Commission has base amount, rate/amount, milestone reference and state.
- Document and compliance vault: type, supplier, product, requirement, issue date, expiry date, file/link, status; expiry reminders (e.g. 90/60/30 days). Approved item lists that renew every 3–5 years are represented as documents with a renew-after period.

### 5.9 Search, history and losses (module 9 — must-have)
- Search across requirements, line items, OEMs, quotes, orders, documents by free text plus filters.
- Comparable-requirement search surfaces past OEM, price, delivery time, margin, documents and problems.
- Structured loss reasons when an opportunity is lost: `price`, `technical_non_compliance`, `delivery_timeline`, `competitor_preference`, `quantity_capacity`, `cancelled`, `not_pursued`, `other` (labels configurable; see §12).
- Loss analysis: counts and value by reason, by period, by customer/competitor.

### 5.10 Dashboard and plain questions (module 10 — must-have)
Morning view:
- Open orders and their state.
- Quotes awaiting a response.
- Orders at delivery risk.
- Payments pending (receivable and payable).
- OEM responses pending.
- Documents expiring.
Plain-language Q&A (deterministic, from stored data only, no invention):
- "how many orders are there?"
- "how many contracts did we win this month?"
- "what did we lose?"
- "why did we lose them?"
The Q&A layer maps the question to a whitelisted, parameterised query. If it cannot map the question to stored data, it says so — it never fabricates.

### 5.11 Roles, approvals and audit (module 11 — must-have)
- Roles as §3. Permissions matrix enforced server-side.
- Approval requests on: quotes (approve to submit), documents, orders, compliance items. Approval states: `pending`, `approved`, `rejected`, with approver, comment, timestamp.
- **Audit trail** of material changes: entity, entity id, action, field diff (before/after), actor, role, timestamp, reason. Material = status changes, price/margin changes, quantity commitment changes, approvals, overrides, payment/commission changes, document changes, OEM approval changes.

## 6. Rules that must hold (acceptance criteria)

R1. Every quotation comes from an RFI. (`quote.requirement_id` NOT NULL, FK.)
R2. Every PO maps to an approved quotation. (`order.quote_id` NOT NULL, FK, and the quote status must be `approved` at creation.)
R3. Many line items per requirement (≤500 each), many invoices per PO, many deliveries per invoice.
R4. Partial deliveries and partial payments are normal; balances are always visible.
R5. Quantity balance visible across the whole lifecycle: requested, quoted, committed, ready, inspected (cleared), invoiced, delivered, accepted.
R6. PDI cleared is distinct from offered and rejected.
R7. Repeat requirements reference history; loss reasons are structured enumerations.
R8. OEM firm commitments are distinct from availability indications.
R9. Commission follows an OEM-payment milestone.
R10. Document expiry is trackable; important activity is audited.
R11. No silent over-commitment of quantity; uncovered balance is always shown and blocks approval without a recorded override.
R12. No automatic final bid price and no automatic compliance/legal judgement.

## 7. Non-functional requirements

- **Persistence**: data lives in Postgres (Supabase/Neon in production; embedded Postgres locally) and survives refresh and restart.
- **Correctness**: all money/quantity arithmetic server-side; quantity rolls computed from source rows, never trusted from the client.
- **Auditability**: every material mutation writes an audit row in the same transaction.
- **Empty vs missing vs failed**: list/table UIs must distinguish "no data" (empty state), "not loaded/missing" (data not yet fetched), and "failed" (error state) — three distinct states on screen.
- **Security**: server-side authorization on every action; passwords hashed; sessions signed and httpOnly; no secrets in client bundles.
- **Performance**: 500 line items per requirement must render and edit acceptably (server-paginated/virtualised line tables).
- **Portability**: same schema and queries for local and hosted Postgres; only `DATABASE_URL` changes.
- **Accessibility/i18n**: English (India) formatting for currency (INR) and dates.

## 8. Data model (summary)

Core tables (see `src/db/schema.ts` for the executable source of truth):

- `users`, `sessions`
- `customers`
- `requirements`, `requirement_line_items`, `requirement_status_events`
- `oems`, `oem_products`, `oem_contacts`, `oem_documents`
- `oem_requests`, `oem_responses`
- `commitments` (firm) *(part of oem_responses as typed rows)*, `availability_indications` *(typed rows)*
- `quotes`, `quote_line_items`, `quote_versions`
- `orders`, `invoices`, `delivery_events`, `fulfilment_events`, `pdi_records`
- `payments`, `commission_entries`
- `documents`
- `loss_reasons` (requirement-level)
- `follow_up_tasks`
- `approval_requests`
- `audit_logs`
- `qna_query_log` (records what was asked and which stored query answered it)

Money stored as integer minor units (paise) plus currency; quantities as integers. Dates as `date`/`timestamptz`.

## 9. Key screens / information architecture

1. Dashboard — the morning view + ask box.
2. Requirements — list, create, detail (overview, line items ≤500, sourcing, coverage, quotes, responses, orders, documents, timeline, loss reason).
3. Coverage workbench — per line item, required vs committed vs uncovered, add commitment/availability.
4. OEM directory — master records, capabilities, documents, past performance, approved flag.
5. Quotes — builder, version list, bid intelligence panel, approval.
6. Responses & follow-ups — inbox and task list.
7. Orders & POs — list, detail with history, invoices.
8. Fulfilment — timeline, PDI records, deliveries, risk.
9. Finance — invoices, payments, commission.
10. Documents & compliance — vault, expiry.
11. Search & history.
12. Admin — users/roles, approval queue, audit log, enumerations.

## 10. Metrics of success

- Time to produce a quote (target: days → hours) measured by requirement `received_at` to quote `approved_at`.
- % of quotes with all line items fully covered before submission.
- Follow-up hours/day reduced via auto-tasks.
- Overdue follow-ups and delivery risks surfaced to zero-lookup.
- Loss reasons captured for 100% of losses.
- No orphan POs, no uncovered committed bids.

## 11. Milestones

M1 (must-have): modules 1–3 — requirement/RFI, OEM master/sourcing, quantity coverage.
M2 (must-have): modules 4–5 — quotes/bid intelligence, responses/follow-ups.
M3 (must-have): modules 6–8 — orders/PO, fulfilment/PDI, payments/commission/documents.
M4 (must-have): modules 9–11 — search/history/losses, dashboard/Q&A, roles/approvals/audit.
M5: hardening, 500-line-item performance, import from historical Excel columns.

## 12. Open questions — resolved with assumptions

The brief lists open questions. I have chosen defensible defaults so the system can be built now, and made each one configurable/auditable so a real transaction can correct it later.

1. **Global vs per-order OEM capacity.** Assumption: **global capacity with per-requirement allocation visibility.** The system derives each OEM's committed total across all live orders for a product, then shows `available_to_commit = capacity − committed_elsewhere`. The coverage workbench shows both the per-requirement coverage and the global availability. Configurable: an OEM capacity figure can be blank (unknown), in which case only the global committed total is shown and the UI says capacity is unknown rather than assuming unlimited.
2. **Who invoices whom / when commission is earned.** Assumption: Ram's entity invoices the **customer**; the **OEM** invoices Ram's entity (supplier PO). Commission is earned on the configured **OEM-payment milestone** (`payment to OEM marked paid`), not on customer receipt. Every transaction stores both directions (receivable from customer, payable to OEM) so one real transaction can be replayed and the milestone config changed.
3. **Which documents consume the week.** The vault separates four `document.source` kinds: `generated_from_data`, `reused`, `obtained_from_oem`, `prepared_by_hand`, plus processing time captured per document, so the real bottleneck can be measured rather than assumed.
4. **Loss-reason labels.** The brief's list is implemented as editable reference data seeded with the eight given labels, so his actual vocabulary can replace them without code changes.
5. **Trustworthy historical Excel columns.** Not supplied in this environment. The importer and analysis fields are defined per column with a `trusted` flag and a source column name, so only confirmed columns drive win/loss and price comparison. Until then, comparisons use only records created in-app (which are complete by construction).
6. **PDI/dispatch interaction and overrides.** A failed/held PDI blocks dispatch; owner may override with a mandatory reason, which is an audited approval event.

## 13. What not to build (guardrails)

- No automatic legal/compliance judgement.
- No automatic final bid price (recommendation is advisory; final price is human-entered and approved).
- No OEM auto-selection (shortlist is suggested; selection is human-approved).
- No accounting/ERP replacement (no ledgers, journals, tax filing).
- No generic document generator (documents are recorded/tracked, not authored as a word processor).
- No government-portal automation or auto-messaging baseline.
