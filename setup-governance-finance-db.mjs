// Setup script for Meridian governance + finance extension schema.
// Usage: node setup-governance-finance-db.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = 'https://gpjqyygnpysregifgxkr.supabase.co';
const SERVICE_ROLE = 'replace-with-current-service-role-key';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'migrations', '010_governance_finance.sql'), 'utf8');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const { error } = await supabase.rpc('exec_sql', { query: sql });
if (!error) {
  console.log('Governance/finance migration applied via exec_sql RPC.');
} else {
  console.log('--- Governance/finance migration ---');
  console.log('Apply this in the Supabase SQL editor:');
  console.log('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
  console.log('');
  console.log(sql);
  console.log('');
  console.log('(Could not apply automatically:', error.message, ')');
}

