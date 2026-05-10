import { supabase } from "./supabase";

export interface VaDailyBriefInput {
  work_date: string;
  hours_worked?: number | null;
  leads_added?: number | null;
  leads_updated?: number | null;
  outreach_sent?: number | null;
  seller_replies?: number | null;
  calls_completed?: number | null;
  deals_submitted?: number | null;
  checklist_items_cleared?: number | null;
  activities_completed: string;
  follow_ups_needed?: string | null;
  blockers?: string | null;
  tomorrow_plan?: string | null;
}

export interface VaDailyBrief extends VaDailyBriefInput {
  id: string;
  submitted_by: string;
  reviewed_status: "new" | "in-review" | "reviewed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  revised_at?: string | null;
  revised_by?: string | null;
  revision_note?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VaDailyBriefReview {
  id: string;
  brief_id: string;
  member_name: string;
  note: string | null;
  reviewed_at: string;
}

const LOCAL_BRIEFS = "meridian_va_daily_briefs_local";
const LOCAL_REVIEWS = "meridian_va_daily_brief_reviews_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function normalizeNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanInput(input: VaDailyBriefInput): VaDailyBriefInput {
  return {
    work_date: input.work_date,
    hours_worked: normalizeNumber(input.hours_worked),
    leads_added: normalizeNumber(input.leads_added),
    leads_updated: normalizeNumber(input.leads_updated),
    outreach_sent: normalizeNumber(input.outreach_sent),
    seller_replies: normalizeNumber(input.seller_replies),
    calls_completed: normalizeNumber(input.calls_completed),
    deals_submitted: normalizeNumber(input.deals_submitted),
    checklist_items_cleared: normalizeNumber(input.checklist_items_cleared),
    activities_completed: input.activities_completed.trim(),
    follow_ups_needed: input.follow_ups_needed?.trim() || null,
    blockers: input.blockers?.trim() || null,
    tomorrow_plan: input.tomorrow_plan?.trim() || null,
  };
}

export async function fetchVaDailyBriefs(limit = 30): Promise<VaDailyBrief[]> {
  if (!supabase) {
    return localGet<VaDailyBrief[]>(LOCAL_BRIEFS, [])
      .filter(brief => !brief.deleted_at)
      .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from("meridian_va_daily_briefs")
    .select("*")
    .is("deleted_at", null)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as VaDailyBrief[];
}

export async function createVaDailyBrief(
  input: VaDailyBriefInput,
  actor: string,
): Promise<{ data: VaDailyBrief | null; error: string | null }> {
  const row = cleanInput(input);
  if (!row.work_date) return { data: null, error: "Work date is required." };
  if (!row.activities_completed) return { data: null, error: "Activities completed is required." };

  if (!supabase) {
    const now = new Date().toISOString();
    const brief: VaDailyBrief = {
      ...row,
      id: `va-brief-${Date.now()}`,
      submitted_by: actor,
      reviewed_status: "new",
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    localSet(LOCAL_BRIEFS, [brief, ...localGet<VaDailyBrief[]>(LOCAL_BRIEFS, [])]);
    return { data: brief, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_va_daily_briefs")
    .insert({ ...row, submitted_by: actor })
    .select()
    .single();
  return { data: (data as VaDailyBrief) ?? null, error: error?.message ?? null };
}

export async function updateVaDailyBrief(
  briefId: string,
  input: VaDailyBriefInput,
  actor: string,
  revisionNote = "",
): Promise<{ data: VaDailyBrief | null; error: string | null }> {
  const row = cleanInput(input);
  if (!row.work_date) return { data: null, error: "Work date is required." };
  if (!row.activities_completed) return { data: null, error: "Activities completed is required." };
  const now = new Date().toISOString();

  if (!supabase) {
    const rows = localGet<VaDailyBrief[]>(LOCAL_BRIEFS, []);
    const nextRows = rows.map(brief => brief.id === briefId ? {
      ...brief,
      ...row,
      revised_at: now,
      revised_by: actor,
      revision_note: revisionNote.trim() || null,
      updated_at: now,
    } : brief);
    localSet(LOCAL_BRIEFS, nextRows);
    return { data: nextRows.find(brief => brief.id === briefId) ?? null, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_va_daily_briefs")
    .update({
      ...row,
      revised_at: now,
      revised_by: actor,
      revision_note: revisionNote.trim() || null,
      updated_at: now,
    })
    .eq("id", briefId)
    .select()
    .single();
  return { data: (data as VaDailyBrief) ?? null, error: error?.message ?? null };
}

export async function fetchVaDailyBriefReviews(briefIds: string[]): Promise<VaDailyBriefReview[]> {
  if (briefIds.length === 0) return [];
  if (!supabase) {
    return localGet<VaDailyBriefReview[]>(LOCAL_REVIEWS, [])
      .filter(review => briefIds.includes(review.brief_id))
      .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
  }
  const { data, error } = await supabase
    .from("meridian_va_daily_brief_reviews")
    .select("*")
    .in("brief_id", briefIds)
    .order("reviewed_at", { ascending: false });
  if (error || !data) return [];
  return data as VaDailyBriefReview[];
}

export async function upsertVaDailyBriefReview(
  briefId: string,
  memberName: string,
  note: string,
): Promise<{ data: VaDailyBriefReview | null; error: string | null }> {
  const now = new Date().toISOString();
  const cleanNote = note.trim() || null;
  if (!supabase) {
    const rows = localGet<VaDailyBriefReview[]>(LOCAL_REVIEWS, []);
    const existing = rows.find(review => review.brief_id === briefId && review.member_name === memberName);
    const nextReview: VaDailyBriefReview = existing
      ? { ...existing, note: cleanNote, reviewed_at: now }
      : { id: `va-review-${Date.now()}`, brief_id: briefId, member_name: memberName, note: cleanNote, reviewed_at: now };
    localSet(LOCAL_REVIEWS, existing ? rows.map(review => review.id === existing.id ? nextReview : review) : [nextReview, ...rows]);
    localSet(LOCAL_BRIEFS, localGet<VaDailyBrief[]>(LOCAL_BRIEFS, []).map(brief => brief.id === briefId ? {
      ...brief,
      reviewed_status: "reviewed",
      reviewed_by: memberName,
      reviewed_at: now,
      review_note: cleanNote,
      updated_at: now,
    } : brief));
    return { data: nextReview, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_va_daily_brief_reviews")
    .upsert({
      brief_id: briefId,
      member_name: memberName,
      note: cleanNote,
      reviewed_at: now,
    }, { onConflict: "brief_id,member_name" })
    .select()
    .single();
  if (error) return { data: null, error: error.message };

  await supabase
    .from("meridian_va_daily_briefs")
    .update({
      reviewed_status: "reviewed",
      reviewed_by: memberName,
      reviewed_at: now,
      review_note: cleanNote,
      updated_at: now,
    })
    .eq("id", briefId);

  return { data: data as VaDailyBriefReview, error: null };
}
