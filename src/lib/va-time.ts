import { supabase } from "./supabase";

export const VA_DEFAULT_HOURLY_RATE = 4.5;
export const VA_PAY_PERIOD_ANCHOR = "2026-06-01";
export const VA_TIME_ZONE = "America/New_York";

export type VaTimeStatus = "open" | "submitted" | "approved" | "void";
export type VaTimeChangeRequestType = "add-shift" | "edit-shift" | "void-shift";
export type VaTimeChangeRequestStatus = "pending" | "approved" | "rejected";

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

export interface VaTimeChangeRequest {
  id: string;
  entry_id: string | null;
  operator_name: string;
  request_type: VaTimeChangeRequestType;
  requested_clock_in_at: string | null;
  requested_clock_out_at: string | null;
  requested_notes: string | null;
  reason: string;
  status: VaTimeChangeRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  applied_entry_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VaTimeChangeRequestInput {
  entryId?: string | null;
  operatorName: string;
  requestType: VaTimeChangeRequestType;
  requestedClockInAt?: string | null;
  requestedClockOutAt?: string | null;
  requestedNotes?: string | null;
  reason: string;
}

export interface VaTimeEntryUpdateInput {
  entryId: string;
  clockInAt: string;
  clockOutAt: string;
  notes?: string | null;
  actor: string;
}

const LOCAL_TIME_ENTRIES = "meridian_va_time_entries_local";
const LOCAL_TIME_CHANGE_REQUESTS = "meridian_va_time_change_requests_local";
const MISSING_TIME_TABLE_MESSAGE = "VA time tracking needs the latest database migration before clock entries can be saved.";
const MISSING_REQUEST_TABLE_MESSAGE = "VA time-change requests need the latest database migration before they can be saved.";

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

function timeZoneParts(date: Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: VA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map(part => [part.type, part.value]));
}

function wallTimeMs(parts: { year: number; month: number; day: number; hour: number; minute: number }): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

export function vaDateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const parts = timeZoneParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatVaDateTime(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VA_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function toVaDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = timeZoneParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromVaDateTimeInput(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  let utcMs = wallTimeMs(desired);
  for (let i = 0; i < 3; i += 1) {
    const parts = timeZoneParts(new Date(utcMs));
    const actual = {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    };
    const diff = wallTimeMs(desired) - wallTimeMs(actual);
    if (diff === 0) break;
    utcMs += diff;
  }
  return new Date(utcMs).toISOString();
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

function isMissingVaTimeTable(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message ?? "";
  return error?.code === "PGRST205" || (message.includes("meridian_va_time_entries") && message.includes("schema cache"));
}

function isMissingVaTimeRequestTable(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message ?? "";
  return error?.code === "PGRST205" || (message.includes("meridian_va_time_change_requests") && message.includes("schema cache"));
}

function buildShiftPatch(args: {
  clockInAt: string;
  clockOutAt: string;
  hourlyRate: number;
  notes?: string | null;
}) {
  const duration = minutesBetween(args.clockInAt, args.clockOutAt);
  const period = getBiweeklyPayPeriod(args.clockInAt);
  return {
    clock_in_at: args.clockInAt,
    clock_out_at: args.clockOutAt,
    duration_minutes: duration,
    hourly_rate: args.hourlyRate,
    cost_amount: Number(((duration / 60) * args.hourlyRate).toFixed(2)),
    pay_period_start: period.periodStart,
    pay_period_end: period.periodEnd,
    status: "submitted" as VaTimeStatus,
    notes: args.notes?.trim() || null,
    tracker_expense_id: null,
    reviewed_by: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
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
  if (isMissingVaTimeTable(error)) return [];
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
  if (isMissingVaTimeTable(error)) return null;
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
  if (isMissingVaTimeTable(error)) return { data: null, error: MISSING_TIME_TABLE_MESSAGE };
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
  if (isMissingVaTimeTable(error)) return { data: null, error: MISSING_TIME_TABLE_MESSAGE };
  return { data: data ? normalizeEntry(data as VaTimeEntry) : null, error: error?.message ?? null };
}

export async function updateVaTimeEntry(input: VaTimeEntryUpdateInput): Promise<{ data: VaTimeEntry | null; error: string | null }> {
  if (!input.clockInAt || !input.clockOutAt) return { data: null, error: "Clock in and clock out are required." };
  if (new Date(input.clockOutAt) < new Date(input.clockInAt)) return { data: null, error: "Clock out cannot be before clock in." };

  if (!supabase) {
    const rows = localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, []);
    const existing = rows.find(row => row.id === input.entryId);
    if (!existing) return { data: null, error: "Could not find the shift." };
    const patch = buildShiftPatch({
      clockInAt: input.clockInAt,
      clockOutAt: input.clockOutAt,
      hourlyRate: existing.hourly_rate,
      notes: input.notes ?? existing.notes,
    });
    const next = rows.map(row => row.id === input.entryId ? { ...row, ...patch } : row);
    localSet(LOCAL_TIME_ENTRIES, next);
    return { data: normalizeEntry(next.find(row => row.id === input.entryId) as VaTimeEntry), error: null };
  }

  const { data: existing, error: existingError } = await supabase
    .from("meridian_va_time_entries")
    .select("*")
    .eq("id", input.entryId)
    .maybeSingle();
  if (isMissingVaTimeTable(existingError)) return { data: null, error: MISSING_TIME_TABLE_MESSAGE };
  if (existingError || !existing) return { data: null, error: existingError?.message ?? "Could not find the shift." };

  const entry = normalizeEntry(existing as VaTimeEntry);
  const patch = buildShiftPatch({
    clockInAt: input.clockInAt,
    clockOutAt: input.clockOutAt,
    hourlyRate: entry.hourly_rate,
    notes: input.notes ?? entry.notes,
  });
  const { data, error } = await supabase
    .from("meridian_va_time_entries")
    .update(patch)
    .eq("id", input.entryId)
    .select()
    .single();
  if (isMissingVaTimeTable(error)) return { data: null, error: MISSING_TIME_TABLE_MESSAGE };
  return { data: data ? normalizeEntry(data as VaTimeEntry) : null, error: error?.message ?? null };
}

export async function voidVaTimeEntry(entryId: string): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, []);
    localSet(LOCAL_TIME_ENTRIES, rows.map(row => row.id === entryId ? {
      ...row,
      status: "void",
      deleted_at: now,
      updated_at: now,
      tracker_expense_id: null,
      reviewed_by: null,
      reviewed_at: null,
    } : row));
    return { error: null };
  }
  const { error } = await supabase
    .from("meridian_va_time_entries")
    .update({ status: "void", deleted_at: now, updated_at: now, tracker_expense_id: null, reviewed_by: null, reviewed_at: null })
    .eq("id", entryId);
  if (isMissingVaTimeTable(error)) return { error: MISSING_TIME_TABLE_MESSAGE };
  return { error: error?.message ?? null };
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
  if (isMissingVaTimeTable(error)) return { error: MISSING_TIME_TABLE_MESSAGE };
  return { error: error?.message ?? null };
}

export async function fetchVaTimeChangeRequests(limit = 100): Promise<VaTimeChangeRequest[]> {
  if (!supabase) {
    return localGet<VaTimeChangeRequest[]>(LOCAL_TIME_CHANGE_REQUESTS, [])
      .filter(request => !request.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from("meridian_va_time_change_requests")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (isMissingVaTimeRequestTable(error)) return [];
  if (error || !data) return [];
  return data as VaTimeChangeRequest[];
}

export async function createVaTimeChangeRequest(input: VaTimeChangeRequestInput): Promise<{ data: VaTimeChangeRequest | null; error: string | null }> {
  if (!input.reason.trim()) return { data: null, error: "A reason is required for time changes." };
  if (input.requestType !== "void-shift" && (!input.requestedClockInAt || !input.requestedClockOutAt)) {
    return { data: null, error: "Clock in and clock out times are required." };
  }
  if (input.requestedClockInAt && input.requestedClockOutAt && new Date(input.requestedClockOutAt) < new Date(input.requestedClockInAt)) {
    return { data: null, error: "Clock out cannot be before clock in." };
  }

  const now = new Date().toISOString();
  const row = {
    entry_id: input.entryId || null,
    operator_name: input.operatorName,
    request_type: input.requestType,
    requested_clock_in_at: input.requestedClockInAt || null,
    requested_clock_out_at: input.requestedClockOutAt || null,
    requested_notes: input.requestedNotes?.trim() || null,
    reason: input.reason.trim(),
    status: "pending" as VaTimeChangeRequestStatus,
  };

  if (!supabase) {
    const request: VaTimeChangeRequest = {
      ...row,
      id: `va-time-request-${Date.now()}`,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      applied_entry_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    localSet(LOCAL_TIME_CHANGE_REQUESTS, [request, ...localGet<VaTimeChangeRequest[]>(LOCAL_TIME_CHANGE_REQUESTS, [])]);
    return { data: request, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_va_time_change_requests")
    .insert(row)
    .select()
    .single();
  if (isMissingVaTimeRequestTable(error)) return { data: null, error: MISSING_REQUEST_TABLE_MESSAGE };
  return { data: (data as VaTimeChangeRequest) ?? null, error: error?.message ?? null };
}

export async function reviewVaTimeChangeRequest(
  request: VaTimeChangeRequest,
  decision: "approved" | "rejected",
  actor: string,
  reviewNote = "",
): Promise<{ error: string | null }> {
  if (request.status !== "pending") return { error: "This request has already been reviewed." };
  const now = new Date().toISOString();

  if (!supabase) {
    const requests = localGet<VaTimeChangeRequest[]>(LOCAL_TIME_CHANGE_REQUESTS, []);
    let appliedEntryId: string | null = request.applied_entry_id;
    if (decision === "approved") {
      const entries = localGet<VaTimeEntry[]>(LOCAL_TIME_ENTRIES, []);
      if (request.request_type === "add-shift") {
        const patch = buildShiftPatch({
          clockInAt: request.requested_clock_in_at || now,
          clockOutAt: request.requested_clock_out_at || now,
          hourlyRate: VA_DEFAULT_HOURLY_RATE,
          notes: request.requested_notes,
        });
        const entry: VaTimeEntry = {
          ...patch,
          id: `va-time-${Date.now()}`,
          operator_name: request.operator_name,
          created_at: now,
          deleted_at: null,
        };
        appliedEntryId = entry.id;
        localSet(LOCAL_TIME_ENTRIES, [entry, ...entries]);
      } else if (request.entry_id) {
        localSet(LOCAL_TIME_ENTRIES, entries.map(entry => {
          if (entry.id !== request.entry_id) return entry;
          if (request.request_type === "void-shift") return { ...entry, status: "void", deleted_at: now, updated_at: now };
          const patch = buildShiftPatch({
            clockInAt: request.requested_clock_in_at || entry.clock_in_at,
            clockOutAt: request.requested_clock_out_at || entry.clock_out_at || now,
            hourlyRate: entry.hourly_rate,
            notes: request.requested_notes ?? entry.notes,
          });
          appliedEntryId = entry.id;
          return { ...entry, ...patch };
        }));
      }
    }
    localSet(LOCAL_TIME_CHANGE_REQUESTS, requests.map(row => row.id === request.id ? {
      ...row,
      status: decision,
      reviewed_by: actor,
      reviewed_at: now,
      review_note: reviewNote.trim() || null,
      applied_entry_id: appliedEntryId,
      updated_at: now,
    } : row));
    return { error: null };
  }

  let appliedEntryId: string | null = request.applied_entry_id;
  if (decision === "approved") {
    if (request.request_type === "add-shift") {
      const patch = buildShiftPatch({
        clockInAt: request.requested_clock_in_at || now,
        clockOutAt: request.requested_clock_out_at || now,
        hourlyRate: VA_DEFAULT_HOURLY_RATE,
        notes: request.requested_notes,
      });
      const { data, error } = await supabase
        .from("meridian_va_time_entries")
        .insert({
          ...patch,
          operator_name: request.operator_name,
          created_at: now,
        })
        .select("id")
        .single();
      if (isMissingVaTimeTable(error)) return { error: MISSING_TIME_TABLE_MESSAGE };
      if (error || !data) return { error: error?.message ?? "Could not add the requested shift." };
      appliedEntryId = data.id;
    } else if (request.entry_id) {
      if (request.request_type === "void-shift") {
        const { error } = await supabase
          .from("meridian_va_time_entries")
          .update({ status: "void", deleted_at: now, updated_at: now, tracker_expense_id: null, reviewed_by: null, reviewed_at: null })
          .eq("id", request.entry_id);
        if (isMissingVaTimeTable(error)) return { error: MISSING_TIME_TABLE_MESSAGE };
        if (error) return { error: error.message };
      } else {
        const { data: existing, error: existingError } = await supabase
          .from("meridian_va_time_entries")
          .select("*")
          .eq("id", request.entry_id)
          .maybeSingle();
        if (isMissingVaTimeTable(existingError)) return { error: MISSING_TIME_TABLE_MESSAGE };
        if (existingError || !existing) return { error: existingError?.message ?? "Could not find the original shift." };
        const entry = normalizeEntry(existing as VaTimeEntry);
        const patch = buildShiftPatch({
          clockInAt: request.requested_clock_in_at || entry.clock_in_at,
          clockOutAt: request.requested_clock_out_at || entry.clock_out_at || now,
          hourlyRate: entry.hourly_rate,
          notes: request.requested_notes ?? entry.notes,
        });
        const { error } = await supabase
          .from("meridian_va_time_entries")
          .update(patch)
          .eq("id", request.entry_id);
        if (isMissingVaTimeTable(error)) return { error: MISSING_TIME_TABLE_MESSAGE };
        if (error) return { error: error.message };
      }
      appliedEntryId = request.entry_id;
    }
  }

  const { error } = await supabase
    .from("meridian_va_time_change_requests")
    .update({
      status: decision,
      reviewed_by: actor,
      reviewed_at: now,
      review_note: reviewNote.trim() || null,
      applied_entry_id: appliedEntryId,
      updated_at: now,
    })
    .eq("id", request.id);
  if (isMissingVaTimeRequestTable(error)) return { error: MISSING_REQUEST_TABLE_MESSAGE };
  return { error: error?.message ?? null };
}
