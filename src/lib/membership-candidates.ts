import { MEMBERS } from "@/data/questions";
import { getAllSurveys } from "@/data/surveys";
import { supabase, supabasePrototypeAnon } from "./supabase";
import { createNotification, markNotificationRead } from "./operations";

export type CandidateStatus = "started" | "under_review" | "approved" | "declined" | "withdrawn";
export type CandidateVoteDecision = "approve" | "discuss" | "hold" | "decline";

export interface MembershipCandidate {
  id: string;
  full_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  join_as: string;
  entity_name: string | null;
  entity_state: string | null;
  entity_title: string | null;
  participation: string;
  max_deal_contribution: number | null;
  cash_available: number | null;
  credit_available: number | null;
  monthly_dues_comfort: string | null;
  monthly_dues_max: number | null;
  deal_readiness: string | null;
  credit_pull_comfort: string | null;
  table_contribution: string | null;
  relationships: string | null;
  first_90_days: string | null;
  support_requested: string | null;
  member_notes: string | null;
  status: CandidateStatus;
  submitted_at: string;
  updated_at: string;
}

export interface MembershipCandidateVote {
  id: string;
  candidate_id: string;
  member_name: string;
  decision: CandidateVoteDecision;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type CandidateDraft = Omit<
  MembershipCandidate,
  "id" | "status" | "submitted_at" | "updated_at"
>;

export interface MemberAdmissionInput {
  candidateId: string;
  memberName: string;
  password: string;
  llcName: string;
  isAdmin: boolean;
  assignedSurveyIds: string[];
  actor: string;
}

export const MEMBERSHIP_CANDIDATE_VOTE = "membership_candidate_vote";

async function fetchActiveMemberNames(): Promise<string[]> {
  if (!supabase) return [...MEMBERS];
  const { data, error } = await supabase.from("meridian_members").select("name").order("name");
  if (error || !data) return [...MEMBERS];
  return (data as Array<{ name: string }>).map(row => row.name).filter(Boolean);
}

export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCandidateMoney(value: number | null | undefined): string {
  if (value == null) return "Not provided";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function voteLabel(decision: CandidateVoteDecision): string {
  return {
    approve: "Approve",
    discuss: "Discuss",
    hold: "Hold",
    decline: "Decline",
  }[decision];
}

function normalizeCandidateDraft(draft: CandidateDraft) {
  return {
    ...draft,
    contact_email: draft.contact_email?.trim() || null,
    contact_phone: draft.contact_phone?.trim() || null,
    entity_name: draft.entity_name?.trim() || null,
    entity_state: draft.entity_state?.trim() || null,
    entity_title: draft.entity_title?.trim() || null,
    monthly_dues_comfort: draft.monthly_dues_comfort?.trim() || null,
    deal_readiness: draft.deal_readiness?.trim() || null,
    credit_pull_comfort: draft.credit_pull_comfort?.trim() || null,
    table_contribution: draft.table_contribution?.trim() || null,
    relationships: draft.relationships?.trim() || null,
    first_90_days: draft.first_90_days?.trim() || null,
    support_requested: draft.support_requested?.trim() || null,
    member_notes: draft.member_notes?.trim() || null,
  };
}

export async function saveMembershipCandidateDraft(
  draft: CandidateDraft,
  candidateId?: string | null,
): Promise<{ data: MembershipCandidate | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const payload = {
    ...normalizeCandidateDraft(draft),
    full_name: draft.full_name.trim() || "Started application",
    status: "started" as CandidateStatus,
    updated_at: new Date().toISOString(),
  };

  const query = candidateId
    ? supabase
        .from("membership_candidates")
        .update(payload)
        .eq("id", candidateId)
        .eq("status", "started")
        .select()
        .maybeSingle()
    : supabase
        .from("membership_candidates")
        .insert(payload)
        .select()
        .single();

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: (data as MembershipCandidate | null) ?? null, error: null };
}

export async function createMembershipCandidate(
  draft: CandidateDraft,
  candidateId?: string | null,
): Promise<{ data: MembershipCandidate | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const payload = {
    ...normalizeCandidateDraft(draft),
    full_name: draft.full_name.trim(),
    status: "under_review" as CandidateStatus,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const query = candidateId
    ? supabase
        .from("membership_candidates")
        .update(payload)
        .eq("id", candidateId)
        .select()
        .single()
    : supabase
        .from("membership_candidates")
        .insert(payload)
        .select()
        .single();

  const { data, error } = await query;

  if (error || !data) return { data: null, error: error?.message ?? "Could not submit candidate" };

  const candidate = data as MembershipCandidate;
  const activeMembers = await fetchActiveMemberNames();
  const noticeResults = await Promise.all(activeMembers.map(member => createNotification({
    title: `New member review: ${candidate.full_name}`,
    body: "Review readiness, capital, credit, relationships, and what this applicant can bring to Meridian.",
    priority: "high",
    assigned_to: member,
    href: `/members/candidates?candidate=${candidate.id}`,
    source_table: "membership_candidates",
    source_id: candidate.id,
    notification_type: MEMBERSHIP_CANDIDATE_VOTE,
  }, "Membership Application")));
  const noticeError = noticeResults.find(result => result.error)?.error;
  if (noticeError) {
    return {
      data: candidate,
      error: `Application saved, but member vote notifications could not be created: ${noticeError}`,
    };
  }

  return { data: candidate, error: null };
}

export async function fetchPendingMembershipCandidateVotes(memberName: string): Promise<MembershipCandidate[]> {
  if (!supabase) return [];
  const [candidatesResult, votesResult] = await Promise.all([
    supabase
      .from("membership_candidates")
      .select("*")
      .eq("status", "under_review")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("membership_candidate_votes")
      .select("candidate_id")
      .eq("member_name", memberName),
  ]);

  if (candidatesResult.error || !candidatesResult.data) return [];
  const votedIds = new Set((votesResult.data ?? []).map(row => row.candidate_id));
  return (candidatesResult.data as MembershipCandidate[]).filter(candidate => !votedIds.has(candidate.id));
}

export async function fetchMembershipCandidates(): Promise<MembershipCandidate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("membership_candidates")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error || !data) return [];
  return data as MembershipCandidate[];
}

export async function fetchMembershipCandidateVotes(): Promise<MembershipCandidateVote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("membership_candidate_votes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as MembershipCandidateVote[];
}

export async function voteOnMembershipCandidate(
  candidateId: string,
  memberName: string,
  decision: CandidateVoteDecision,
  note: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("membership_candidate_votes")
    .upsert({
      candidate_id: candidateId,
      member_name: memberName,
      decision,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "candidate_id,member_name" });

  if (error) return { error: error.message };

  const { data: notices } = await supabase
    .from("meridian_notifications")
    .select("id")
    .eq("notification_type", MEMBERSHIP_CANDIDATE_VOTE)
    .eq("assigned_to", memberName)
    .eq("source_id", candidateId)
    .is("read_at", null);

  await Promise.all((notices ?? []).map(notice => markNotificationRead(notice.id)));
  return { error: null };
}

export async function admitMembershipCandidate(input: MemberAdmissionInput): Promise<{ error: string | null }> {
  const writeClient = supabasePrototypeAnon ?? supabase;
  if (!writeClient) return { error: "Supabase not configured" };

  const memberName = input.memberName.trim();
  if (!memberName) return { error: "Member name is required" };

  const password = input.password.trim() || "meridian2026";
  const llcName = input.llcName.trim() || memberName;
  const now = new Date().toISOString();

  const { data: candidate, error: candidateError } = await writeClient
    .from("membership_candidates")
    .select("*")
    .eq("id", input.candidateId)
    .single();
  if (candidateError || !candidate) return { error: candidateError?.message ?? "Candidate not found" };

  const { error: memberError } = await writeClient
    .from("meridian_members")
    .upsert({
      name: memberName,
      password,
      password_changed: false,
      updated_at: now,
    }, { onConflict: "name" });
  if (memberError) return { error: memberError.message };

  const { error: profileError } = await writeClient
    .from("tracker_member_profiles")
    .upsert({
      member_name: memberName,
      llc_name: llcName,
      is_admin: input.isAdmin,
      updated_at: now,
    }, { onConflict: "member_name" });
  if (profileError) return { error: profileError.message };

  const { error: statusError } = await writeClient
    .from("membership_candidates")
    .update({ status: "approved" as CandidateStatus, updated_at: now })
    .eq("id", input.candidateId);
  if (statusError) return { error: statusError.message };

  const { error: auditError } = await writeClient.from("tracker_audit_log").insert({
    actor: input.actor,
    table_name: "meridian_members",
    row_id: memberName,
    action: "create",
    diff: {
      source: "membership_candidate_admission",
      candidate_id: input.candidateId,
      member_name: memberName,
      llc_name: llcName,
      is_admin: input.isAdmin,
    },
  });
  if (auditError) return { error: `Member admitted, but audit log could not be saved: ${auditError.message}` };

  const surveys = getAllSurveys().filter(survey => input.assignedSurveyIds.includes(survey.id));
  const assignmentResults = await Promise.all(surveys.map(survey => upsertAdmissionNotification(writeClient, {
    title: `Survey assigned: ${survey.title}`,
    body: "Complete this as part of your Meridian member onboarding. Your responses will flow into the portal results and decision tools.",
    priority: "high",
    assigned_to: memberName,
    href: `/survey/${survey.id}`,
    source_table: "membership_candidates",
    source_id: input.candidateId,
    notification_type: "survey_assignment",
    created_by: input.actor,
  })));

  const assignmentError = assignmentResults.find(result => result.error)?.error;
  if (assignmentError) return { error: `Member admitted, but survey assignments could not be created: ${assignmentError}` };

  const groupNotice = await upsertAdmissionNotification(writeClient, {
    title: `${memberName} has portal access`,
    body: `${memberName} was admitted from the membership application. Tracker balances now include ${llcName}.`,
    priority: "normal",
    assigned_to: null,
    href: `/members/candidates?candidate=${input.candidateId}`,
    source_table: "membership_candidates",
    source_id: input.candidateId,
    notification_type: "member_admitted",
    created_by: input.actor,
  });
  if (groupNotice.error) return { error: `Member admitted, but group notification could not be created: ${groupNotice.error}` };

  return { error: null };
}

async function upsertAdmissionNotification(
  client: NonNullable<typeof supabase>,
  row: {
    title: string;
    body: string | null;
    priority: "normal" | "high" | "urgent";
    assigned_to: string | null;
    href: string;
    source_table: string;
    source_id: string;
    notification_type: string;
    created_by: string;
  },
): Promise<{ error: string | null }> {
  const existingQuery = client
    .from("meridian_notifications")
    .select("id")
    .eq("notification_type", row.notification_type)
    .eq("source_table", row.source_table)
    .eq("source_id", row.source_id)
    .is("read_at", null)
    .limit(1);

  const { data: existing } = row.assigned_to
    ? await existingQuery.eq("assigned_to", row.assigned_to).maybeSingle()
    : await existingQuery.is("assigned_to", null).maybeSingle();

  if (existing?.id) {
    const { error } = await client.from("meridian_notifications").update(row).eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await client.from("meridian_notifications").insert(row);
  return { error: error?.message ?? null };
}
