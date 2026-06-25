// Shared helpers for the DB scripts: load .env.local, build a connection
// string, and a pg Client that retries while Postgres is still booting.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");

/** Minimal .env loader — only fills keys not already in process.env. */
export function loadEnv() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export const DEFAULT_DATABASE_URL =
  "postgresql://consultancy:consultancy@localhost:5434/consultancy";

export function databaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

/** Connect, retrying for up to ~30s so `db:up && db:migrate` just works. */
export async function connect({ retries = 30, delayMs = 1000 } = {}) {
  const connectionString = databaseUrl();
  let lastErr;
  for (let i = 0; i < retries; i++) {
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
      if (i === 0) {
        console.log("Waiting for Postgres to accept connections…");
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(
    `Could not connect to Postgres at ${connectionString}\n${lastErr?.message ?? ""}`
  );
}
