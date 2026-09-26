# Ram Prasad CRM — Defence Contract Consultancy

One requirement, one record, one timeline.

A CRM for a defence contract consultant. Government/defence agencies send requirements;
Ram fulfils them through a network of OEM suppliers. This system replaces Excel, email and
memory with a single central record (the RFI / tender requirement) that every downstream
artifact hangs off: OEM sourcing, quote, PO, PDI/inspection, delivery, payment and commission.

## Documents

- `docs/PRD.md` — problem, users, modules, rules, data model, resolved open questions.
- `docs/TECH_STACK.md` — stack and why.
- `docs/ARCHITECTURE.md` — layering, invariants, timelines, states.
- `docs/IMPLEMENTATION_PLAN.md` — build order.

## Stack

Next.js 15 (App Router, React 19, TypeScript) · Tailwind CSS · PostgreSQL via Drizzle ORM ·
embedded **PGlite** for local/dev (real Postgres, persisted to disk) · `postgres.js` for
Supabase/Neon · session-cookie auth (`jose` + `bcryptjs`) with server-side roles.

## Quick start

```bash
npm install
npm run db:setup     # create schema + seed demo data (used only on the first run)
npm run dev          # http://localhost:3000
```

Demo accounts (password `password123`):

| Email | Role |
|---|---|
| owner@ramprasad.in | Owner / management |
| sales@ramprasad.in | Sales |
| ops@ramprasad.in | Operations |
| finance@ramprasad.in | Finance |

Other scripts:

```bash
npm run build        # production build (typecheck + lint included)
npm run typecheck    # tsc --noEmit
npm run rules:test   # acceptance-rule checks (13 checks, no framework)
npm run db:migrate   # apply migrations only
npm run db:seed      # seed demo data (skips if already seeded)
```

## Features (the 11 modules)

1. **Requirement & RFI** — customer/agency, product, dates, tender/enquiry refs, specs,
   documents; up to 500 line items per requirement; statuses received → qualifying → quoted →
   submitted → won/lost/cancelled; timeline.
2. **OEM master & sourcing** — products, capabilities, prices, lead time, compliance docs,
   contacts, past performance, approved flag; shortlist from a requirement; record each
   request and response.
3. **Quantity coverage** — required vs firm committed vs uncovered per line item, and rolled
   up; multiple OEMs and shipments per requirement; **firm commitment is distinct from an
   availability indication** (indications never count); global capacity view nets off
   commitments made elsewhere; a quote cannot be submitted while quantity is uncovered unless
   the owner records an audited override.
4. **Quotation & bid intelligence** — build a quote from the requirement; deterministic
   recommended price (advisory, never auto-final); comparable past bids (quoted, won/lost,
   winning price); versioning and approval.
5. **Government response & follow-up** — submitted, clarification requested, technical
   clarification, commercial negotiation, awaiting approval, won, lost, cancelled; rule-based
   follow-up tasks (no response 7 days, document requested, deadlines, payments, expiry).
6. **Order & PO** — approved quote → order; **no orphan PO**; PO number/date, product,
   quantity, price, deadline, OEM, supplier PO, compliance/inspection/PDI requirements;
   multiple invoices per PO.
7. **Fulfilment, PDI & delivery** — timeline (OEM PO placed → accepted) with owner and
   expected/actual dates; PDI quantified (offered / cleared / rejected, distinct); failed or
   held PDI blocks dispatch (override is audited); partial deliveries with outstanding
   balance; delivery-risk flags (on track / at risk / late).
8. **Payments, commission & documents** — partial payments, due dates, reminders; one invoice
   fulfilled by several deliveries; commission earned on the **OEM-payment milestone**; a
   document/compliance vault with type, supplier, issue/expiry, renew period and reminders.
9. **Search, history & losses** — search across everything; comparable-requirement history by
   part number (OEM, price, delivery, margin, documents, problems); structured loss reasons
   and loss analysis.
10. **Dashboard & plain questions** — the morning view (open orders by state, quotes awaiting
    response, orders at risk, payments pending, OEM responses pending, documents expiring);
    a deterministic plain-language Q&A that answers only from stored data and says so when it
    cannot.
11. **Roles, approvals & audit** — owner/management, sales, operations, finance enforced
    server-side; approvals on quotes, documents, orders, compliance; full audit trail of
    material changes (what, who, when, before/after, reason).

### What it deliberately does not do

No automatic legal/compliance judgement, no automatic final bid price, no OEM chosen without
human approval, not an accounting/ERP replacement, not a generic document generator, no
government-portal automation.

## Data and durability

Money is stored as integer minor units (paise); quantities as integers; every list view
computes balances from source rows, never from client input. Same schema and queries run on
local and hosted Postgres — only `DATABASE_URL` changes.

```
DATABASE_URL unset or pglite://…   → PGlite, persisted under .data/pgdata   (local/dev/demo)
DATABASE_URL = postgres://…         → postgres.js (Supabase / Neon / any Postgres)
```

### Important local-mode caveat

PGlite is a single-process embedded Postgres. Run the seed **before** starting the dev server,
and do not write to the same `.data/pgdata` from a second process while the server is running.
For multi-process/concurrent use (and for production), point `DATABASE_URL` at Supabase/Neon.

## Deployment

Deployed on Vercel with a Neon Postgres database (provisioned through the Vercel
Marketplace integration, which injects `DATABASE_URL` into all environments):

- Production: https://ram-prasad-crm.vercel.app

Required environment variables: `DATABASE_URL` and `SESSION_SECRET` (both set in
Vercel for production, preview and development).

To deploy your own copy:

1. Create a Postgres database on Neon or Supabase.
2. Set environment variables (see `.env.example`): `DATABASE_URL`, `SESSION_SECRET`.
3. Run migrations once against it: `DATABASE_URL=... npm run db:migrate`
   (and `npm run db:seed` only if you want the demo dataset).
4. Deploy to Vercel/Netlify, or with the CLI: `vercel --prod`.

Useful commands:

```bash
vercel env pull .env.production.local --environment=production   # local copy of prod env
vercel logs <deployment-url>                                      # runtime logs (Pro)
npx tsx scripts/setpassword.ts <new-password> [email]             # set a password (all users if no email)
```

Note: `db:seed` is demo data only. Before sharing a public URL, rotate the seeded
credentials with `scripts/setpassword.ts` and create real users from Admin.

## Verification

- `npm run build` passes (typecheck + compile).
- `npm run rules:test` passes 13 acceptance checks (the 1,000 = 600 + 400 coverage example,
  indications excluded, submit gate, global capacity, pricing, risk, PDI blocking, follow-up
  rules, Q&A from data only, 500-line limit).
- Seeded end-to-end walkthrough: requirement → OEM requests → coverage → quote → approve →
  order/PO → invoice → PDI → delivery → payment → commission → dashboard/Q&A → search/loss.
