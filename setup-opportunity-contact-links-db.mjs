// Setup script for Meridian opportunity/contact link schema.
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node setup-opportunity-contact-links-db.mjs
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
const sql = readFileSync(join(here, 'migrations', '034_opportunity_contact_links.sql'), 'utf8');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const { error } = await supabase.rpc('exec_sql', { query: sql });
if (!error) {
  console.log('Opportunity contact links migration applied via exec_sql RPC.');
} else {
  console.log('--- Opportunity contact links migration ---');
  console.log('Apply this in the Supabase SQL editor:');
  console.log('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
  console.log('');
  console.log(sql);
  console.log('');
  console.log('(Could not apply automatically:', error.message, ')');
}
