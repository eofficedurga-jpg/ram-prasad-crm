# Architecture

## Shape

```
Browser
  │  (React Server Components + Server Actions)
  ▼
Next.js App Router (server)
  ├── auth/session (jose cookie, role checks)
  ├── domain services (coverage, pricing, risk, follow-ups, qna)
  ├── audit (in-transaction)
  └── db client  ──► PGlite (local, .data/pgdata)
                 └─► postgres.js (Supabase / Neon)
```

- **Reads** are React Server Components that query the DB directly (no client fetch waterfalls).
- **Writes** are Server Actions (or route handlers) that validate with Zod, enforce permissions, run the domain rule, write the audit row, and revalidate the page.
- **No business rule lives only in the UI.** Coverage, pricing, PDI blocking, orphan-PO prevention and approval gating are enforced server-side (DB constraints + service functions).

## Layering

```
src/
  app/            routes, pages, server actions ("use server")
  components/     presentational + small client components
  db/
    schema.ts     Drizzle tables, enums, constraints (source of truth)
    client.ts     PGlite/postgres.js selection + singleton
    migrate.ts    migration runner
    seed.ts       demo data + reference data
  domain/
    coverage.ts   required vs firm committed vs uncovered; global availability
    pricing.ts    recommended price (deterministic, advisory only)
    risk.ts       delivery risk (on_track/at_risk/late)
    followups.ts  rule-based task generation
    pdi.ts        PDI quantities + dispatch blocking
    qna.ts        plain-language question -> whitelisted stored query
    audit.ts      writeAudit()
  lib/
    auth.ts       session create/verify, getCurrentUser, requireRole
    format.ts     INR/date formatting
    enums.ts      labels for statuses/loss reasons
    validate.ts   zod schemas
```

## Key invariants (enforced where)

| Invariant | Enforcement |
|---|---|
| Quote belongs to a requirement | FK `quotes.requirement_id NOT NULL` |
| Order belongs to an approved quote (no orphan PO) | FK `orders.quote_id NOT NULL` + service check that quote status = approved |
| ≤500 line items per requirement | service check on insert + count check |
| Coverage = Σ firm commitments; availability excluded | `domain/coverage.ts` (single implementation, reused everywhere) |
| No submit with uncovered qty | quote submit action checks coverage; owner override writes an audit + approval event |
| PDI failed/held blocks dispatch | `domain/pdi.ts` + dispatch action |
| Commission on OEM-payment milestone | commission entry created by payment action when direction = payable_to_oem and it is marked paid |
| Partial balances | derived: ordered − delivered − accepted; invoiced − paid |
| Audit of material change | every service mutation calls `writeAudit` in the same DB transaction |

## Timeline

Every requirement and order has a composed timeline built from:
`requirement_status_events`, `oem_requests/responses`, `quote_versions`, `fulfilment_events`, `pdi_records`, `payments`, `delivery_events`, `documents`, `follow_up_tasks`, `audit_logs`.
The requirement timeline is the union, sorted by time — "one record, one timeline."

## Empty / missing / failed states

Each table/panel receives an explicit status:
- `ok` with rows → render rows.
- `ok` with zero rows → **empty state** ("No OEM responses yet — create a request").
- `loading` → **skeleton** (route-level `loading.tsx`).
- `error` → **failed state** with the error message and a retry, never a blank table.

This is implemented with a shared `<DataState>` component and server-side error boundaries.

## Security

- `SESSION_SECRET` signs a JWT held in an httpOnly, sameSite=lax, secure-in-prod cookie.
- `requireUser()` / `requireRole()` guard every server action and protected route.
- All SQL is parameterised via Drizzle.
- No secrets or DB URLs in client components.
