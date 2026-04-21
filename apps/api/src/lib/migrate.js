// ═══════════════════════════════════════════════════════════════
//  Simple SQL migration runner
//
//  - Reads numbered .sql files from /db/migrations/
//  - Tracks applied migrations in schema_migrations table
//  - Runs on API startup, after the init schema
//  - Files must be named: 0001_description.sql, 0002_..., etc.
// ═══════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";

const MIGRATIONS_DIR = path.resolve(
  process.env.MIGRATIONS_DIR || new URL("../../../../db/migrations", import.meta.url).pathname
);

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

export async function runMigrations() {
  await ensureMigrationsTable();

  // Get already-applied versions
  const { rows: applied } = await db.query(
    `SELECT version FROM schema_migrations ORDER BY version`
  );
  const appliedSet = new Set(applied.map(r => r.version));

  // Read migration files
  let files;
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();
  } catch {
    // No migrations directory yet — nothing to do
    console.log("✓ No migrations directory found — skipping");
    return;
  }

  if (files.length === 0) {
    console.log("✓ No pending migrations");
    return;
  }

  let count = 0;
  for (const file of files) {
    const version = file.split("_")[0]; // e.g. "0001"
    if (appliedSet.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
        [version, file]
      );
      await client.query("COMMIT");
      console.log(`  ✓ Migration ${file} applied`);
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  ✗ Migration ${file} failed:`, err.message);
      throw new Error(`Migration ${file} failed — aborting startup`);
    } finally {
      client.release();
    }
  }

  console.log(`✓ Migrations complete (${count} new, ${appliedSet.size} previously applied)`);
}
