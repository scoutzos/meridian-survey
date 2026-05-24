import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const MODE = process.argv.includes("--confirm") ? "reset" : "dry-run";
const VERIFY_ONLY = process.argv.includes("--verify");
const ACTOR = "Courtney Mosely";
const VA_ASSIGNEE = "Sophie / VA";
const QA_SOURCE_ID = `va-first-day-qa-${todayInEastern()}`;

function todayInEastern() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadEnv() {
  const cwd = process.cwd();
  const files = [".env", ".env.local", ".env.survey.local"];
  const env = {};
  for (const file of files) {
    for (const [key, value] of Object.entries(parseEnvFile(path.join(cwd, file)))) {
      if (value) env[key] = value;
    }
  }
  return env;
}

const fileEnv = loadEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const credentialMode = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY ? "service role" : "anon";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL/key. Expected NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const resetOperations = [
  {
    table: "meridian_communication_events",
    label: "SMS/call communication events",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_notifications",
    label: "portal notifications",
    pk: "id",
    clear: "all",
  },
  {
    table: "action_item_events",
    label: "action item event history",
    pk: "id",
    clear: "all",
  },
  {
    table: "action_items",
    label: "action items",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_va_daily_brief_reviews",
    label: "daily brief member reviews",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_va_daily_briefs",
    label: "VA daily briefs",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_va_time_change_requests",
    label: "VA time change requests",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_va_time_entries",
    label: "VA clock entries",
    pk: "id",
    clear: "all",
  },
  {
    table: "tracker_expenses",
    label: "VA synced tracker expenses",
    pk: "id",
    softDelete: true,
    filters: [{ type: "eq", column: "source_table", value: "meridian_va_time_entries" }, { type: "is", column: "deleted_at", value: null }],
  },
  {
    table: "meridian_crm_activity",
    label: "CRM activity linked to leads/deals",
    pk: "id",
    or: "deal_id.not.is.null,source_table.eq.meridian_deals,source_table.eq.meridian_imported_land_leads",
  },
  {
    table: "meridian_calendar_events",
    label: "calendar events linked to deal packets",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_project_risks",
    label: "project risks linked to deal packets",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_project_documents",
    label: "documents linked to deal packets",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_deal_scenarios",
    label: "deal calculator scenarios",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_generated_memos",
    label: "generated deal memos",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_deal_agreements",
    label: "deal agreements",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_opportunity_contacts",
    label: "opportunity/contact links",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_buyer_offers",
    label: "buyer offers tied to deals",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_disposition_campaigns",
    label: "disposition campaigns tied to deals",
    pk: "id",
    filters: [{ type: "not", column: "deal_id", operator: "is", value: null }],
  },
  {
    table: "meridian_deal_attachments",
    label: "deal attachments",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_deal_activity",
    label: "deal activity",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_deal_due_diligence_items",
    label: "deal due diligence items",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_deal_votes",
    label: "deal votes",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_deals",
    label: "deal packets",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_land_due_diligence_items",
    label: "land due diligence items",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_land_comp_records",
    label: "land comp records",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_land_underwriting_results",
    label: "land underwriting results",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_imported_land_lead_field_values",
    label: "imported lead source field values",
    pk: "id",
    clear: "all",
    chunkSize: 500,
  },
  {
    table: "meridian_imported_land_lead_activities",
    label: "imported lead activity",
    pk: "id",
    clear: "all",
  },
  {
    table: "meridian_imported_land_leads",
    label: "imported leads",
    pk: "id",
    clear: "all",
    chunkSize: 100,
  },
  {
    table: "meridian_land_lead_import_batches",
    label: "lead import batches",
    pk: "id",
    clear: "all",
  },
];

const seededTasks = [
  {
    title: "QA: Upload the 5-property bulk SMS list",
    description: "Upload VA_QA_5_Property_Bulk_SMS_Test.csv in the VA list import flow. Confirm 5 rows import and no duplicate warning blocks the upload.",
    priority: "high",
    due_date: todayInEastern(),
  },
  {
    title: "QA: Send the approved bulk SMS test",
    description: "Send this exact text to all 5 QA records: Hi {{first_name}}, this is Sophie with Meridian. Quick test: are you open to a brief call about your property at {{property_address}}? Reply YES, NO, FOLLOW UP, CALL ME, or STOP.",
    priority: "high",
    due_date: todayInEastern(),
  },
  {
    title: "QA: Match inbound SMS replies to the right records",
    description: "Have each member reply with their assigned keyword, then confirm each inbound text attaches to the correct lead and appears in the conversation history.",
    priority: "high",
    due_date: todayInEastern(),
  },
  {
    title: "QA: Log the five required lead outcomes",
    description: "Mark one lead interested, one not interested, one follow-up, one call outcome, and one blocked/compliance issue. Add a short note on each.",
    priority: "normal",
    due_date: addDays(todayInEastern(), 1),
  },
  {
    title: "QA: Clock out and submit the daily brief",
    description: "Clock in before testing, clock out after testing, then submit a daily brief with the QA counts, blockers, and tomorrow plan from the testing instructions.",
    priority: "normal",
    due_date: addDays(todayInEastern(), 1),
  },
];

function isMissingTable(error) {
  const message = error?.message || "";
  return error?.code === "PGRST205" || message.includes("schema cache") || message.includes("does not exist");
}

function applyFilters(query, operation) {
  let next = query;
  if (operation.clear === "all") {
    next = next.not(operation.pk, "is", null);
  }
  for (const filter of operation.filters || []) {
    if (filter.type === "eq") next = next.eq(filter.column, filter.value);
    if (filter.type === "is") next = next.is(filter.column, filter.value);
    if (filter.type === "not") next = next.not(filter.column, filter.operator, filter.value);
  }
  if (operation.or) next = next.or(operation.or);
  return next;
}

async function countRows(operation) {
  const query = applyFilters(
    supabase.from(operation.table).select(operation.pk, { count: "exact", head: true }),
    operation,
  );
  const { count, error } = await query;
  if (error) {
    if (isMissingTable(error)) return { missing: true, count: 0, error: null };
    return { missing: false, count: 0, error };
  }
  return { missing: false, count: count ?? 0, error: null };
}

async function clearRows(operation) {
  if (operation.softDelete) {
    const patch = { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: ACTOR };
    const { error } = await applyFilters(supabase.from(operation.table).update(patch), operation);
    return error;
  }
  if (operation.chunkSize) return clearRowsInChunks(operation);
  const { error } = await applyFilters(supabase.from(operation.table).delete(), operation);
  return error;
}

async function clearRowsInChunks(operation) {
  let loops = 0;
  while (true) {
    loops += 1;
    if (loops > 10000) return new Error(`${operation.table}: exceeded chunk loop guard`);

    const { data, error } = await applyFilters(
      supabase.from(operation.table).select(operation.pk).limit(operation.chunkSize),
      operation,
    );
    if (error) return error;

    const ids = (data || []).map(row => row[operation.pk]).filter(Boolean);
    if (ids.length === 0) return null;

    const { data: deleted, error: deleteError } = await supabase
      .from(operation.table)
      .delete()
      .in(operation.pk, ids)
      .select(operation.pk);
    if (deleteError) return deleteError;
    if (!deleted || deleted.length === 0) {
      return new Error(`${operation.table}: delete returned no rows; check RLS credentials`);
    }
  }
}

async function runReset() {
  const rows = [];
  for (const operation of resetOperations) {
    const before = await countRows(operation);
    if (before.error) throw new Error(`${operation.table}: ${before.error.message}`);
    if (before.missing) {
      rows.push({ table: operation.table, label: operation.label, before: "missing", action: "skipped" });
      continue;
    }
    if (MODE === "reset" && before.count > 0) {
      const clearError = await clearRows(operation);
      if (clearError) throw new Error(`${operation.table}: ${clearError.message}`);
    }
    const after = MODE === "reset" ? await countRows(operation) : { count: before.count };
    if (after.error) throw new Error(`${operation.table}: ${after.error.message}`);
    if (MODE === "reset" && after.count !== 0) {
      throw new Error(`${operation.table}: ${after.count} rows remain after reset. This usually means RLS blocked the delete or the statement timed out.`);
    }
    rows.push({
      table: operation.table,
      label: operation.label,
      before: before.count,
      after: after.count,
      action: MODE === "reset" ? (operation.softDelete ? "soft-deleted" : "deleted") : "counted",
    });
  }
  return rows;
}

async function seedTasks() {
  const rows = seededTasks.map(task => ({
    ...task,
    assigned_to: VA_ASSIGNEE,
    task_type: "va-work",
    status: "open",
    source_table: "qa_structured_reset",
    source_id: QA_SOURCE_ID,
    created_by: ACTOR,
    updated_by: ACTOR,
  }));
  const { data, error } = await supabase.from("action_items").insert(rows).select("id,title,status");
  if (error) throw new Error(`seed action_items: ${error.message}`);

  const eventRows = (data || []).map(item => ({
    action_item_id: item.id,
    event_type: "created",
    next_status: "open",
    note: "Seeded for VA first-day QA structured reset.",
    created_by: ACTOR,
  }));
  if (eventRows.length) {
    const { error: eventError } = await supabase.from("action_item_events").insert(eventRows);
    if (eventError) throw new Error(`seed action_item_events: ${eventError.message}`);
  }

  return data || [];
}

async function verify() {
  const checks = [
    { table: "meridian_members", pk: "name", label: "members/admin accounts", clear: "all" },
    { table: "meridian_imported_land_leads", pk: "id", label: "imported leads", clear: "all" },
    { table: "meridian_land_lead_import_batches", pk: "id", label: "lead import batches", clear: "all" },
    { table: "meridian_communication_events", pk: "id", label: "communication events", clear: "all" },
    { table: "meridian_va_daily_briefs", pk: "id", label: "daily briefs", clear: "all" },
    { table: "meridian_va_time_entries", pk: "id", label: "VA clock entries", clear: "all" },
    { table: "meridian_deals", pk: "id", label: "deal packets", clear: "all" },
    { table: "action_items", pk: "id", label: "seeded action items", filters: [{ type: "eq", column: "source_table", value: "qa_structured_reset" }] },
  ];
  const rows = [];
  for (const operation of checks) {
    const result = await countRows(operation);
    rows.push({
      table: operation.table,
      label: operation.label,
      count: result.missing ? "missing" : result.count,
    });
  }
  return rows;
}

try {
  if (VERIFY_ONLY) {
    console.table(await verify());
    process.exit(0);
  }

  console.log(MODE === "reset" ? `Running structured VA reset with ${credentialMode} credentials...` : `Dry run only with ${credentialMode} credentials. Re-run with --confirm to clear and seed.`);
  const cleared = await runReset();
  console.table(cleared);

  if (MODE === "reset") {
    const tasks = await seedTasks();
    console.log(`Seeded ${tasks.length} VA QA tasks assigned to ${VA_ASSIGNEE}.`);
    console.table(await verify());
  } else {
    console.log("No rows were changed.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
