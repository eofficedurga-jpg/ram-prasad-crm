# Tech Stack

## Summary

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | One codebase for UI and server logic, deploys to Vercel/Netlify as requested. |
| Styling | **Tailwind CSS 3** | Fast, consistent, no runtime CSS. |
| Database | **PostgreSQL** (Supabase or Neon in production) | Requested; relational fits the strongly-related lifecycle. |
| DB access | **Drizzle ORM** + SQL migrations | Typed schema, plain-SQL migrations, no magic. |
| Local DB | **PGlite** (`@electric-sql/pglite`) — embedded real Postgres in WASM | Lets the app run and be verified with zero external DB, persisted to disk so it survives refresh/restart. Same SQL as hosted Postgres. |
| Remote DB driver | **postgres.js** | Used when `DATABASE_URL` points at Supabase/Neon. |
| Auth | **Custom session cookies** signed with `jose` (HS256 JWT), passwords hashed with `bcryptjs`, roles in DB | "Auth included" without a third-party dependency; server-side role checks. |
| Validation | **Zod** | Shared input validation on server actions/route handlers. |
| Dates/format | `date-fns` | Date math for SLA/risk/expiry rules. |
| Charts | none (plain tables/panels) | Dashboard is operational, not analytical; keeps bundle small. Optional later. |

## Why Postgres-for-both (durability requirement)

The brief requires "keep the data in Postgres so it survives a refresh." Two facts drive the design:

1. Hosted environments (Vercel/Netlify) are stateless; the DB must be external — Supabase/Neon.
2. The build/verification environment here has no Docker/Postgres and no cloud credentials.

So the DB client is chosen at runtime:

```
DATABASE_URL unset or pglite://...  -> PGlite, persisted under .data/pgdata  (local/dev/demo)
DATABASE_URL = postgres://...        -> postgres.js (Supabase / Neon / any Postgres)
```

Both paths speak the same Postgres dialect and run the same Drizzle schema/migrations. Moving to production is only an env change.

## Dependency list

Runtime: `next`, `react`, `react-dom`, `drizzle-orm`, `@electric-sql/pglite`, `postgres`, `jose`, `bcryptjs`, `zod`, `date-fns`.
Dev: `typescript`, `@types/*`, `tailwindcss`, `postcss`, `autoprefixer`, `drizzle-kit`, `tsx`.

## Environments

- `.env.local` (never committed): `DATABASE_URL`, `SESSION_SECRET`.
- `.env.example` documents both, with a Supabase and a Neon example connection string.

## Deployment notes

- Vercel/Netlify: set `DATABASE_URL` (Supabase/Neon pooled connection string) and `SESSION_SECRET`. Run `npm run db:migrate` once against the hosted DB (or via a build step).
- Do not deploy PGlite to serverless; it is for local/dev/demo only.
