// Setup script for Meridian operations extension schema.
// Usage: node setup-operations-extensions-db.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = 'https://gpjqyygnpysregifgxkr.supabase.co';
const SERVICE_ROLE = 'replace-with-current-service-role-key';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'migrations', '009_operations_extensions.sql'), 'utf8');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const { error } = await supabase.rpc('exec_sql', { query: sql });
if (!error) {
  console.log('Operations extensions migration applied via exec_sql RPC.');
} else {
  console.log('--- Operations extensions migration ---');
  console.log('Apply this in the Supabase SQL editor:');
  console.log('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
  console.log('');
  console.log(sql);
  console.log('');
  console.log('(Could not apply automatically:', error.message, ')');
}

