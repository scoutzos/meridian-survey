// Contribution Tracker — shared types, queries, and computation.
//
// All math is done client-side off the raw rows so realtime updates can mutate
// derived numbers immediately without round-tripping through Postgres views.
// (The SQL view `tracker_funding_status` exists too, for ad-hoc queries.)

import { supabase } from "./supabase";
import { MEMBERS } from "@/data/questions";

// ---------- types ----------------------------------------------------------

export type CapitalCallStatus = "suggested" | "open" | "closed" | "cancelled";
export type ContributionType = "initial_contribution" | "monthly_dues" | "capital_call";

export interface MemberProfile {
  member_name: string;
  llc_name: string;
  is_admin: boolean;
}

export interface TrackerSettings {
  key: "tracker";
  llc_start_date: string | null;
  months_tracked: number;
  updated_at: string;
  updated_by: string | null;
}

export interface Expense {
  id: number;
  expense_date: string | null;
  category: string;
  description: string;
  amount: number;
  paid_by_member_name: string | null;
  paid_by_label: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface Contribution {
  id: number;
  contribution_date: string;
  member_name: string;
  type: ContributionType;
  amount: number;
  reference: string | null;
  notes: string | null;
  related_capital_call_id: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface CapitalCall {
  id: number;
  date_called: string;
  reason: string;
  total_amount: number;
  per_member_amount: number;
  status: CapitalCallStatus;
  auto_suggested: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface AuditLogEntry {
  id?: number;
  occurred_at?: string;
  actor: string | null;
  table_name: string;
  row_id: string;
  action: "create" | "update" | "delete";
  diff: Record<string, unknown> | null;
}

// ---------- constants ------------------------------------------------------

export const MEMBER_COUNT = MEMBERS.length;

export const CONTRIBUTION_TYPE_LABEL: Record<ContributionType, string> = {
  initial_contribution: "Initial",
  monthly_dues: "Monthly Dues",
  capital_call: "Capital Call",
};

export const CAPITAL_CALL_STATUS_LABEL: Record<CapitalCallStatus, string> = {
  suggested: "Suggested",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const EXPENSE_CATEGORIES = [
  "Startup",
  "VA",
  "Lead-gen",
  "Operations",
  "Legal",
  "Marketing",
  "Other",
];

// ---------- month bucket ---------------------------------------------------

export function monthBucket(expenseDate: string | null, llcStart: string | null): string {
  if (!expenseDate) return "Unclassified";
  if (!llcStart) return "M1";
  const d = new Date(expenseDate + "T00:00:00Z");
  const s = new Date(llcStart + "T00:00:00Z");
  if (d < s) return "Pre-formation";
  const months = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + (d.getUTCMonth() - s.getUTCMonth());
  return `M${months + 1}`;
}

// ---------- targets --------------------------------------------------------

export interface Targets {
  initialTarget: number;          // per-member initial bucket
  monthlyTargetPerMonth: number;  // per-member, per-month
  monthlyTargetTotal: number;     // per-member × (months_tracked - 1)
  memberCount: number;
}

export function computeTargets(expenses: Expense[], settings: TrackerSettings | null): Targets {
  const start = settings?.llc_start_date ?? null;
  const monthsTracked = settings?.months_tracked ?? 3;
  const memberCount = MEMBER_COUNT;

  let initialBucketSum = 0;
  let monthlyBucketSum = 0;

  for (const e of expenses) {
    if (e.deleted_at) continue;
    const b = monthBucket(e.expense_date, start);
    if (b === "Pre-formation" || b === "M1") initialBucketSum += Number(e.amount);
    else if (b !== "Unclassified") monthlyBucketSum += Number(e.amount);
  }

  const initialTarget = memberCount > 0 ? initialBucketSum / memberCount : 0;
  const monthsForDues = Math.max(0, monthsTracked - 1);
  const monthlyTargetPerMonth = monthsForDues > 0 && memberCount > 0
    ? monthlyBucketSum / memberCount / monthsForDues
    : 0;
  const monthlyTargetTotal = monthlyTargetPerMonth * monthsForDues;

  return { initialTarget, monthlyTargetPerMonth, monthlyTargetTotal, memberCount };
}

// ---------- per-member balances --------------------------------------------

export interface MemberBalance {
  memberName: string;
  llcName: string;
  initialTarget: number;
  initialPaid: number;
  initialRemaining: number;
  monthlyTarget: number;
  monthlyPaid: number;
  monthlyRemaining: number;
  capitalCalled: number;
  capitalPaid: number;
  capitalRemaining: number;
  totalOwed: number;
  totalRemaining: number;
}

export function computeMemberBalances(args: {
  members: { name: string; llcName: string }[];
  expenses: Expense[];
  contributions: Contribution[];
  capitalCalls: CapitalCall[];
  settings: TrackerSettings | null;
}): MemberBalance[] {
  const { members, expenses, contributions, capitalCalls, settings } = args;
  const start = settings?.llc_start_date ?? null;
  const targets = computeTargets(expenses, settings);

  const openCallsTotal = capitalCalls
    .filter(c => !c.deleted_at && c.status === "open")
    .reduce((s, c) => s + Number(c.total_amount), 0);
  const capitalCalledPerMember = members.length > 0 ? openCallsTotal / members.length : 0;

  return members.map(m => {
    let initialPaidExpenses = 0;
    let monthlyPaidExpenses = 0;
    for (const e of expenses) {
      if (e.deleted_at) continue;
      if (e.paid_by_member_name !== m.name) continue;
      const b = monthBucket(e.expense_date, start);
      if (b === "Pre-formation" || b === "M1") initialPaidExpenses += Number(e.amount);
      else if (b !== "Unclassified") monthlyPaidExpenses += Number(e.amount);
    }

    let initialContrib = 0;
    let monthlyContrib = 0;
    let capitalContrib = 0;
    for (const c of contributions) {
      if (c.deleted_at) continue;
      if (c.member_name !== m.name) continue;
      if (c.type === "initial_contribution") initialContrib += Number(c.amount);
      else if (c.type === "monthly_dues") monthlyContrib += Number(c.amount);
      else if (c.type === "capital_call") capitalContrib += Number(c.amount);
    }

    const initialPaid = initialPaidExpenses + initialContrib;
    const monthlyPaid = monthlyPaidExpenses + monthlyContrib;

    const initialRemaining = Math.max(0, targets.initialTarget - initialPaid);
    const monthlyRemaining = Math.max(0, targets.monthlyTargetTotal - monthlyPaid);
    const capitalRemaining = Math.max(0, capitalCalledPerMember - capitalContrib);

    return {
      memberName: m.name,
      llcName: m.llcName,
      initialTarget: targets.initialTarget,
      initialPaid,
      initialRemaining,
      monthlyTarget: targets.monthlyTargetTotal,
      monthlyPaid,
      monthlyRemaining,
      capitalCalled: capitalCalledPerMember,
      capitalPaid: capitalContrib,
      capitalRemaining,
      totalOwed: targets.initialTarget + targets.monthlyTargetTotal + capitalCalledPerMember,
      totalRemaining: initialRemaining + monthlyRemaining + capitalRemaining,
    };
  });
}

// ---------- funding status (shortfall) -------------------------------------

export interface FundingStatus {
  totalExpenses: number;
  openCapitalCalls: number;
  totalDeposits: number;
  totalFundingNeed: number;
  shortfall: number;          // max(0, need - deposits)
  memberCount: number;
  shortfallPerMember: number; // shortfall / memberCount
}

export function computeFundingStatus(
  expenses: Expense[],
  contributions: Contribution[],
  capitalCalls: CapitalCall[],
): FundingStatus {
  const totalExpenses = expenses
    .filter(e => !e.deleted_at)
    .reduce((s, e) => s + Number(e.amount), 0);
  const openCapitalCalls = capitalCalls
    .filter(c => !c.deleted_at && c.status === "open")
    .reduce((s, c) => s + Number(c.total_amount), 0);
  const totalDeposits = contributions
    .filter(c => !c.deleted_at)
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalFundingNeed = totalExpenses + openCapitalCalls;
  const shortfall = Math.max(0, totalFundingNeed - totalDeposits);
  return {
    totalExpenses,
    openCapitalCalls,
    totalDeposits,
    totalFundingNeed,
    shortfall,
    memberCount: MEMBER_COUNT,
    shortfallPerMember: MEMBER_COUNT > 0 ? shortfall / MEMBER_COUNT : 0,
  };
}

// ---------- formatting -----------------------------------------------------

export function fmtUSD(n: number, opts: { fractionDigits?: number } = {}): string {
  const fd = opts.fractionDigits ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
  }).format(n);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// ---------- audit log ------------------------------------------------------

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  if (!supabase) return;
  await supabase.from("tracker_audit_log").insert({
    actor: entry.actor,
    table_name: entry.table_name,
    row_id: entry.row_id,
    action: entry.action,
    diff: entry.diff,
  });
}

// ---------- common fetchers ------------------------------------------------

export async function fetchAll(): Promise<{
  settings: TrackerSettings | null;
  profiles: MemberProfile[];
  expenses: Expense[];
  contributions: Contribution[];
  capitalCalls: CapitalCall[];
} | null> {
  if (!supabase) return null;
  const [settingsRes, profilesRes, expRes, contribRes, callsRes] = await Promise.all([
    supabase.from("tracker_settings").select("*").eq("key", "tracker").maybeSingle(),
    supabase.from("tracker_member_profiles").select("*").order("member_name"),
    supabase.from("tracker_expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: true, nullsFirst: false }),
    supabase.from("tracker_contributions").select("*").is("deleted_at", null).order("contribution_date", { ascending: false }),
    supabase.from("tracker_capital_calls").select("*").is("deleted_at", null).order("date_called", { ascending: false }),
  ]);
  return {
    settings: (settingsRes.data as TrackerSettings | null) ?? null,
    profiles: (profilesRes.data as MemberProfile[] | null) ?? [],
    expenses: (expRes.data as Expense[] | null) ?? [],
    contributions: (contribRes.data as Contribution[] | null) ?? [],
    capitalCalls: (callsRes.data as CapitalCall[] | null) ?? [],
  };
}

export function getLlcName(profiles: MemberProfile[], memberName: string): string {
  return profiles.find(p => p.member_name === memberName)?.llc_name ?? memberName;
}

export function isAdmin(profiles: MemberProfile[], memberName: string | null): boolean {
  if (!memberName) return false;
  return profiles.find(p => p.member_name === memberName)?.is_admin === true;
}
