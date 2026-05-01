import { supabase } from "./supabase";

export interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  event_type: string;
  project_id: string | null;
  deal_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export type ReimbursementStatus = "submitted" | "approved" | "rejected" | "paid";

export interface Reimbursement {
  id: string;
  project_id: string | null;
  member_name: string;
  amount: number;
  vendor: string | null;
  category: string;
  expense_date: string | null;
  receipt_url: string | null;
  notes: string | null;
  status: ReimbursementStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export type DistributionStatus = "proposed" | "approved" | "paid" | "cancelled";

export interface Distribution {
  id: string;
  project_id: string | null;
  distribution_date: string;
  total_amount: number;
  reason: string | null;
  status: DistributionStatus;
  per_member_amount: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealScenario {
  id: string;
  deal_id: string | null;
  project_id: string | null;
  name: string;
  strategy: string;
  purchase_price: number | null;
  rehab_or_site_cost: number | null;
  closing_costs: number | null;
  holding_costs: number | null;
  financing_costs: number | null;
  exit_value: number | null;
  expected_rent: number | null;
  projected_profit: number | null;
  roi_percent: number | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface GeneratedMemo {
  id: string;
  deal_id: string | null;
  project_id: string | null;
  title: string;
  memo_type: string;
  body: string;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

const LOCAL_EVENTS = "meridian_calendar_events_local";
const LOCAL_REIMBURSEMENTS = "meridian_reimbursements_local";
const LOCAL_DISTRIBUTIONS = "meridian_distributions_local";
const LOCAL_SCENARIOS = "meridian_deal_scenarios_local";
const LOCAL_MEMOS = "meridian_generated_memos_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function calculateScenario(input: {
  purchase_price?: number | null;
  rehab_or_site_cost?: number | null;
  closing_costs?: number | null;
  holding_costs?: number | null;
  financing_costs?: number | null;
  exit_value?: number | null;
}) {
  const purchase = num(input.purchase_price) ?? 0;
  const rehab = num(input.rehab_or_site_cost) ?? 0;
  const closing = num(input.closing_costs) ?? 0;
  const holding = num(input.holding_costs) ?? 0;
  const financing = num(input.financing_costs) ?? 0;
  const exit = num(input.exit_value) ?? 0;
  const basis = purchase + rehab + closing + holding + financing;
  const profit = exit - basis;
  const roi = basis > 0 ? (profit / basis) * 100 : null;
  return { projected_profit: profit, roi_percent: roi };
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  if (!supabase) return localGet<CalendarEvent[]>(LOCAL_EVENTS, []).filter(e => !e.deleted_at).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const { data, error } = await supabase.from("meridian_calendar_events").select("*").is("deleted_at", null).order("event_date");
  if (error || !data) return [];
  return data as CalendarEvent[];
}

export async function createCalendarEvent(patch: Partial<CalendarEvent> & { title: string; event_date: string }, actor: string): Promise<{ data: CalendarEvent | null; error: string | null }> {
  const row = {
    ...patch,
    title: patch.title.trim(),
    event_time: patch.event_time ?? null,
    event_type: patch.event_type ?? "deadline",
    project_id: patch.project_id ?? null,
    deal_id: patch.deal_id ?? null,
    assigned_to: patch.assigned_to ?? null,
    notes: patch.notes?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  if (!supabase) {
    const now = new Date().toISOString();
    const event: CalendarEvent = { id: `cal-${Date.now()}`, deleted_at: null, created_at: now, updated_at: now, ...row };
    localSet(LOCAL_EVENTS, [event, ...localGet<CalendarEvent[]>(LOCAL_EVENTS, [])]);
    return { data: event, error: null };
  }
  const { data, error } = await supabase.from("meridian_calendar_events").insert(row).select().single();
  return { data: (data as CalendarEvent) ?? null, error: error?.message ?? null };
}

export async function fetchReimbursements(): Promise<Reimbursement[]> {
  if (!supabase) return localGet<Reimbursement[]>(LOCAL_REIMBURSEMENTS, []).filter(r => !r.deleted_at);
  const { data, error } = await supabase.from("meridian_reimbursements").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Reimbursement[];
}

export async function createReimbursement(patch: { member_name: string; amount: number; vendor?: string | null; category: string; expense_date?: string | null; receipt_url?: string | null; notes?: string | null; project_id?: string | null }, actor: string): Promise<{ data: Reimbursement | null; error: string | null }> {
  const row = {
    ...patch,
    project_id: patch.project_id ?? null,
    expense_date: patch.expense_date ?? null,
    vendor: patch.vendor?.trim() || null,
    receipt_url: patch.receipt_url?.trim() || null,
    notes: patch.notes?.trim() || null,
    status: "submitted" as ReimbursementStatus,
    created_by: actor,
    updated_by: actor,
  };
  if (!supabase) {
    const now = new Date().toISOString();
    const reimbursement: Reimbursement = { id: `reimb-${Date.now()}`, reviewed_by: null, reviewed_at: null, deleted_at: null, created_at: now, updated_at: now, ...row };
    localSet(LOCAL_REIMBURSEMENTS, [reimbursement, ...localGet<Reimbursement[]>(LOCAL_REIMBURSEMENTS, [])]);
    return { data: reimbursement, error: null };
  }
  const { data, error } = await supabase.from("meridian_reimbursements").insert(row).select().single();
  return { data: (data as Reimbursement) ?? null, error: error?.message ?? null };
}

export async function updateReimbursementStatus(id: string, status: ReimbursementStatus, actor: string): Promise<{ error: string | null }> {
  const patch = { status, reviewed_by: actor, reviewed_at: new Date().toISOString(), updated_by: actor, updated_at: new Date().toISOString() };
  if (!supabase) {
    const rows = localGet<Reimbursement[]>(LOCAL_REIMBURSEMENTS, []);
    localSet(LOCAL_REIMBURSEMENTS, rows.map(r => r.id === id ? { ...r, ...patch } : r));
    return { error: null };
  }
  const { error } = await supabase.from("meridian_reimbursements").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}

export async function fetchDistributions(): Promise<Distribution[]> {
  if (!supabase) return localGet<Distribution[]>(LOCAL_DISTRIBUTIONS, []).filter(d => !d.deleted_at);
  const { data, error } = await supabase.from("meridian_distributions").select("*").is("deleted_at", null).order("distribution_date", { ascending: false });
  if (error || !data) return [];
  return data as Distribution[];
}

export async function createDistribution(patch: { distribution_date: string; total_amount: number; reason?: string | null; project_id?: string | null }, actor: string): Promise<{ data: Distribution | null; error: string | null }> {
  const perMember = patch.total_amount ? Number((patch.total_amount / 6).toFixed(2)) : null;
  const row = { ...patch, project_id: patch.project_id ?? null, reason: patch.reason?.trim() || null, per_member_amount: perMember, status: "proposed" as DistributionStatus, created_by: actor, updated_by: actor };
  if (!supabase) {
    const now = new Date().toISOString();
    const distribution: Distribution = { id: `dist-${Date.now()}`, deleted_at: null, created_at: now, updated_at: now, ...row };
    localSet(LOCAL_DISTRIBUTIONS, [distribution, ...localGet<Distribution[]>(LOCAL_DISTRIBUTIONS, [])]);
    return { data: distribution, error: null };
  }
  const { data, error } = await supabase.from("meridian_distributions").insert(row).select().single();
  return { data: (data as Distribution) ?? null, error: error?.message ?? null };
}

export async function fetchScenarios(): Promise<DealScenario[]> {
  if (!supabase) return localGet<DealScenario[]>(LOCAL_SCENARIOS, []).filter(s => !s.deleted_at);
  const { data, error } = await supabase.from("meridian_deal_scenarios").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DealScenario[];
}

export async function createScenario(patch: Omit<Partial<DealScenario>, "id" | "created_at" | "updated_at" | "deleted_at"> & { name: string; strategy: string }, actor: string): Promise<{ data: DealScenario | null; error: string | null }> {
  const calc = calculateScenario(patch);
  const row = { ...patch, ...calc, notes: patch.notes?.trim() || null, created_by: actor, updated_by: actor };
  if (!supabase) {
    const now = new Date().toISOString();
    const scenario: DealScenario = {
      id: `scenario-${Date.now()}`,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      ...row,
      deal_id: patch.deal_id ?? null,
      project_id: patch.project_id ?? null,
      purchase_price: patch.purchase_price ?? null,
      rehab_or_site_cost: patch.rehab_or_site_cost ?? null,
      closing_costs: patch.closing_costs ?? null,
      holding_costs: patch.holding_costs ?? null,
      financing_costs: patch.financing_costs ?? null,
      exit_value: patch.exit_value ?? null,
      expected_rent: patch.expected_rent ?? null,
      notes: row.notes ?? null,
    } as DealScenario;
    localSet(LOCAL_SCENARIOS, [scenario, ...localGet<DealScenario[]>(LOCAL_SCENARIOS, [])]);
    return { data: scenario, error: null };
  }
  const { data, error } = await supabase.from("meridian_deal_scenarios").insert(row).select().single();
  return { data: (data as DealScenario) ?? null, error: error?.message ?? null };
}

export async function saveGeneratedMemo(patch: { title: string; body: string; memo_type?: string; deal_id?: string | null; project_id?: string | null }, actor: string): Promise<{ data: GeneratedMemo | null; error: string | null }> {
  const row = { ...patch, memo_type: patch.memo_type ?? "deal-brief", created_by: actor };
  if (!supabase) {
    const now = new Date().toISOString();
    const memo: GeneratedMemo = { id: `memo-${Date.now()}`, deleted_at: null, created_at: now, ...row, deal_id: patch.deal_id ?? null, project_id: patch.project_id ?? null, memo_type: row.memo_type };
    localSet(LOCAL_MEMOS, [memo, ...localGet<GeneratedMemo[]>(LOCAL_MEMOS, [])]);
    return { data: memo, error: null };
  }
  const { data, error } = await supabase.from("meridian_generated_memos").insert(row).select().single();
  return { data: (data as GeneratedMemo) ?? null, error: error?.message ?? null };
}
