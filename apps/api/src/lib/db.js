import pg from "pg";

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

db.on("error", (err) => {
  console.error("Unexpected pg pool error", err);
});

// Convenience wrapper
export async function query(text, params) {
  const start = Date.now();
  const result = await db.query(text, params);
  const ms = Date.now() - start;
  if (ms > 500) console.warn(`slow query ${ms}ms: ${text.slice(0, 80)}`);
  return result;
}
