// Setup script for the Hub schema (action_items, meeting_notes, next_meeting).
// Reads migrations/005_hub_tables.sql and tries to apply it.
//
// Usage: node setup-hub-db.mjs
//
// PostgREST (the /rest/v1 endpoint) cannot run arbitrary DDL, so this script
// tries supabase.rpc('exec_sql', ...) first — that works if the project has
// the helper function from earlier migrations. If not, it prints the SQL and
// the URL of the Supabase SQL editor; paste it there to apply.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = 'https://gpjqyygnpysregifgxkr.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'migrations', '005_hub_tables.sql'), 'utf8');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const { error } = await supabase.rpc('exec_sql', { query: sql });
if (!error) {
  console.log('Migration applied via exec_sql RPC.');
} else {
  console.log('--- Hub migration ---');
  console.log('Apply this in the Supabase SQL editor:');
  console.log('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
  console.log('');
  console.log(sql);
  console.log('');
  console.log('(Could not apply automatically:', error.message, ')');
}
