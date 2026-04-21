-- Migration 0001: bootstrap schema_migrations tracking table
-- This is a no-op since migrate.js creates the table automatically,
-- but it serves as a template for future migrations.
--
-- To create a new migration:
--   1. Create a file: db/migrations/NNNN_description.sql
--   2. Write your SQL (runs inside a transaction)
--   3. Restart the API — it applies automatically

SELECT 1; -- no-op placeholder
