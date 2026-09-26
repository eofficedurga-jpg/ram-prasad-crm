import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PgDatabase<any, typeof schema>;

type GlobalWithDb = typeof globalThis & {
  __ramPrismaDb?: Database;
  __ramPrismaMigrated?: boolean;
};

const g = globalThis as GlobalWithDb;

function isLocalMode(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return true;
  return url.startsWith("pglite://") || url.startsWith("pglite:");
}

function localDataDir(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.includes("://")) {
    const raw = url.replace(/^pglite:\/\//, "");
    if (raw && raw !== ".") return raw;
  }
  return "./.data/pgdata";
}

async function createLocalDb(): Promise<Database> {
  // Dynamic import so the WASM package is only loaded in local mode.
  const { PGlite } = await import("@electric-sql/pglite");
  const { runMigrationsOnClient } = await import("./migrate");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(localDataDir(), { recursive: true });
  const client = new PGlite({ dataDir: localDataDir() });
  await client.waitReady;
  if (!g.__ramPrismaMigrated) {
    await runMigrationsOnClient({
      exec: async (sqlText) => {
        await client.exec(sqlText);
      },
      query: async (sqlText) => (await client.query(sqlText)).rows as Record<string, unknown>[],
    });
    g.__ramPrismaMigrated = true;
  }
  return drizzlePglite(client, { schema }) as unknown as Database;
}

function createRemoteDb(): Database {
  const client = postgres(process.env.DATABASE_URL as string, {
    max: 5,
    prepare: false,
  });
  return drizzlePostgres(client, { schema }) as unknown as Database;
}

export function getDb(): Database {
  if (g.__ramPrismaDb) return g.__ramPrismaDb;
  if (isLocalMode()) {
    // Local init is async; callers use getDbAsync(). This branch is a guard.
    throw new Error(
      "Local Postgres (PGlite) must be initialized with getDbAsync() on first use.",
    );
  }
  g.__ramPrismaDb = createRemoteDb();
  return g.__ramPrismaDb;
}

let initPromise: Promise<Database> | null = null;

export function getDbAsync(): Promise<Database> {
  if (g.__ramPrismaDb) return Promise.resolve(g.__ramPrismaDb);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = isLocalMode() ? await createLocalDb() : createRemoteDb();
    g.__ramPrismaDb = db;
    return db;
  })();
  return initPromise;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
