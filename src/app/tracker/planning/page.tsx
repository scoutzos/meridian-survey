"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Expense,
  EXPENSE_CATEGORIES,
  CapitalCall,
  Contribution,
  MEMBER_COUNT,
  MemberProfile,
  TrackerSettings,
  computeFundingStatus,
  fmtUSD,
  isAdmin,
  logAudit,
  monthBucket,
} from "@/lib/tracker";
import { MEMBERS } from "@/data/questions";
import { createActionItem } from "@/lib/action-items";
import { createNotification } from "@/lib/operations";
import TrackerShell, {
  trackerBtn,
  trackerBtnGhost,
  trackerBtnSubtle,
  trackerCard,
  trackerInput,
} from "@/components/TrackerShell";

type ProposalStatus = "draft" | "review" | "revision_needed" | "approved" | "rejected" | "converted";
type ExpenseKind = "fixed" | "hourly";
type Cadence = "monthly" | "quarterly" | "one_time";
type VoteDecision = "approve" | "reject" | "abstain" | "request_changes";
type OffsetKind = "increase" | "reduce" | "remove";
type ProposalFilter = "needs_my_vote" | "review" | "revision_needed" | "approved" | "converted" | "rejected" | "all";

interface ExpenseProposal {
  id: string;
  title: string;
  category: string;
  expense_kind: ExpenseKind;
  cadence: Cadence;
  hourly_rate: number | null;
  hours_per_month: number | null;
  upfront_amount: number;
  monthly_amount: number;
  one_time_amount: number;
  member_cap: number;
  is_budgeted: boolean;
  start_month: string | null;
  duration_months: number;
  notes: string | null;
  status: ProposalStatus;
  approval_rule: string;
  minimum_oa_approvals: number;
  required_approvals: number;
  converted_expense_id: number | null;
  revision_number: number;
  revision_note: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

interface ProposalVote {
  id: string;
  proposal_id: string;
  proposal_version: number;
  member_name: string;
  decision: VoteDecision;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface ProposalOffset {
  id: string;
  proposal_id: string;
  source_expense_id: number | null;
  title: string;
  offset_kind: OffsetKind;
  cadence: Cadence;
  amount: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

type OffsetDraft = Pick<ProposalOffset, "title" | "offset_kind" | "cadence" | "amount" | "source_expense_id" | "notes">;

const DEFAULT_MEMBER_CAP = 250;

function toNumber(value: string): number {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function monthSort(bucket: string): number {
  if (bucket === "Pre-formation" || bucket === "Unclassified") return -1;
  const n = Number(bucket.replace("M", ""));
  return Number.isFinite(n) ? n : -1;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function resolveRule(args: {
  amount: number;
  isBudgeted: boolean;
  cadence: Cadence;
}): { approvalRule: string; minimumApprovals: number; requiredApprovals: number } {
  if (args.amount > 10000) {
    return {
      approvalRule: "All-member written consent required: proposed spend is over the $10,000 signature-authority working default.",
      minimumApprovals: 6,
      requiredApprovals: 6,
    };
  }
  if (!args.isBudgeted) {
    return {
      approvalRule: `All-member written consent required: this is ${args.cadence !== "one_time" ? "recurring " : ""}unbudgeted spend that affects member contributions.`,
      minimumApprovals: 4,
      requiredApprovals: 6,
    };
  }
  return {
    approvalRule: "Majority approval required: ordinary budgeted operations or administrative spending.",
    minimumApprovals: 4,
    requiredApprovals: 4,
  };
}

function statusLabel(status: ProposalStatus): string {
  return status.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function decisionLabel(decision: VoteDecision): string {
  if (decision === "request_changes") return "Changes requested";
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Not recorded";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextProposalStatus(proposal: ExpenseProposal, proposalVotes: ProposalVote[]): ProposalStatus {
  if (proposal.status === "converted") return "converted";
  if (proposalVotes.some(v => v.decision === "request_changes")) return "revision_needed";
  const approved = proposalVotes.filter(v => v.decision === "approve").length;
  const rejected = proposalVotes.filter(v => v.decision === "reject").length;
  if (approved >= proposal.required_approvals) return "approved";
  if (MEMBER_COUNT - rejected < proposal.required_approvals) return "rejected";
  return "review";
}

function firstPeriodAmount(cadence: Cadence, amount: number): number {
  return cadence === "one_time" || cadence === "monthly" || cadence === "quarterly" ? amount : 0;
}

function monthlyEquivalentAmount(cadence: Cadence, amount: number): number {
  if (cadence === "monthly") return amount;
  if (cadence === "quarterly") return amount / 3;
  return 0;
}

function budgetChangeSign(kind: OffsetKind): 1 | -1 {
  return kind === "increase" ? 1 : -1;
}

function budgetChangeVerb(kind: OffsetKind): string {
  if (kind === "increase") return "Increase";
  if (kind === "remove") return "Remove";
  return "Reduce";
}

function cadenceLabel(cadence: Cadence): string {
  if (cadence === "one_time") return "One-time";
  if (cadence === "quarterly") return "Quarterly";
  return "Monthly";
}

function budgetChangeEffect(kind: OffsetKind): string {
  if (kind === "increase") return "Adds to the approved budget";
  if (kind === "remove") return "Removes existing budget";
  return "Reduces existing budget";
}

export default function ExpensePlanningPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [proposals, setProposals] = useState<ExpenseProposal[]>([]);
  const [offsets, setOffsets] = useState<ProposalOffset[]>([]);
  const [votes, setVotes] = useState<ProposalVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voteNote, setVoteNote] = useState("");
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>("needs_my_vote");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<ExpenseProposal | null>(null);
  const [revisionNote, setRevisionNote] = useState("");

  const [title, setTitle] = useState("New VA");
  const [category, setCategory] = useState("VA");
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>("hourly");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [hourlyRate, setHourlyRate] = useState("7");
  const [hoursPerMonth, setHoursPerMonth] = useState("14");
  const [fixedAmount, setFixedAmount] = useState("");
  const [upfrontAmount, setUpfrontAmount] = useState("");
  const [memberCap, setMemberCap] = useState(String(DEFAULT_MEMBER_CAP));
  const [durationMonths, setDurationMonths] = useState("1");
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 10));
  const [isBudgeted, setIsBudgeted] = useState(false);
  const [notes, setNotes] = useState("");
  const [offsetTitle, setOffsetTitle] = useState("");
  const [offsetKind, setOffsetKind] = useState<OffsetKind>("increase");
  const [offsetCadence, setOffsetCadence] = useState<Cadence>("monthly");
  const [offsetAmount, setOffsetAmount] = useState("");
  const [offsetSourceId, setOffsetSourceId] = useState("");
  const [offsetNotes, setOffsetNotes] = useState("");
  const [offsetDrafts, setOffsetDrafts] = useState<OffsetDraft[]>([]);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("tracker_planning_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_expenses" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_expense_proposals" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_expense_proposal_offsets" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_expense_proposal_votes" }, () => load())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [s, p, e, pr, o, v] = await Promise.all([
      supabase.from("tracker_settings").select("*").eq("key", "tracker").maybeSingle(),
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
      supabase.from("tracker_expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: true, nullsFirst: false }),
      supabase.from("tracker_expense_proposals").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("tracker_expense_proposal_offsets").select("*").is("deleted_at", null).order("created_at", { ascending: true }),
      supabase.from("tracker_expense_proposal_votes").select("*").order("updated_at", { ascending: false }),
    ]);
    setSettings((s.data as TrackerSettings | null) ?? null);
    setProfiles((p.data as MemberProfile[] | null) ?? []);
    setExpenses((e.data as Expense[] | null) ?? []);
    setProposals((pr.data as ExpenseProposal[] | null) ?? []);
    setOffsets((o.data as ProposalOffset[] | null) ?? []);
    setVotes((v.data as ProposalVote[] | null) ?? []);
    setLoading(false);
  }

  const currentMonthly = useMemo(() => {
    const start = settings?.llc_start_date ?? null;
    const totals = new Map<string, number>();
    for (const e of expenses) {
      if (e.deleted_at) continue;
      const bucket = monthBucket(e.expense_date, start);
      if (monthSort(bucket) < 1) continue;
      totals.set(bucket, (totals.get(bucket) ?? 0) + Number(e.amount));
    }
    const latest = Array.from(totals.entries()).sort((a, b) => monthSort(b[0]) - monthSort(a[0]))[0];
    return { bucket: latest?.[0] ?? "No month", amount: latest?.[1] ?? 0 };
  }, [expenses, settings]);

  if (!user) return null;

  const admin = isAdmin(profiles, user);
  const cap = toNumber(memberCap);
  const teamCap = cap * MEMBER_COUNT;
  const duration = Math.max(1, Math.round(toNumber(durationMonths)));
  const hourlyCost = toNumber(hourlyRate) * toNumber(hoursPerMonth);
  const enteredFixed = toNumber(fixedAmount);
  const upfrontCost = toNumber(upfrontAmount);
  const proposedImpact = expenseKind === "hourly" ? hourlyCost : enteredFixed;
  const monthlyAmount = cadence === "monthly" || cadence === "quarterly" ? proposedImpact : 0;
  const oneTimeAmount = cadence === "one_time" ? proposedImpact : 0;
  const grossFirstMonthImpact = (cadence === "one_time" ? oneTimeAmount : monthlyAmount) + upfrontCost;
  const grossOngoingMonthlyImpact = monthlyEquivalentAmount(cadence, monthlyAmount);
  const budgetChangeFirstMonthImpact = offsetDrafts.reduce((sum, o) => sum + (budgetChangeSign(o.offset_kind) * firstPeriodAmount(o.cadence, Number(o.amount))), 0);
  const budgetChangeOngoingMonthlyImpact = offsetDrafts.reduce((sum, o) => sum + (budgetChangeSign(o.offset_kind) * monthlyEquivalentAmount(o.cadence, Number(o.amount))), 0);
  const firstMonthImpact = grossFirstMonthImpact + budgetChangeFirstMonthImpact;
  const ongoingMonthlyImpact = grossOngoingMonthlyImpact + budgetChangeOngoingMonthlyImpact;
  const newMonthlyTotal = currentMonthly.amount + firstMonthImpact;
  const ongoingMonthlyTotal = currentMonthly.amount + ongoingMonthlyImpact;
  const newPerMember = MEMBER_COUNT > 0 ? newMonthlyTotal / MEMBER_COUNT : 0;
  const ongoingPerMember = MEMBER_COUNT > 0 ? ongoingMonthlyTotal / MEMBER_COUNT : 0;
  const availableRoom = teamCap - currentMonthly.amount;
  const overUnder = teamCap - newMonthlyTotal;
  const ongoingOverUnder = teamCap - ongoingMonthlyTotal;
  const rule = resolveRule({ amount: Math.max(grossFirstMonthImpact, grossOngoingMonthlyImpact), isBudgeted, cadence });

  function addOffsetDraft() {
    const amount = toNumber(offsetAmount);
    const linked = expenses.find(e => String(e.id) === offsetSourceId);
    const draftTitle = offsetTitle.trim() || linked?.description || `${budgetChangeVerb(offsetKind)} expense`;
    if (amount <= 0 || !draftTitle) return;
    setOffsetDrafts(prev => [
      ...prev,
      {
        title: draftTitle,
        offset_kind: offsetKind,
        cadence: offsetCadence,
        amount,
        source_expense_id: offsetSourceId ? Number(offsetSourceId) : null,
        notes: offsetNotes.trim() || null,
      },
    ]);
    setOffsetTitle("");
    setOffsetAmount("");
    setOffsetSourceId("");
    setOffsetNotes("");
  }

  async function saveProposal() {
    if (!supabase || !user) return;
    if (!title.trim() || grossFirstMonthImpact <= 0) return;
    setSaving(true);
    const row = {
      title: title.trim(),
      category,
      expense_kind: expenseKind,
      cadence,
      hourly_rate: expenseKind === "hourly" ? toNumber(hourlyRate) : null,
      hours_per_month: expenseKind === "hourly" ? toNumber(hoursPerMonth) : null,
      upfront_amount: upfrontCost,
      monthly_amount: monthlyAmount,
      one_time_amount: oneTimeAmount,
      member_cap: cap,
      is_budgeted: isBudgeted,
      start_month: startMonth || null,
      duration_months: cadence === "one_time" ? 1 : duration,
      notes: notes.trim() || null,
      status: "review",
      approval_rule: rule.approvalRule,
      minimum_oa_approvals: rule.minimumApprovals,
      required_approvals: rule.requiredApprovals,
      created_by: user,
      updated_by: user,
    };
    if (revisionTarget) {
      const nextVersion = (revisionTarget.revision_number ?? 1) + 1;
      const { data, error } = await supabase
        .from("tracker_expense_proposals")
        .update({
          ...row,
          status: "review",
          revision_number: nextVersion,
          revision_note: revisionNote.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: user,
        })
        .eq("id", revisionTarget.id)
        .select()
        .single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      await supabase
        .from("tracker_expense_proposal_offsets")
        .update({ deleted_at: new Date().toISOString(), updated_by: user })
        .eq("proposal_id", revisionTarget.id)
        .is("deleted_at", null);
      if (offsetDrafts.length) {
        const offsetRows = offsetDrafts.map(o => ({
          proposal_id: revisionTarget.id,
          source_expense_id: o.source_expense_id,
          title: o.title,
          offset_kind: o.offset_kind,
          cadence: o.cadence,
          amount: o.amount,
          notes: o.notes,
          created_by: user,
          updated_by: user,
        }));
        const { error: offsetError } = await supabase.from("tracker_expense_proposal_offsets").insert(offsetRows);
        if (offsetError) { alert(offsetError.message); return; }
      }
      await logAudit({
        actor: user,
        table_name: "tracker_expense_proposals",
        row_id: revisionTarget.id,
        action: "update",
        diff: { before: revisionTarget, after: data, offsets: offsetDrafts, revisionNote },
      });
      await Promise.all(MEMBERS.map(member => createNotification({
        title: `Expense proposal revised: ${title.trim()}`,
        body: `Version ${nextVersion} is ready for a new vote. ${revisionNote.trim() || "Review the updated proposal details."}`,
        priority: "high",
        assigned_to: member,
        href: `/tracker/planning?proposal=${revisionTarget.id}`,
        source_table: "tracker_expense_proposals",
        source_id: revisionTarget.id,
        notification_type: "expense_proposal_revised",
      }, user)));
      setNotes("");
      setRevisionNote("");
      setRevisionTarget(null);
      setOffsetDrafts([]);
      setBuilderOpen(false);
      setInboxOpen(true);
      setExpandedProposalId(revisionTarget.id);
      void load();
      return;
    }
    const { data, error } = await supabase.from("tracker_expense_proposals").insert(row).select().single();
    setSaving(false);
    if (error) { alert(error.message); return; }
    const proposal = data as ExpenseProposal;
    if (offsetDrafts.length) {
      const offsetRows = offsetDrafts.map(o => ({
        proposal_id: proposal.id,
        source_expense_id: o.source_expense_id,
        title: o.title,
        offset_kind: o.offset_kind,
        cadence: o.cadence,
        amount: o.amount,
        notes: o.notes,
        created_by: user,
        updated_by: user,
      }));
      const { error: offsetError } = await supabase.from("tracker_expense_proposal_offsets").insert(offsetRows);
      if (offsetError) { alert(offsetError.message); return; }
    }
    await logAudit({
      actor: user,
      table_name: "tracker_expense_proposals",
      row_id: String(proposal.id),
      action: "create",
      diff: { after: data, offsets: offsetDrafts },
    });
    await Promise.all(MEMBERS.map(member => createNotification({
      title: `Expense proposal needs your vote: ${proposal.title}`,
      body: `${fmtUSD(firstMonthImpact)} net first-month impact. Approval required: ${proposal.required_approvals} of ${MEMBER_COUNT}.`,
      priority: "high",
      assigned_to: member,
      href: `/tracker/planning?proposal=${proposal.id}`,
      source_table: "tracker_expense_proposals",
      source_id: proposal.id,
      notification_type: "expense_proposal_vote",
    }, user)));
    await Promise.all(MEMBERS.map(member => createActionItem({
      title: `Review expense proposal: ${proposal.title}`,
      description: `Review and vote on the expense proposal in Money -> Planning. Net first-month impact: ${fmtUSD(firstMonthImpact)}.`,
      assigned_to: member,
      due_date: addDays(2),
    }, user)));
    setNotes("");
    setOffsetDrafts([]);
    setBuilderOpen(false);
    setInboxOpen(true);
    setExpandedProposalId(proposal.id);
    void load();
  }

  async function vote(proposal: ExpenseProposal, decision: VoteDecision) {
    if (!supabase || !user) return;
    const row = {
      proposal_id: proposal.id,
      proposal_version: proposal.revision_number ?? 1,
      member_name: user,
      decision,
      note: voteNote.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("tracker_expense_proposal_votes")
      .upsert(row, { onConflict: "proposal_id,member_name,proposal_version" });
    if (error) { alert(error.message); return; }
    const existing = votesFor(proposal.id).filter(v => v.member_name !== user);
    const simulatedVote: ProposalVote = {
      id: "",
      proposal_id: proposal.id,
      proposal_version: proposal.revision_number ?? 1,
      member_name: user,
      decision,
      note: voteNote.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextStatus = nextProposalStatus(proposal, [...existing, simulatedVote]);
    if (nextStatus !== proposal.status) {
      await supabase
        .from("tracker_expense_proposals")
        .update({ status: nextStatus, updated_at: new Date().toISOString(), updated_by: user })
        .eq("id", proposal.id);
      if (nextStatus === "approved" || nextStatus === "rejected") {
        await Promise.all(MEMBERS.map(member => createNotification({
          title: `Expense proposal ${nextStatus}: ${proposal.title}`,
          body: nextStatus === "approved"
            ? "The proposal reached the required approvals and is ready for admin conversion."
            : "The proposal can no longer reach the required approval threshold.",
          priority: nextStatus === "approved" ? "high" : "normal",
          assigned_to: member,
          href: `/tracker/planning?proposal=${proposal.id}`,
          source_table: "tracker_expense_proposals",
          source_id: proposal.id,
          notification_type: `expense_proposal_${nextStatus}`,
        }, user)));
      }
      if (nextStatus === "revision_needed") {
        await Promise.all(MEMBERS.map(member => createNotification({
          title: `Changes requested: ${proposal.title}`,
          body: `${user} requested changes before approval. Review the note and revise the proposal for a new vote.`,
          priority: "high",
          assigned_to: member,
          href: `/tracker/planning?proposal=${proposal.id}`,
          source_table: "tracker_expense_proposals",
          source_id: proposal.id,
          notification_type: "expense_proposal_revision_needed",
        }, user)));
      }
    }
    await logAudit({
      actor: user,
      table_name: "tracker_expense_proposal_votes",
      row_id: `${proposal.id}:${user}`,
      action: "update",
      diff: { after: row },
    });
    setVoteNote("");
    void load();
  }

  async function convertToExpenses(proposal: ExpenseProposal) {
    if (!supabase || !user || !admin) return;
    const proposalVotes = votesFor(proposal.id);
    const approved = proposalVotes.filter(v => v.decision === "approve").length;
    if (approved < proposal.required_approvals) return;

    const months = proposal.cadence === "monthly" ? proposal.duration_months : 0;
    const quarters = proposal.cadence === "quarterly" ? Math.ceil(proposal.duration_months / 3) : 0;
    const baseDate = proposal.start_month || new Date().toISOString().slice(0, 10);
    const rows = [
      ...(proposal.upfront_amount > 0 ? [{
        expense_date: baseDate,
        category: proposal.category,
        description: `${proposal.title} - up-front`,
        amount: proposal.upfront_amount,
        paid_by_member_name: null,
        paid_by_label: "TBD",
        created_by: user,
        updated_by: user,
      }] : []),
      ...(proposal.cadence === "one_time" && proposal.one_time_amount > 0 ? [{
        expense_date: baseDate,
        category: proposal.category,
        description: proposal.title,
        amount: proposal.one_time_amount,
        paid_by_member_name: null,
        paid_by_label: "TBD",
        created_by: user,
        updated_by: user,
      }] : []),
      ...Array.from({ length: months }, (_, i) => ({
        expense_date: addMonths(baseDate, i),
        category: proposal.category,
        description: months > 1 ? `${proposal.title} - M${i + 1}` : proposal.title,
        amount: proposal.monthly_amount,
        paid_by_member_name: null,
        paid_by_label: "TBD",
        created_by: user,
        updated_by: user,
      })),
      ...Array.from({ length: quarters }, (_, i) => ({
        expense_date: addMonths(baseDate, i * 3),
        category: proposal.category,
        description: quarters > 1 ? `${proposal.title} - Q${i + 1}` : proposal.title,
        amount: proposal.monthly_amount,
        paid_by_member_name: null,
        paid_by_label: "TBD",
        created_by: user,
        updated_by: user,
      })),
    ];
    if (!rows.length) return;

    const { data, error } = await supabase.from("tracker_expenses").insert(rows).select();
    if (error) { alert(error.message); return; }
    const createdExpenses = (data as Expense[] | null) ?? [];
    const first = (data as Expense[] | null)?.[0];
    const { error: updateError } = await supabase
      .from("tracker_expense_proposals")
      .update({
        status: "converted",
        converted_expense_id: first?.id ?? null,
        updated_at: new Date().toISOString(),
        updated_by: user,
      })
      .eq("id", proposal.id);
    if (updateError) { alert(updateError.message); return; }
    const [expenseRes, contributionRes, callRes] = await Promise.all([
      supabase.from("tracker_expenses").select("*").is("deleted_at", null),
      supabase.from("tracker_contributions").select("*").is("deleted_at", null),
      supabase.from("tracker_capital_calls").select("*").is("deleted_at", null),
    ]);
    const fundingStatus = computeFundingStatus(
      (expenseRes.data as Expense[] | null) ?? [],
      (contributionRes.data as Contribution[] | null) ?? [],
      (callRes.data as CapitalCall[] | null) ?? [],
    );
    let suggestedCall = null;
    const existingCalls = (callRes.data as CapitalCall[] | null) ?? [];
    const alreadySuggested = existingCalls
      .some(c => !c.deleted_at && c.status === "suggested");
    if (fundingStatus.shortfall > 0 && !alreadySuggested) {
      const { data: callData, error: callError } = await supabase
        .from("tracker_capital_calls")
        .insert({
          date_called: new Date().toISOString().slice(0, 10),
          reason: `Auto-suggested after approved proposal "${proposal.title}": cover funding shortfall of ${fmtUSD(fundingStatus.shortfall)}`,
          total_amount: Number(fundingStatus.shortfall.toFixed(2)),
          per_member_amount: MEMBER_COUNT > 0 ? Number((fundingStatus.shortfall / MEMBER_COUNT).toFixed(2)) : 0,
          status: "suggested",
          auto_suggested: true,
          created_by: user,
          updated_by: user,
        })
        .select()
        .single();
      if (callError) { alert(callError.message); return; }
      suggestedCall = callData;
    }
    await logAudit({
      actor: user,
      table_name: "tracker_expense_proposals",
      row_id: proposal.id,
      action: "update",
      diff: { convertedExpenses: createdExpenses, suggestedCapitalCall: suggestedCall },
    });
    if (suggestedCall) {
      await logAudit({
        actor: user,
        table_name: "tracker_capital_calls",
        row_id: String((suggestedCall as { id: number }).id),
        action: "create",
        diff: { after: suggestedCall, source: "proposal-conversion", proposalId: proposal.id },
      });
    }
    await Promise.all(MEMBERS.map(member => createNotification({
      title: `Approved expense proposal converted: ${proposal.title}`,
      body: suggestedCall
        ? "Expense rows were created and a suggested capital call was opened for review."
        : "Expense rows were created in the tracker.",
      priority: suggestedCall ? "high" : "normal",
      assigned_to: member,
      href: suggestedCall ? "/tracker/capital-calls" : `/tracker/planning?proposal=${proposal.id}`,
      source_table: "tracker_expense_proposals",
      source_id: proposal.id,
      notification_type: "expense_proposal_converted",
    }, user)));
    void load();
  }

  function allVotesFor(proposalId: string): ProposalVote[] {
    return votes.filter(v => v.proposal_id === proposalId);
  }

  function votesFor(proposalId: string, version?: number): ProposalVote[] {
    const proposal = proposals.find(p => p.id === proposalId);
    const currentVersion = version ?? proposal?.revision_number ?? 1;
    return votes.filter(v => v.proposal_id === proposalId && (v.proposal_version ?? 1) === currentVersion);
  }

  function offsetsFor(proposalId: string): ProposalOffset[] {
    return offsets.filter(o => o.proposal_id === proposalId);
  }

  function needsMyVote(proposal: ExpenseProposal): boolean {
    if (proposal.status !== "review" && proposal.status !== "approved") return false;
    return !votesFor(proposal.id).some(v => v.member_name === user);
  }

  function startRevision(proposal: ExpenseProposal) {
    const proposalOffsets = offsetsFor(proposal.id);
    setRevisionTarget(proposal);
    setTitle(proposal.title);
    setCategory(proposal.category);
    setExpenseKind(proposal.expense_kind);
    setCadence(proposal.cadence);
    setHourlyRate(String(Number(proposal.hourly_rate ?? 0)));
    setHoursPerMonth(String(Number(proposal.hours_per_month ?? 0)));
    setFixedAmount(String(Number(proposal.cadence === "one_time" ? proposal.one_time_amount : proposal.monthly_amount)));
    setUpfrontAmount(String(Number(proposal.upfront_amount)));
    setMemberCap(String(Number(proposal.member_cap)));
    setDurationMonths(String(Number(proposal.duration_months)));
    setStartMonth(proposal.start_month || new Date().toISOString().slice(0, 10));
    setIsBudgeted(proposal.is_budgeted);
    setNotes(proposal.notes || "");
    setRevisionNote("");
    setOffsetDrafts(proposalOffsets.map(o => ({
      title: o.title,
      offset_kind: o.offset_kind,
      cadence: o.cadence,
      amount: Number(o.amount),
      source_expense_id: o.source_expense_id,
      notes: o.notes,
    })));
    setBuilderOpen(true);
    setInboxOpen(true);
    setExpandedProposalId(proposal.id);
  }

  const visibleProposals = proposals.filter(proposal => {
    if (proposalFilter === "all") return true;
    if (proposalFilter === "needs_my_vote") return needsMyVote(proposal);
    return proposal.status === proposalFilter;
  });

  const filterCounts: Record<ProposalFilter, number> = {
    needs_my_vote: proposals.filter(needsMyVote).length,
    review: proposals.filter(p => p.status === "review").length,
    revision_needed: proposals.filter(p => p.status === "revision_needed").length,
    approved: proposals.filter(p => p.status === "approved").length,
    converted: proposals.filter(p => p.status === "converted").length,
    rejected: proposals.filter(p => p.status === "rejected").length,
    all: proposals.length,
  };

  return (
    <TrackerShell title="Expense Planning" subtitle="Model proposed expenses, collect member sign-off, then convert approved proposals into tracker expenses.">
      {loading && <div style={{ color: "var(--muted)", marginBottom: 12 }}>Loading...</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <Stat label={`Current monthly (${currentMonthly.bucket})`} value={fmtUSD(currentMonthly.amount)} />
        <div style={trackerCard}>
          <label style={{ display: "block", fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Member cap / month</div>
            <input
              value={memberCap}
              onChange={e => setMemberCap(e.target.value)}
              style={{ ...trackerInput, fontSize: 20, fontWeight: 700, padding: "7px 10px" }}
            />
          </label>
        </div>
        <Stat label="Team cap" value={fmtUSD(teamCap)} />
        <Stat label="Room before cap" value={fmtUSD(availableRoom)} tone={availableRoom >= 0 ? "good" : "warn"} />
      </div>

      <div style={{ ...trackerCard, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{revisionTarget ? `Revise proposal v${revisionTarget.revision_number ?? 1}` : "New proposal"}</h2>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            {revisionTarget
              ? "Update the proposal and send a new version back to members for sign-off."
              : "Build expense scenarios separately from the inbox so members can review active proposals cleanly."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {revisionTarget && (
            <button
              onClick={() => {
                setRevisionTarget(null);
                setRevisionNote("");
                setOffsetDrafts([]);
              }}
              style={trackerBtnSubtle}
            >
              Cancel revision
            </button>
          )}
          <button
            onClick={() => setBuilderOpen(open => !open)}
            style={builderOpen ? trackerBtnGhost : trackerBtn}
          >
            {builderOpen ? "Collapse builder" : revisionTarget ? "Continue revision" : "Create proposal"}
          </button>
        </div>
      </div>

      {builderOpen && (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)", gap: 16, alignItems: "start", marginBottom: 16 }}>
        <div style={trackerCard}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Build proposal</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 10, marginBottom: 10 }}>
            <Field label="Expense name">
              <input value={title} onChange={e => setTitle(e.target.value)} style={trackerInput} />
            </Field>
            <Field label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} style={trackerInput}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
            <Field label="Cost type">
              <select value={expenseKind} onChange={e => setExpenseKind(e.target.value as ExpenseKind)} style={trackerInput}>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed</option>
              </select>
            </Field>
            <Field label="Cadence">
              <select value={cadence} onChange={e => setCadence(e.target.value as Cadence)} style={trackerInput}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="one_time">One-time</option>
              </select>
            </Field>
            <Field label="Duration">
              <input value={durationMonths} onChange={e => setDurationMonths(e.target.value)} disabled={cadence === "one_time"} style={{ ...trackerInput, opacity: cadence === "one_time" ? 0.55 : 1 }} />
            </Field>
          </div>

          {expenseKind === "hourly" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 10 }}>
              <Field label="Hourly rate">
                <input value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} style={trackerInput} />
              </Field>
              <Field label="Hours per month">
                <input value={hoursPerMonth} onChange={e => setHoursPerMonth(e.target.value)} style={trackerInput} />
              </Field>
            </div>
          ) : (
            <Field label={cadence === "monthly" ? "Monthly amount" : cadence === "quarterly" ? "Quarterly amount" : "One-time amount"}>
              <input value={fixedAmount} onChange={e => setFixedAmount(e.target.value)} style={trackerInput} />
            </Field>
          )}

          <div style={{ marginTop: 10 }}>
            <Field label="Up-front cost">
              <input value={upfrontAmount} onChange={e => setUpfrontAmount(e.target.value)} placeholder="$0 deposit, setup fee, retainer..." style={trackerInput} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, marginTop: 10 }}>
            <Field label="Start date">
              <input type="date" value={startMonth} onChange={e => setStartMonth(e.target.value)} style={trackerInput} />
            </Field>
            <label style={{ display: "flex", alignItems: "end", gap: 8, fontSize: 13, paddingBottom: 10 }}>
              <input type="checkbox" checked={isBudgeted} onChange={e => setIsBudgeted(e.target.checked)} />
              Already inside an approved budget
            </label>
          </div>

          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...trackerInput, resize: "vertical" }} />
          </Field>

          {revisionTarget && (
            <div style={{ marginTop: 10 }}>
              <Field label="Revision note">
                <textarea
                  value={revisionNote}
                  onChange={e => setRevisionNote(e.target.value)}
                  rows={2}
                  placeholder="What changed, and why should members re-vote?"
                  style={{ ...trackerInput, resize: "vertical" }}
                />
              </Field>
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Budget changes</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10, marginBottom: 10 }}>
              <Field label="Link existing expense">
                <select value={offsetSourceId} onChange={e => {
                  const value = e.target.value;
                  setOffsetSourceId(value);
                  const linked = expenses.find(exp => String(exp.id) === value);
                  if (linked) {
                    setOffsetTitle(linked.description);
                    setOffsetAmount(String(Number(linked.amount)));
                    setOffsetCadence("monthly");
                  }
                }} style={trackerInput}>
                  <option value="">Custom offset</option>
                  {expenses.slice().reverse().slice(0, 24).map(e => (
                    <option key={e.id} value={e.id}>{e.description} - {fmtUSD(Number(e.amount))}</option>
                  ))}
                </select>
              </Field>
              <Field label="Action">
                <select value={offsetKind} onChange={e => setOffsetKind(e.target.value as OffsetKind)} style={trackerInput}>
                  <option value="increase">Increase</option>
                  <option value="reduce">Reduce</option>
                  <option value="remove">Remove</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px", gap: 10, marginBottom: 10 }}>
              <Field label="Offset name">
                <input value={offsetTitle} onChange={e => setOffsetTitle(e.target.value)} placeholder="Reduce Sophia hours, cancel Call Tools..." style={trackerInput} />
              </Field>
              <Field label="Amount">
                <input value={offsetAmount} onChange={e => setOffsetAmount(e.target.value)} style={trackerInput} />
              </Field>
              <Field label="Cadence">
                <select value={offsetCadence} onChange={e => setOffsetCadence(e.target.value as Cadence)} style={trackerInput}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="one_time">One-time</option>
                </select>
              </Field>
            </div>
            <Field label="Offset note">
              <input value={offsetNotes} onChange={e => setOffsetNotes(e.target.value)} placeholder="What changes operationally?" style={trackerInput} />
            </Field>
            <button type="button" onClick={addOffsetDraft} style={{ ...trackerBtnSubtle, marginTop: 10 }}>Add offset</button>
            {offsetDrafts.length > 0 && (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {offsetDrafts.map((o, i) => (
                  <div key={`${o.title}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: 10, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{budgetChangeVerb(o.offset_kind)}: {o.title}</div>
                      <div style={{ color: "var(--muted)", fontSize: 11 }}>{o.cadence} - {o.notes || "No note"}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <strong>{budgetChangeSign(o.offset_kind) > 0 ? "+" : "-"}{fmtUSD(Number(o.amount))}</strong>
                      <button onClick={() => setOffsetDrafts(prev => prev.filter((_, idx) => idx !== i))} style={{ ...trackerBtnSubtle, padding: "5px 8px", fontSize: 11 }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={saveProposal} disabled={saving || grossFirstMonthImpact <= 0} style={{ ...trackerBtn, marginTop: 12, opacity: saving || grossFirstMonthImpact <= 0 ? 0.6 : 1 }}>
            {saving ? "Saving..." : revisionTarget ? "Save revision for new vote" : "Save proposal for sign-off"}
          </button>
        </div>

        <div style={trackerCard}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Live decision math</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <ResultRow label="Gross proposed cost" value={fmtUSD(grossFirstMonthImpact)} />
            <ResultRow label="First-month budget changes" value={`${budgetChangeFirstMonthImpact >= 0 ? "+" : "-"}${fmtUSD(Math.abs(budgetChangeFirstMonthImpact))}`} tone={budgetChangeFirstMonthImpact <= 0 ? "good" : "warn"} />
            <ResultRow label="Net proposed cost" value={fmtUSD(firstMonthImpact)} strong />
            <ResultRow label="First-month total" value={fmtUSD(newMonthlyTotal)} />
            <ResultRow label="First-month member portion" value={fmtUSD(newPerMember, { fractionDigits: 2 })} strong />
            <ResultRow label={overUnder >= 0 ? "First month under cap by" : "First month over cap by"} value={fmtUSD(Math.abs(overUnder), { fractionDigits: 2 })} tone={overUnder >= 0 ? "good" : "warn"} />
            <ResultRow label="Ongoing budget changes" value={`${budgetChangeOngoingMonthlyImpact >= 0 ? "+" : "-"}${fmtUSD(Math.abs(budgetChangeOngoingMonthlyImpact))}`} tone={budgetChangeOngoingMonthlyImpact <= 0 ? "good" : "warn"} />
            <ResultRow label="Ongoing monthly total" value={fmtUSD(ongoingMonthlyTotal)} />
            <ResultRow label="Ongoing member portion" value={fmtUSD(ongoingPerMember, { fractionDigits: 2 })} strong />
            <ResultRow label={ongoingOverUnder >= 0 ? "Ongoing under cap by" : "Ongoing over cap by"} value={fmtUSD(Math.abs(ongoingOverUnder), { fractionDigits: 2 })} tone={ongoingOverUnder >= 0 ? "good" : "warn"} />
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--fg)" }}>Approval rule:</strong> {rule.approvalRule}
            <div style={{ marginTop: 6 }}>
              System requires <b style={{ color: "var(--fg)" }}>{rule.requiredApprovals} of {MEMBER_COUNT}</b> approvals.
            </div>
          </div>
        </div>
      </div>
      )}

      <div style={{ ...trackerCard, padding: 14, margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setInboxOpen(open => !open)}
          style={{ background: "transparent", border: "none", color: "var(--fg)", cursor: "pointer", textAlign: "left", padding: 0 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Proposal inbox {inboxOpen ? "−" : "+"}</h2>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
            {visibleProposals.length} proposal{visibleProposals.length === 1 ? "" : "s"} in this view. Click a proposal to review details, notes, votes, and sign-off.
          </p>
        </button>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {([
            ["needs_my_vote", "Needs my vote"],
            ["review", "Under review"],
            ["revision_needed", "Revision needed"],
            ["approved", "Approved"],
            ["converted", "Converted"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ] as Array<[ProposalFilter, string]>).map(([value, label]) => {
            const active = proposalFilter === value;
            return (
              <button
                key={value}
                onClick={() => setProposalFilter(value)}
                style={{
                  background: active ? "var(--obsidian)" : "var(--surface2)",
                  color: active ? "var(--surface)" : "var(--fg)",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label} ({filterCounts[value]})
              </button>
            );
          })}
        </div>
      </div>
      </div>
      {inboxOpen && (
      <div style={{ display: "grid", gap: 12 }}>
        {visibleProposals.map(proposal => {
          const proposalVotes = votesFor(proposal.id);
          const allProposalVotes = allVotesFor(proposal.id);
          const proposalOffsets = offsetsFor(proposal.id);
          const approved = proposalVotes.filter(v => v.decision === "approve").length;
          const rejected = proposalVotes.filter(v => v.decision === "reject").length;
          const abstained = proposalVotes.filter(v => v.decision === "abstain").length;
          const ready = approved >= proposal.required_approvals;
          const myVote = proposalVotes.find(v => v.member_name === user);
          const sortedVotes = [...proposalVotes].sort((a, b) => a.member_name.localeCompare(b.member_name));
          const priorVotes = allProposalVotes
            .filter(v => (v.proposal_version ?? 1) !== (proposal.revision_number ?? 1))
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          const ongoingMonthlyAmount = proposal.cadence === "monthly"
            ? Number(proposal.monthly_amount)
            : proposal.cadence === "quarterly"
              ? Number(proposal.monthly_amount) / 3
              : 0;
          const recurringFirstPayment = proposal.cadence === "monthly" || proposal.cadence === "quarterly"
            ? Number(proposal.monthly_amount)
            : 0;
          const grossFirstMonthAmount = recurringFirstPayment + Number(proposal.one_time_amount) + Number(proposal.upfront_amount);
          const proposalBudgetChangeFirst = proposalOffsets.reduce((sum, o) => sum + (budgetChangeSign(o.offset_kind) * firstPeriodAmount(o.cadence, Number(o.amount))), 0);
          const proposalBudgetChangeOngoing = proposalOffsets.reduce((sum, o) => sum + (budgetChangeSign(o.offset_kind) * monthlyEquivalentAmount(o.cadence, Number(o.amount))), 0);
          const firstMonthAmount = grossFirstMonthAmount + proposalBudgetChangeFirst;
          const netOngoingMonthlyAmount = ongoingMonthlyAmount + proposalBudgetChangeOngoing;
          const firstMonthTotal = currentMonthly.amount + firstMonthAmount;
          const ongoingTotal = currentMonthly.amount + netOngoingMonthlyAmount;
          const firstMonthPerMember = MEMBER_COUNT > 0 ? firstMonthTotal / MEMBER_COUNT : 0;
          const ongoingPerMemberForProposal = MEMBER_COUNT > 0 ? ongoingTotal / MEMBER_COUNT : 0;
          const expanded = expandedProposalId === proposal.id;

          return (
            <div key={proposal.id} style={trackerCard}>
              <button
                onClick={() => setExpandedProposalId(expanded ? null : proposal.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--fg)",
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                  width: "100%",
                }}
              >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{proposal.title}</h3>
                    <Badge text={proposal.status === "review" && ready ? "Approved - ready to convert" : statusLabel(proposal.status)} tone={proposal.status === "converted" ? "good" : ready ? "good" : "neutral"} />
                    <Badge text={`v${proposal.revision_number ?? 1}`} tone="neutral" />
                    <Badge text={proposal.category} tone="neutral" />
                    <Badge text={expanded ? "Hide details" : "Review details"} tone="neutral" />
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                    {proposal.approval_rule}
                  </div>
                  {proposal.revision_note && (
                    <div style={{ color: "var(--gold)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                      Revision note: {proposal.revision_note}
                    </div>
                  )}
                  {proposalOffsets.length > 0 && (
                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {proposalOffsets.map(o => (
                        <div key={o.id} style={{ display: "inline-flex", width: "fit-content", gap: 8, alignItems: "center", padding: "5px 8px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 11 }}>
                          <strong>{budgetChangeVerb(o.offset_kind)}</strong>
                          <span>{o.title}</span>
                          <span style={{ color: o.offset_kind === "increase" ? "var(--obsidian)" : "var(--gold)" }}>{budgetChangeSign(o.offset_kind) > 0 ? "+" : "-"}{fmtUSD(Number(o.amount))}</span>
                          <span style={{ color: "var(--muted)" }}>{o.cadence}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", minWidth: 180 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtUSD(firstMonthAmount)}</div>
                  {proposalOffsets.length > 0 && (
                    <div style={{ color: proposalBudgetChangeFirst <= 0 ? "var(--gold)" : "var(--obsidian)", fontSize: 12 }}>
                      {proposalBudgetChangeFirst >= 0 ? "+" : "-"}{fmtUSD(Math.abs(proposalBudgetChangeFirst))} budget changes
                    </div>
                  )}
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    first month - {fmtUSD(firstMonthPerMember, { fractionDigits: 2 })}/member
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    ongoing - {fmtUSD(ongoingPerMemberForProposal, { fractionDigits: 2 })}/member
                  </div>
                </div>
              </div>
              </button>

              {expanded && (
              <>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.8fr)", gap: 12, marginTop: 14 }}>
                <div style={{ padding: 12, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Proposal details</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                    <Detail label="Cost type" value={proposal.expense_kind === "hourly" ? "Hourly" : "Fixed"} />
                    <Detail label="Cadence" value={proposal.cadence === "one_time" ? "One-time" : proposal.cadence} />
                    <Detail label="Duration" value={proposal.cadence === "one_time" ? "One-time" : `${proposal.duration_months} month${proposal.duration_months === 1 ? "" : "s"}`} />
                    <Detail label="Start date" value={proposal.start_month || "Not set"} />
                    <Detail label="Member cap" value={`${fmtUSD(Number(proposal.member_cap))}/mo`} />
                    <Detail label="Budgeted" value={proposal.is_budgeted ? "Yes" : "No"} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {proposal.expense_kind === "hourly" && (
                      <>
                        <Detail label="Hourly rate" value={fmtUSD(Number(proposal.hourly_rate ?? 0), { fractionDigits: 2 })} />
                        <Detail label="Hours / month" value={String(Number(proposal.hours_per_month ?? 0))} />
                      </>
                    )}
                    <Detail label="Up-front" value={fmtUSD(Number(proposal.upfront_amount))} />
                    <Detail label={proposal.cadence === "quarterly" ? "Quarterly cost" : proposal.cadence === "one_time" ? "One-time cost" : "Monthly cost"} value={fmtUSD(Number(proposal.cadence === "one_time" ? proposal.one_time_amount : proposal.monthly_amount))} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4 }}>Proposal notes</div>
                    <div style={{ color: proposal.notes ? "var(--fg)" : "var(--muted)", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                      {proposal.notes || "No proposal notes entered."}
                    </div>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Cost breakdown</h4>
                  <div style={{ display: "grid", gap: 8 }}>
                    <ResultRow label="Gross first month" value={fmtUSD(grossFirstMonthAmount)} />
                    <ResultRow label="Budget changes" value={`${proposalBudgetChangeFirst >= 0 ? "+" : "-"}${fmtUSD(Math.abs(proposalBudgetChangeFirst))}`} tone={proposalBudgetChangeFirst <= 0 ? "good" : "warn"} />
                    <ResultRow label="Net first month" value={fmtUSD(firstMonthAmount)} strong />
                    <ResultRow label="First month / member" value={fmtUSD(firstMonthPerMember, { fractionDigits: 2 })} strong />
                    <ResultRow label="Ongoing / member" value={fmtUSD(ongoingPerMemberForProposal, { fractionDigits: 2 })} />
                  </div>
                </div>
              </div>

              {proposalOffsets.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 10 }}>
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Budget-change details</h4>
                      <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>
                        These adjustments are approved with the proposal and explain how the net budget changes.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge text={`First payment ${proposalBudgetChangeFirst >= 0 ? "+" : "-"}${fmtUSD(Math.abs(proposalBudgetChangeFirst))}`} tone={proposalBudgetChangeFirst <= 0 ? "good" : "warn"} />
                      <Badge text={`Monthly run-rate ${proposalBudgetChangeOngoing >= 0 ? "+" : "-"}${fmtUSD(Math.abs(proposalBudgetChangeOngoing))}`} tone={proposalBudgetChangeOngoing <= 0 ? "good" : "warn"} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {proposalOffsets.map(o => {
                      const signed = budgetChangeSign(o.offset_kind);
                      const amount = Number(o.amount);
                      const sourceExpense = o.source_expense_id ? expenses.find(exp => Number(exp.id) === Number(o.source_expense_id)) : null;
                      const firstPayment = signed * firstPeriodAmount(o.cadence, amount);
                      const monthlyEquivalent = signed * monthlyEquivalentAmount(o.cadence, amount);

                      return (
                        <div key={`detail-${o.id}`} style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.24)", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 8 }}>
                            <div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <Badge text={budgetChangeVerb(o.offset_kind)} tone={o.offset_kind === "increase" ? "warn" : "good"} />
                                <strong style={{ fontSize: 13 }}>{o.title}</strong>
                              </div>
                              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                                {budgetChangeEffect(o.offset_kind)}
                                {sourceExpense ? `: ${sourceExpense.description}` : ""}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ color: signed > 0 ? "var(--obsidian)" : "var(--gold)", fontWeight: 800, fontSize: 14 }}>
                                {signed > 0 ? "+" : "-"}{fmtUSD(amount)}
                              </div>
                              <div style={{ color: "var(--muted)", fontSize: 11 }}>{cadenceLabel(o.cadence)} amount</div>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                            <Detail label="First payment impact" value={`${firstPayment >= 0 ? "+" : "-"}${fmtUSD(Math.abs(firstPayment))}`} />
                            <Detail label="Monthly equivalent" value={`${monthlyEquivalent >= 0 ? "+" : "-"}${fmtUSD(Math.abs(monthlyEquivalent), { fractionDigits: 2 })}`} />
                            <Detail label="Linked expense" value={sourceExpense ? sourceExpense.description : "Custom change"} />
                          </div>
                          <div style={{ marginTop: 8, color: o.notes ? "var(--fg)" : "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>
                            {o.notes || "No operational note entered."}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
                <MiniStat label="Approvals" value={`${approved}/${proposal.required_approvals}`} />
                <MiniStat label="Reject" value={String(rejected)} />
                <MiniStat label="Abstain" value={String(abstained)} />
                <MiniStat label="OA minimum" value={`${proposal.minimum_oa_approvals}/${MEMBER_COUNT}`} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 14 }}>
                {MEMBERS.map(member => {
                  const v = proposalVotes.find(row => row.member_name === member);
                  return (
                    <div key={member} style={{ padding: 10, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", minHeight: 74 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>{member}</div>
                    <Badge text={v ? decisionLabel(v.decision) : "Pending"} tone={v?.decision === "approve" ? "good" : v?.decision === "reject" || v?.decision === "request_changes" ? "warn" : "neutral"} />
                      {v?.note && <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 11 }}>{v.note}</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800 }}>Decision record</h4>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    Created {formatDateTime(proposal.created_at)} by {proposal.created_by || "unknown"}
                    {proposal.status === "converted" ? ` - Converted ${formatDateTime(proposal.updated_at)}` : ""}
                  </span>
                </div>
                {sortedVotes.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {sortedVotes.map(v => (
                      <div key={v.id || `${v.proposal_id}-${v.member_name}`} style={{ display: "grid", gridTemplateColumns: "140px 90px 1fr 150px", gap: 8, alignItems: "center", fontSize: 12 }}>
                        <strong>{v.member_name}</strong>
                        <Badge text={decisionLabel(v.decision)} tone={v.decision === "approve" ? "good" : v.decision === "reject" || v.decision === "request_changes" ? "warn" : "neutral"} />
                        <span style={{ color: v.note ? "var(--fg)" : "var(--muted)" }}>{v.note || "No note"}</span>
                        <span style={{ color: "var(--muted)", fontSize: 11, textAlign: "right" }}>{formatDateTime(v.updated_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>No member votes recorded yet.</div>
                )}
              </div>

              {priorVotes.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Prior-version voting history</h4>
                  <div style={{ display: "grid", gap: 6 }}>
                    {priorVotes.map(v => (
                      <div key={v.id || `${v.proposal_id}-${v.member_name}-${v.proposal_version}`} style={{ display: "grid", gridTemplateColumns: "70px 140px 130px 1fr 150px", gap: 8, alignItems: "center", fontSize: 12 }}>
                        <strong>v{v.proposal_version ?? 1}</strong>
                        <strong>{v.member_name}</strong>
                        <Badge text={decisionLabel(v.decision)} tone={v.decision === "approve" ? "good" : v.decision === "reject" || v.decision === "request_changes" ? "warn" : "neutral"} />
                        <span style={{ color: v.note ? "var(--fg)" : "var(--muted)" }}>{v.note || "No note"}</span>
                        <span style={{ color: "var(--muted)", fontSize: 11, textAlign: "right" }}>{formatDateTime(v.updated_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {proposal.status !== "converted" && proposal.status !== "revision_needed" && (
                <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 14 }}>
                  <input value={voteNote} onChange={e => setVoteNote(e.target.value)} placeholder="Optional note for your sign-off" style={{ ...trackerInput, maxWidth: 360 }} />
                  <button onClick={() => vote(proposal, "approve")} style={trackerBtn}>
                    {myVote?.decision === "approve" ? "Approved" : "Approve"}
                  </button>
                  <button onClick={() => vote(proposal, "request_changes")} style={{ ...trackerBtnGhost, borderColor: "var(--gold)", color: "var(--gold)" }}>
                    Request changes
                  </button>
                  <button onClick={() => vote(proposal, "abstain")} style={trackerBtnSubtle}>Abstain</button>
                  <button onClick={() => vote(proposal, "reject")} style={{ ...trackerBtnGhost, borderColor: "var(--obsidian)", color: "var(--obsidian)" }}>Reject</button>
                  {admin && ready && (
                    <>
                      <button onClick={() => convertToExpenses(proposal)} style={{ ...trackerBtn, background: "var(--obsidian)", color: "var(--surface)" }}>
                        Convert addition to expenses
                      </button>
                      {proposalOffsets.length > 0 && (
                        <span style={{ color: "var(--muted)", fontSize: 11, maxWidth: 320 }}>
                          Budget changes are approved as part of the package; update existing expense rows separately.
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
              {proposal.status === "revision_needed" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(20,17,13,0.08)", border: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <strong>Revision needed before voting continues.</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                      Review the requested-change notes, update the proposal, and send a new version back to members.
                    </div>
                  </div>
                  {(admin || proposal.created_by === user) && (
                    <button onClick={() => startRevision(proposal)} style={{ ...trackerBtn, background: "var(--obsidian)", color: "var(--surface)" }}>
                      Revise proposal
                    </button>
                  )}
                </div>
              )}
              </>
              )}
            </div>
          );
        })}
        {!visibleProposals.length && (
          <div style={{ ...trackerCard, textAlign: "center", color: "var(--muted)" }}>
            No proposals in this view.
          </div>
        )}
      </div>
      )}
    </TrackerShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12 }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div style={trackerCard}>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: tone === "good" ? "var(--gold)" : tone === "warn" ? "var(--obsidian)" : "var(--fg)" }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 8, borderRadius: 7, background: "rgba(255,255,255,0.24)", border: "1px solid var(--border)" }}>
      <div style={{ color: "var(--muted)", fontSize: 10, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ResultRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "warn" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 700, color: tone === "good" ? "var(--gold)" : tone === "warn" ? "var(--obsidian)" : "var(--fg)" }}>{value}</span>
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: "good" | "warn" | "neutral" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 700,
        background: tone === "good" ? "rgba(201,168,120,0.18)" : tone === "warn" ? "rgba(20,17,13,0.12)" : "var(--surface2)",
        color: tone === "good" ? "var(--gold)" : tone === "warn" ? "var(--obsidian)" : "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      {text}
    </span>
  );
}
