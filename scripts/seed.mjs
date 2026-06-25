// Loads db/seed.sql — the lead queue, discovery script, and invoice scope.
// Idempotent (ON CONFLICT upserts), safe to run repeatedly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, connect, ROOT } from "./db.mjs";

loadEnv();

async function main() {
  const client = await connect();
  try {
    const sql = readFileSync(join(ROOT, "db", "seed.sql"), "utf8");
    await client.query(sql);
    const { rows } = await client.query(
      "SELECT (SELECT count(*) FROM leads) AS leads, (SELECT count(*) FROM discovery_questions) AS questions"
    );
    console.log(
      `Seeded. leads=${rows[0].leads}, discovery_questions=${rows[0].questions}.`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
