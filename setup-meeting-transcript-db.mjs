// Setup script for the meeting_notes.transcript column.
// Reads migrations/006_meeting_transcript.sql and tries to apply it.
//
// Usage: node setup-meeting-transcript-db.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = 'https://gpjqyygnpysregifgxkr.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwanF5eWducHlzcmVnaWZneGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyMjg2OCwiZXhwIjoyMDc5NTk4ODY4fQ.T3u7fSonfY1wfsdCzuGUpODwjqnvrEZdtuoom4Vh1hU';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'migrations', '006_meeting_transcript.sql'), 'utf8');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const { error } = await supabase.rpc('exec_sql', { query: sql });
if (!error) {
  console.log('Migration applied via exec_sql RPC.');
} else {
  console.log('--- meeting_notes.transcript migration ---');
  console.log('Apply this in the Supabase SQL editor:');
  console.log('  https://supabase.com/dashboard/project/gpjqyygnpysregifgxkr/sql/new');
  console.log('');
  console.log(sql);
  console.log('');
  console.log('(Could not apply automatically:', error.message, ')');
}
