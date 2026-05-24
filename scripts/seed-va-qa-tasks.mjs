import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ACTOR = "Courtney Mosely";
const VA_ASSIGNEE = "Sophie / VA";
const SOURCE_TABLE = "qa_member_task";
const SOURCE_ID = `courtney-va-qa-tasks-${todayInEastern()}`;

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
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value) env[key] = value;
  }
  return env;
}

function loadEnv() {
  const files = [".env", ".env.local", ".env.survey.local"];
  const env = {};
  for (const file of files) Object.assign(env, parseEnvFile(path.join(process.cwd(), file)));
  return env;
}

const env = loadEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL/key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const today = todayInEastern();
const tomorrow = addDays(today, 1);

const tasks = [
  {
    title: "QA: Upload 5-property test list",
    description: "Upload VA_QA_5_Property_Bulk_SMS_Test.csv. Confirm exactly 5 records import, all phone numbers are member numbers, and no real seller list is used.",
    priority: "high",
    due_date: today,
  },
  {
    title: "QA: Send bulk SMS test",
    description: "Send the approved QA bulk text to the 5 imported records only. Confirm sent count, eligible count, and outbound SMS activity on each lead.",
    priority: "high",
    due_date: today,
  },
  {
    title: "QA: Confirm inbound replies",
    description: "Check that member replies appear in the contact queue and match the correct lead/phone number. Note any unmatched replies.",
    priority: "high",
    due_date: today,
  },
  {
    title: "QA: Test lead update and call workflow",
    description: "Open one QA lead, add the QA note, set follow-up, place one test call to a member, and log the call outcome.",
    priority: "normal",
    due_date: tomorrow,
  },
  {
    title: "QA: Submit daily brief and clock out",
    description: "After testing, submit the daily brief with upload, SMS, replies, call, task updates, and blockers. Then clock out.",
    priority: "normal",
    due_date: tomorrow,
  },
];

function taskRow(task) {
  return {
    title: task.title,
    description: task.description,
    assigned_to: VA_ASSIGNEE,
    due_date: task.due_date,
    task_type: "va-work",
    priority: task.priority,
    source_table: SOURCE_TABLE,
    source_id: SOURCE_ID,
    status: "open",
    completion_note: null,
    blocker_reason: null,
    completed_at: null,
    completed_by: null,
    deleted_at: null,
    created_by: ACTOR,
    updated_by: ACTOR,
    updated_at: new Date().toISOString(),
  };
}

async function fetchExisting() {
  const { data, error } = await supabase
    .from("action_items")
    .select("id,title,created_at,source_table")
    .eq("assigned_to", VA_ASSIGNEE)
    .eq("task_type", "va-work")
    .is("deleted_at", null)
    .or("source_table.eq.qa_member_task,source_table.eq.qa_structured_reset,title.ilike.QA:%")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function recordCreatedEvent(actionItemId) {
  const { error } = await supabase.from("action_item_events").insert({
    action_item_id: actionItemId,
    event_type: "created",
    next_status: "open",
    note: "Created by Courtney for VA QA testing.",
    created_by: ACTOR,
  });
  if (error) throw new Error(error.message);
}

async function main() {
  const existing = await fetchExisting();
  const kept = existing.slice(0, tasks.length);
  const extras = existing.slice(tasks.length);
  const results = [];

  for (let index = 0; index < tasks.length; index += 1) {
    const row = taskRow(tasks[index]);
    const existingTask = kept[index];
    if (existingTask) {
      const { data, error } = await supabase
        .from("action_items")
        .update(row)
        .eq("id", existingTask.id)
        .select("id,title,assigned_to,created_by,priority,due_date,status")
        .single();
      if (error) throw new Error(error.message);
      results.push({ action: "updated", ...data });
    } else {
      const { data, error } = await supabase
        .from("action_items")
        .insert({ ...row, created_at: new Date().toISOString() })
        .select("id,title,assigned_to,created_by,priority,due_date,status")
        .single();
      if (error) throw new Error(error.message);
      await recordCreatedEvent(data.id);
      results.push({ action: "created", ...data });
    }
  }

  for (const extra of extras) {
    const { error } = await supabase
      .from("action_items")
      .update({ deleted_at: new Date().toISOString(), updated_by: ACTOR, updated_at: new Date().toISOString() })
      .eq("id", extra.id);
    if (error) throw new Error(error.message);
    results.push({ action: "removed-duplicate", id: extra.id, title: extra.title });
  }

  const { data: verify, error: verifyError } = await supabase
    .from("action_items")
    .select("id,title,assigned_to,created_by,priority,due_date,status")
    .eq("source_table", SOURCE_TABLE)
    .eq("source_id", SOURCE_ID)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (verifyError) throw new Error(verifyError.message);

  console.table(results);
  console.log(`Verified ${verify.length} active Courtney-created QA tasks assigned to ${VA_ASSIGNEE}.`);
  console.table(verify);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
