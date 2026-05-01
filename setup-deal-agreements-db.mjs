// Setup script for Meridian deal-level agreement table.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gpjqyygnpysregifgxkr.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const sql = fs.readFileSync(new URL('./migrations/011_deal_agreements.sql', import.meta.url), 'utf8');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
const { error } = await supabase.rpc('exec_sql', { query: sql });

if (error) {
  console.error('Could not run migration automatically:', error.message);
  console.error('Run migrations/011_deal_agreements.sql in Supabase SQL editor:');
  console.error('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
  process.exit(1);
}

console.log('Deal agreements migration applied.');
