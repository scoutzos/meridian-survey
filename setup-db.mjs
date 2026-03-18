// Setup script - creates tables using Supabase service role
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gpjqyygnpysregifgxkr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwanF5eWducHlzcmVnaWZneGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyMjg2OCwiZXhwIjoyMDc5NTk4ODY4fQ.T3u7fSonfY1wfsdCzuGUpODwjqnvrEZdtuoom4Vh1hU'
)

// Try to create table by inserting and seeing if it works
// If table doesn't exist, we need another approach

// Test if we can use rpc to run arbitrary SQL
const { data, error } = await supabase.rpc('exec_sql', {
  query: 'SELECT 1'
})
console.log('RPC test:', { data, error })

// Try direct insert to see if table exists
const { data: d2, error: e2 } = await supabase
  .from('meridian_responses')
  .select('*')
  .limit(1)
console.log('Table test:', { d2, e2 })
