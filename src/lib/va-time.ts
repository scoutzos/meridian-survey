import { supabase } from "./supabase";

export const VA_DEFAULT_HOURLY_RATE = 4.5;
export const VA_PAY_PERIOD_ANCHOR = "2026-06-01";

export type VaTimeStatus = "open" | "submitted" | "approved" | "void";

export interface VaTimeEntry {
  id: string;
  operator_name: string;
  clock_in_at: string;
  clock_out_at: string | null;
  duration_minutes: number | null;
  hourly_rate: number;
  cost_amount: number | null;
  pay_period_start: string;
  pay_period_end: string;
  status: VaTimeStatus;
  notes: string | null;
  tracker_expense_id: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VaPayPeriodSummary {
  operatorName: string;
  periodStart: string;
  periodEnd: string;
  entries: VaTimeEntry[];
  totalMinutes: number;
  totalHours: number;
  totalCost: number;
  hourlyRate: number;
  trackerExpenseId: number | null;
  approved: boolean;
  open: boolean;
}

const LOCAL_TIME_ENTRIES = "meridian_va_time_entries_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function addDays(isoDate: string, days: number): string {
  const date = parseUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
}

export function getBiweeklyPayPeriod(input: Date | string = new Date()): { periodStart: string; periodEnd: string } {
  const date = typeof input === "string" ? parseUtcDate(input.slice(0, 10)) : input;
  const anchor = parseUtcDate(VA_PAY_PERIOD_ANCHOR);
  const current = parseUtcDate(dateOnly(date));
  const daysSinceAnchor = Math.floor((current.getTime() - anchor.getTime()) / 86400000);
  const periodOffset = Math.floor(daysSinceAnchor / 14) * 14;
  const periodStart = addDays(VA_PAY_PERIOD_ANCHOR, periodOffset);
  return { periodStart, periodEnd: addDays(periodStart, 13) };
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatPayPeriod(summary: Pick<VaPayPeriodSummary, "periodStart" | "periodEnd">): string {
  return `${summary.periodStart} to ${summary.periodEnd}`;
}

export function currentShiftMinutes(entry: VaTimeEntry | null): number {
  if (!entry || entry.clock_out_at) return 0;
  return minutesBetween(entry.clock_in_at, new Date().toISOString());
}

function normalizeEntry(row: VaTimeEntry): VaTimeEntry {
  return {
    ...row,
    hourly_rate: Number(row.hourly_rate),
    cost_amount: row.cost_amount === null ? null : Number(row.cost_amount),
  };
}

export async function fetchVaTimeEntries(limit = 100): Promise<VaTimeEntry[]> {
  if (!supabase) {
    return localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, [])
      .filter(entry => !entry.deleted_at)
      .sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at))
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from("meridian_va_time_entries")
    .select("*")
    .is("deleted_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as VaTimeEntry[]).map(normalizeEntry);
}

export async function fetchOpenVaTimeEntry(operatorName: string): Promise<VaTimeEntry | null> {
  const localOpen = (rows: VaTimeEntry[]) => rows.find(entry => entry.operator_name === operatorName && entry.status === "open" && !entry.clock_out_at && !entry.deleted_at) ?? null;
  if (!supabase) {
    const entry = localOpen(localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, []));
    return entry ? normalizeEntry(entry) : null;
  }
  const { data, error } = await supabase
    .from("meridian_va_time_entries")
    .select("*")
    .eq("operator_name", operatorName)
    .eq("status", "open")
    .is("clock_out_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeEntry(data as VaTimeEntry);
}

export async function clockInVa(operatorName: string, hourlyRate = VA_DEFAULT_HOURLY_RATE): Promise<{ data: VaTimeEntry | null; error: string | null }> {
  const existing = await fetchOpenVaTimeEntry(operatorName);
  if (existing) return { data: existing, error: "There is already an open shift." };

  const now = new Date().toISOString();
  const period = getBiweeklyPayPeriod(now);
  const row = {
    operator_name: operatorName,
    clock_in_at: now,
    hourly_rate: hourlyRate,
    pay_period_start: period.periodStart,
    pay_period_end: period.periodEnd,
    status: "open" as VaTimeStatus,
  };

  if (!supabase) {
    const entry: VaTimeEntry = {
      ...row,
      id: `va-time-${Date.now()}`,
      clock_out_at: null,
      duration_minutes: null,
      cost_amount: null,
      notes: null,
      tracker_expense_id: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    localSet(LOCAL_TIME_ENTRIES, [entry, ...localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, [])]);
    return { data: entry, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_va_time_entries")
    .insert(row)
    .select()
    .single();
  return { data: data ? normalizeEntry(data as VaTimeEntry) : null, error: error?.message ?? null };
}

export async function clockOutVa(entry: VaTimeEntry, notes = ""): Promise<{ data: VaTimeEntry | null; error: string | null }> {
  const now = new Date().toISOString();
  const duration = minutesBetween(entry.clock_in_at, now);
  const cost = Number(((duration / 60) * Number(entry.hourly_rate)).toFixed(2));
  const patch = {
    clock_out_at: now,
    duration_minutes: duration,
    cost_amount: cost,
    status: "submitted" as VaTimeStatus,
    notes: notes.trim() || entry.notes || null,
    updated_at: now,
  };

  if (!supabase) {
    const rows = localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, []);
    const next = rows.map(row => row.id === entry.id ? { ...row, ...patch } : row);
    localSet(LOCAL_TIME_ENTRIES, next);
    return { data: normalizeEntry(next.find(row => row.id === entry.id) as VaTimeEntry), error: null };
  }

  const { data, error } = await supabase
    .from("meridian_va_time_entries")
    .update(patch)
    .eq("id", entry.id)
    .select()
    .single();
  return { data: data ? normalizeEntry(data as VaTimeEntry) : null, error: error?.message ?? null };
}

export function summarizeVaPayPeriods(entries: VaTimeEntry[]): VaPayPeriodSummary[] {
  const grouped = new Map<string, VaTimeEntry[]>();
  for (const entry of entries.filter(row => !row.deleted_at && row.status !== "void")) {
    const key = `${entry.operator_name}|${entry.pay_period_start}|${entry.pay_period_end}`;
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  return Array.from(grouped.values()).map(rows => {
    const totalMinutes = rows.reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0);
    const totalCost = rows.reduce((sum, row) => sum + Number(row.cost_amount ?? 0), 0);
    return {
      operatorName: rows[0].operator_name,
      periodStart: rows[0].pay_period_start,
      periodEnd: rows[0].pay_period_end,
      entries: rows.sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at)),
      totalMinutes,
      totalHours: totalMinutes / 60,
      totalCost,
      hourlyRate: Number(rows[0].hourly_rate),
      trackerExpenseId: rows.find(row => row.tracker_expense_id)?.tracker_expense_id ?? null,
      approved: rows.length > 0 && rows.every(row => row.status === "approved"),
      open: rows.some(row => row.status === "open" || !row.clock_out_at),
    };
  }).sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

export async function approveVaPayPeriod(summary: VaPayPeriodSummary, actor: string): Promise<{ error: string | null }> {
  if (summary.open) return { error: "This pay period has an open shift. Clock out before approving." };
  if (summary.totalCost <= 0) return { error: "This pay period has no submitted time to approve." };

  const sourceId = `${summary.operatorName}:${summary.periodStart}`;
  const description = `${summary.operatorName} VA hours - ${summary.periodStart} to ${summary.periodEnd}`;
  const now = new Date().toISOString();

  if (!supabase) {
    const rows = localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, []);
    localSet(LOCAL_TIME_ENTRIES, rows.map(row =>
      row.operator_name === summary.operatorName && row.pay_period_start === summary.periodStart
        ? { ...row, status: "approved", reviewed_by: actor, reviewed_at: now, updated_at: now }
        : row
    ));
    return { error: null };
  }

  const expenseRow = {
    expense_date: summary.periodEnd,
    category: "VA",
    description,
    amount: Number(summary.totalCost.toFixed(2)),
    paid_by_member_name: null,
    paid_by_label: "TBD",
    source_table: "meridian_va_time_entries",
    source_id: sourceId,
    updated_at: now,
    updated_by: actor,
  };

  const { data: existingExpense } = await supabase
    .from("tracker_expenses")
    .select("id")
    .eq("source_table", "meridian_va_time_entries")
    .eq("source_id", sourceId)
    .is("deleted_at", null)
    .maybeSingle();

  const expenseResult = existingExpense
    ? await supabase.from("tracker_expenses").update(expenseRow).eq("id", existingExpense.id).select("id").single()
    : await supabase.from("tracker_expenses").insert({ ...expenseRow, created_by: actor }).select("id").single();
  if (expenseResult.error || !expenseResult.data) return { error: expenseResult.error?.message ?? "Could not sync VA expense." };

  const entryIds = summary.entries.map(entry => entry.id);
  const { error } = await supabase
    .from("meridian_va_time_entries")
    .update({
      status: "approved",
      tracker_expense_id: expenseResult.data.id,
      reviewed_by: actor,
      reviewed_at: now,
      updated_at: now,
    })
    .in("id", entryIds);
  return { error: error?.message ?? null };
}
