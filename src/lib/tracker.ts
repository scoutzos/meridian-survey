// Contribution Tracker — shared types, queries, and computation.
//
// All math is done client-side off the raw rows so realtime updates can mutate
// derived numbers immediately without round-tripping through Postgres views.
// (The SQL view `tracker_funding_status` exists too, for ad-hoc queries.)

import { supabase } from "./supabase";
import { MEMBERS } from "@/data/questions";

// ---------- types ----------------------------------------------------------

export type CapitalCallStatus = "suggested" | "open" | "closed" | "cancelled";
export type ContributionType = "initial_contribution" | "monthly_dues" | "capital_call" | "expense";
export type MemberStatus = "active" | "withdrawn";

export interface MemberProfile {
  member_name: string;
  llc_name: string;
  is_admin: boolean;
  member_status?: MemberStatus | null;
  withdrawn_effective_date?: string | null;
  withdrawn_at?: string | null;
  withdrawn_by?: string | null;
  withdrawal_note?: string | null;
}

export interface TrackerMember {
  name: string;
  llcName: string;
  memberStatus: MemberStatus;
  withdrawnEffectiveDate: string | null;
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

export const MEMBER_COUNT: number = MEMBERS.length;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMemberStatus(value: MemberProfile["member_status"] | undefined): MemberStatus {
  return value === "withdrawn" ? "withdrawn" : "active";
}

function activeOn(status: MemberStatus, withdrawnEffectiveDate: string | null, asOfDate?: string | null): boolean {
  if (status !== "withdrawn") return true;
  if (!withdrawnEffectiveDate) return false;
  if (!asOfDate) return false;
  return asOfDate < withdrawnEffectiveDate;
}

export function isMemberProfileActiveOn(profile: MemberProfile | undefined, asOfDate?: string | null): boolean {
  if (!profile) return true;
  return activeOn(normalizeMemberStatus(profile.member_status), profile.withdrawn_effective_date ?? null, asOfDate ?? todayIso());
}

function isTrackerMemberActiveOn(member: TrackerMember, asOfDate?: string | null): boolean {
  return activeOn(member.memberStatus, member.withdrawnEffectiveDate, asOfDate ?? todayIso());
}

export function allTrackerMembers(profiles: MemberProfile[]): TrackerMember[] {
  const rows = new Map<string, TrackerMember>();
  for (const member of MEMBERS) {
    rows.set(member, { name: member, llcName: member, memberStatus: "active", withdrawnEffectiveDate: null });
  }
  for (const profile of profiles) {
    rows.set(profile.member_name, {
      name: profile.member_name,
      llcName: profile.llc_name || profile.member_name,
      memberStatus: normalizeMemberStatus(profile.member_status),
      withdrawnEffectiveDate: profile.withdrawn_effective_date ?? null,
    });
  }
  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function activeTrackerMembers(profiles: MemberProfile[], asOfDate?: string | null): TrackerMember[] {
  return allTrackerMembers(profiles).filter(member => isTrackerMemberActiveOn(member, asOfDate ?? todayIso()));
}

export function activeMemberCountOn(members: TrackerMember[], asOfDate?: string | null): number {
  return members.filter(member => isTrackerMemberActiveOn(member, asOfDate ?? todayIso())).length;
}

function membersActiveOn(members: TrackerMember[], asOfDate?: string | null): TrackerMember[] {
  return members.filter(member => isTrackerMemberActiveOn(member, asOfDate ?? todayIso()));
}

export const CONTRIBUTION_TYPE_LABEL: Record<ContributionType, string> = {
  initial_contribution: "Initial",
  monthly_dues: "Monthly Dues",
  capital_call: "Capital Call",
  expense: "Expense",
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

function targetMembersFromInput(input: number | TrackerMember[]): { memberCount: number; members: TrackerMember[] | null } {
  if (Array.isArray(input)) return { memberCount: activeMemberCountOn(input), members: input };
  return { memberCount: input, members: null };
}

export function computeTargets(expenses: Expense[], settings: TrackerSettings | null, activeMemberCount: number | TrackerMember[] = MEMBER_COUNT): Targets {
  const start = settings?.llc_start_date ?? null;
  const monthsTracked = settings?.months_tracked ?? 3;
  const { memberCount, members } = targetMembersFromInput(activeMemberCount);

  let initialBucketSum = 0;
  let monthlyBucketSum = 0;
  const perMemberInitial = new Map<string, number>();
  const perMemberMonthly = new Map<string, number>();

  for (const e of expenses) {
    if (e.deleted_at) continue;
    const b = monthBucket(e.expense_date, start);
    if (b === "Unclassified") continue;

    if (!members) {
      if (b === "Pre-formation" || b === "M1") initialBucketSum += Number(e.amount);
      else monthlyBucketSum += Number(e.amount);
      continue;
    }

    const activeMembers = membersActiveOn(members, e.expense_date);
    if (activeMembers.length === 0) continue;
    const share = Number(e.amount) / activeMembers.length;
    const targetMap = b === "Pre-formation" || b === "M1" ? perMemberInitial : perMemberMonthly;
    for (const member of activeMembers) {
      targetMap.set(member.name, (targetMap.get(member.name) ?? 0) + share);
    }
  }

  if (members) {
    const currentMembers = membersActiveOn(members);
    initialBucketSum = currentMembers.reduce((sum, member) => sum + (perMemberInitial.get(member.name) ?? 0), 0);
    monthlyBucketSum = currentMembers.reduce((sum, member) => sum + (perMemberMonthly.get(member.name) ?? 0), 0);
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
  memberStatus: MemberStatus;
  withdrawnEffectiveDate: string | null;
  isActive: boolean;
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
  members: TrackerMember[];
  expenses: Expense[];
  contributions: Contribution[];
  capitalCalls: CapitalCall[];
  settings: TrackerSettings | null;
}): MemberBalance[] {
  const { members, expenses, contributions, capitalCalls, settings } = args;
  const start = settings?.llc_start_date ?? null;

  return members.map(m => {
    let initialTarget = 0;
    let monthlyTarget = 0;
    let capitalCalled = 0;
    let initialPaidExpenses = 0;
    let monthlyPaidExpenses = 0;

    for (const e of expenses) {
      if (e.deleted_at) continue;
      const b = monthBucket(e.expense_date, start);
      if (b === "Unclassified") continue;

      const activeMembers = membersActiveOn(members, e.expense_date);
      if (activeMembers.some(member => member.name === m.name)) {
        const share = activeMembers.length > 0 ? Number(e.amount) / activeMembers.length : 0;
        if (b === "Pre-formation" || b === "M1") initialTarget += share;
        else monthlyTarget += share;
      }

      if (e.paid_by_member_name !== m.name) continue;
      if (b === "Pre-formation" || b === "M1") initialPaidExpenses += Number(e.amount);
      else monthlyPaidExpenses += Number(e.amount);
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
      else if (c.type === "expense") {
        const b = monthBucket(c.contribution_date, start);
        if (b === "Pre-formation" || b === "M1") initialContrib += Number(c.amount);
        else monthlyContrib += Number(c.amount);
      }
    }

    for (const call of capitalCalls) {
      if (call.deleted_at || call.status !== "open") continue;
      const activeMembers = membersActiveOn(members, call.date_called);
      if (!activeMembers.some(member => member.name === m.name)) continue;
      const storedShare = Number(call.per_member_amount);
      capitalCalled += Number.isFinite(storedShare) && storedShare > 0
        ? storedShare
        : activeMembers.length > 0
          ? Number(call.total_amount) / activeMembers.length
          : 0;
    }

    const initialPaid = initialPaidExpenses + initialContrib;
    const monthlyPaid = monthlyPaidExpenses + monthlyContrib;

    const initialRemaining = Math.max(0, initialTarget - initialPaid);
    const monthlyRemaining = Math.max(0, monthlyTarget - monthlyPaid);
    const capitalRemaining = Math.max(0, capitalCalled - capitalContrib);

    return {
      memberName: m.name,
      llcName: m.llcName,
      memberStatus: m.memberStatus,
      withdrawnEffectiveDate: m.withdrawnEffectiveDate,
      isActive: isTrackerMemberActiveOn(m),
      initialTarget,
      initialPaid,
      initialRemaining,
      monthlyTarget,
      monthlyPaid,
      monthlyRemaining,
      capitalCalled,
      capitalPaid: capitalContrib,
      capitalRemaining,
      totalOwed: initialTarget + monthlyTarget + capitalCalled,
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
  activeMemberCount: number | TrackerMember[] = MEMBER_COUNT,
): FundingStatus {
  const { memberCount } = targetMembersFromInput(activeMemberCount);
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
    memberCount,
    shortfallPerMember: memberCount > 0 ? shortfall / memberCount : 0,
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
  const profile = profiles.find(p => p.member_name === memberName);
  return profile?.is_admin === true && isMemberProfileActiveOn(profile);
}
