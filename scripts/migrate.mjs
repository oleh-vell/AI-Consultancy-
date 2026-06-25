// Applies SQL migrations in db/migrations in filename order. Each file runs
// once, inside a transaction, and is recorded in schema_migrations.
//
//   node scripts/migrate.mjs           apply pending migrations
//   node scripts/migrate.mjs --reset   DROP the public schema first (clean slate)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, connect, ROOT } from "./db.mjs";

loadEnv();

const reset = process.argv.includes("--reset");
const MIGRATIONS_DIR = join(ROOT, "db", "migrations");

async function main() {
  const client = await connect();
  try {
    if (reset) {
      console.log("Resetting schema (DROP SCHEMA public CASCADE)…");
      await client.query("DROP SCHEMA IF EXISTS public CASCADE");
      await client.query("CREATE SCHEMA public");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map(
        (r) => r.filename
      )
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`  applying ${file} … `);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log("ok");
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("FAILED");
        throw err;
      }
    }

    console.log(
      count === 0
        ? "Already up to date — no pending migrations."
        : `Applied ${count} migration(s).`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
