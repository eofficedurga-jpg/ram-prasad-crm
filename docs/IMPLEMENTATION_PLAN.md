# Implementation Plan

Build order follows the brief: the first three modules matter most.

## Phase 0 — Foundation
1. Scaffold Next.js 15 + TypeScript + Tailwind; env handling.
2. `db/schema.ts` with every table, enum and constraint; migrations runner.
3. DB client that selects PGlite (local) or postgres.js (hosted).
4. Reference-data seed (statuses, loss reasons, roles, demo dataset).
5. Auth: users, sessions, roles, login page, `requireRole`.

## Phase 1 — Modules 1–3 (must-have)
6. Requirements list/create/detail; ≤500 line items with server pagination.
7. Requirement status machine + events + timeline.
8. OEM master: directory, capabilities, documents, approved flag, contacts.
9. Sourcing: shortlist by capability, create OEM request, record responses.
10. Firm commitments vs availability indications (separate types).
11. **Coverage workbench**: required / committed / uncovered / coverage %, per line item and rolled up; global OEM availability; block submit on uncovered unless overridden.

## Phase 2 — Modules 4–5 (must-have)
12. Quote builder from requirement; line items linked to requirement line items; client/server price math.
13. Deterministic recommended price (advisory). Final price human-set.
14. Bid intelligence: comparable past bids (quoted/won/lost/win price) with trusted-column flag.
15. Quote versioning + approval workflow.
16. Government response states + response events.
17. Follow-up rule engine and task inbox.

## Phase 3 — Modules 6–8 (must-have)
18. Approved quote → order; orphan-PO prevention; supplier PO fields.
19. Invoices per PO; delivery events per invoice; partial balances.
20. Fulfilment timeline with owner + expected/actual dates.
21. PDI records (offered/cleared/rejected) + dispatch blocking.
22. Delivery risk computation and labels.
23. Payments (both directions), partial payments, due dates, reminders.
24. Commission on OEM-payment milestone.
25. Document/compliance vault with expiry + reminders + source-kind analytics.

## Phase 4 — Modules 9–11 (must-have)
26. Global search + comparable-history search; structured loss reasons + loss analysis.
27. Dashboard (morning view) + deterministic plain-language Q&A.
28. Approvals queue + audit log viewer.
29. Roles matrix enforcement across all actions.

## Phase 5 — Hardening
30. 500-line-item performance check; pagination everywhere.
31. Empty/missing/failed states audit across all screens.
32. Excel-column importer scaffolding with `trusted` flags (for the historical workbook).
33. `npm run build` clean; README; deployment notes.

## Verification
- `npm run build` must pass (typecheck + lint included).
- Seed a demo dataset and walk: requirement → OEM requests → coverage to 100% → quote → approve → order/PO → invoice → PDI → delivery → payment → commission → dashboard/Q&A → search/loss.
- Assert the acceptance criteria R1–R12 in `docs/PRD.md` §6 via seeded scenarios and a rules test script.
