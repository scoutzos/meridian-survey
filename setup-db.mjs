// Connectivity check for the Meridian Supabase project.
// Requires SUPABASE_SERVICE_ROLE_KEY in your local environment.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gpjqyygnpysregifgxkr.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT 1' });
console.log('RPC test:', { data, error });

const { data: responseRows, error: responseError } = await supabase
  .from('meridian_responses')
  .select('survey_id, member_name, question_id')
  .limit(1);

console.log('Table test:', { data: responseRows, error: responseError });
