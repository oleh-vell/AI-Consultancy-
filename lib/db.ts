import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * Singleton Postgres pool. Stashed on globalThis so Next's dev HMR doesn't
 * open a new pool on every reload. Server-only — never imported by client code.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://consultancy:consultancy@localhost:5434/consultancy";

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

export const pool =
  globalForDb.__pgPool ??
  new Pool({ connectionString: DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

/** Tagged-free query helper that returns typed rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never);
  return res.rows;
}

/** Run a set of statements in a single transaction. */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
