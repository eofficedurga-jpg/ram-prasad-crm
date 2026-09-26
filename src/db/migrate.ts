import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");
const BREAKPOINT = "--> statement-breakpoint";

export type MigrationAdapter = {
  /** Execute one or more statements. */
  exec: (sqlText: string) => Promise<void>;
  /** Run a query and return rows. */
  query: (sqlText: string) => Promise<Record<string, unknown>[]>;
};

function migrationFiles(): string[] {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

export function migrationStatements(): { file: string; statements: string[] }[] {
  return migrationFiles().map((file) => {
    const content = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    return {
      file,
      statements: content
        .split(BREAKPOINT)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
}

/**
 * Applies each migration file once, tracked in a `_migrations` ledger, so a new
 * process (dev server, CLI, seed) does not re-run CREATE TYPE and fail.
 */
export async function runMigrationsOnClient(adapter: MigrationAdapter): Promise<number> {
  await adapter.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const appliedRows = await adapter.query(`SELECT name FROM _migrations`);
  const applied = new Set(appliedRows.map((r) => String(r.name)));
  let count = 0;
  for (const { file, statements } of migrationStatements()) {
    if (applied.has(file)) continue;
    for (const statement of statements) {
      await adapter.exec(statement);
      count += 1;
    }
    await adapter.exec(`INSERT INTO _migrations (name) VALUES ('${file.replace(/'/g, "''")}')`);
  }
  return count;
}

export async function runMigrationsCli(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("pglite")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    const dir = url ? url.replace(/^pglite:\/\//, "") : "./.data/pgdata";
    mkdirSync(dir, { recursive: true });
    const client = new PGlite({ dataDir: dir });
    await client.waitReady;
    const count = await runMigrationsOnClient({
      exec: async (s) => {
        await client.exec(s);
      },
      query: async (s) => (await client.query(s)).rows as Record<string, unknown>[],
    });
    console.log(`Applied ${count} migration statement(s) to local PGlite (${dir}).`);
    return;
  }
  const postgres = (await import("postgres")).default;
  const client = postgres(url, { max: 1, prepare: false });
  const count = await runMigrationsOnClient({
    exec: async (s) => {
      await client.unsafe(s);
    },
    query: async (s) => (await client.unsafe(s)) as unknown as Record<string, unknown>[],
  });
  await client.end();
  console.log(`Applied ${count} migration statement(s) to ${url.split("@").pop()}.`);
}

const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("db/migrate.ts");

if (invokedDirectly) {
  runMigrationsCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
