// Setup script for the Contribution Tracker schema.
// Reads migrations/001_tracker_schema.sql and runs it via Supabase SQL.
//
// Usage: node setup-tracker-db.mjs
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or hard-code below
// to match setup-db.mjs). The Supabase JS client cannot run arbitrary DDL, so
// this script prints the SQL and the URL of the Supabase SQL editor — paste it
// there to apply. (If you have psql + the DB password, you can also pipe it
// directly: psql "$SUPABASE_DB_URL" -f migrations/001_tracker_schema.sql)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'migrations', '001_tracker_schema.sql'), 'utf8');

console.log('--- Contribution Tracker migration ---');
console.log('Apply this in the Supabase SQL editor:');
console.log('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
console.log('');
console.log(sql);
