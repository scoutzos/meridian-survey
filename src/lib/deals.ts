import { supabase } from "./supabase";

export type DealPropertyType = "land" | "house" | "rental" | "commercial" | "other";
export type DealStatus = "lead" | "under-review" | "offer-made" | "under-contract" | "due-diligence" | "closed" | "active-project" | "stabilized" | "sold" | "passed";
export type DealUrgency = "routine" | "time-sensitive" | "hot";
export type DealReviewIntent = "needs-info-review" | "ready-for-vote" | "blocked-decision";
export type ChecklistStatus = "open" | "in-review" | "cleared" | "blocked" | "not-applicable";
export type DealVoteOption = "pass" | "needs-more-info" | "schedule-call" | "make-offer" | "counter" | "urgent-review";
export type DealAgreementStatus = "draft" | "ready-for-review" | "approved" | "signed" | "superseded";

export interface DealInput {
  title: string;
  source?: string | null;
  property_type: DealPropertyType;
  strategy: string;
  status?: DealStatus;
  urgency: DealUrgency;
  address?: string | null;
  parcel_id?: string | null;
  seller_name?: string | null;
  seller_phone?: string | null;
  asking_price?: number | null;
  arv?: number | null;
  repair_estimate?: number | null;
  acreage?: number | null;
  zoning?: string | null;
  road_frontage?: string | null;
  utilities?: string | null;
  notes?: string | null;
  links?: string[];
  submitted_by?: string | null;
  assigned_to?: string | null;
  next_follow_up_date?: string | null;
  lead_temperature?: "cold" | "warm" | "hot" | "dead" | null;
  campaign_source?: string | null;
  review_intent?: DealReviewIntent | null;
  submission_summary?: string | null;
  requested_next_step?: string | null;
  submit_uncertainties?: string | null;
  first_submitted_at?: string | null;
  last_submitted_at?: string | null;
  review_round?: number;
  last_review_notification_at?: string | null;
}

export interface Deal extends DealInput {
  id: string;
  status: DealStatus;
  links: string[];
  analysis: DealAnalysis;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealMetric {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}

export interface DealAnalysis {
  recommendation: "Strong Review" | "Review With Caution" | "Needs More Info" | "Likely Pass";
  summary: string;
  metrics: DealMetric[];
  riskFlags: string[];
  missingInfo: string[];
  maxAllowableOffer: number | null;
  confidence: "Low" | "Medium" | "High";
}

export interface DealDueDiligenceItem {
  id: string;
  deal_id: string;
  title: string;
  why_it_matters: string | null;
  required_evidence: string | null;
  status: ChecklistStatus;
  owner: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface DealVote {
  id: string;
  deal_id: string;
  member_name: string;
  vote: DealVoteOption;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  actor: string | null;
  activity_type: "created" | "updated" | "status-change" | "checklist-update" | "submitted-review" | "attachment-added";
  summary: string;
  field_changes: Record<string, unknown>;
  created_at: string;
}

export type DealAttachmentType = "link" | "photo" | "document" | "map" | "county-record" | "comp" | "other";

export interface DealAttachment {
  id: string;
  deal_id: string;
  title: string;
  attachment_type: DealAttachmentType;
  url: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface DealAgreementInput {
  deal_id: string;
  status: DealAgreementStatus;
  offer_authority?: number | null;
  earnest_money?: number | null;
  diligence_budget?: number | null;
  capital_needed?: number | null;
  capital_commitments?: string | null;
  credit_guarantees?: string | null;
  member_roles?: string | null;
  economics?: string | null;
  overrun_rule?: string | null;
  exit_plan?: string | null;
  approval_threshold?: string | null;
  go_no_go_deadline?: string | null;
  notes?: string | null;
}

export interface DealAgreement extends DealAgreementInput {
  id: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

const LOCAL_DEALS = "meridian_deals_local";
const LOCAL_CHECKLIST = "meridian_deal_checklist_local";
const LOCAL_VOTES = "meridian_deal_votes_local";
const LOCAL_AGREEMENTS = "meridian_deal_agreements_local";
const LOCAL_ACTIVITY = "meridian_deal_activity_local";
const LOCAL_ATTACHMENTS = "meridian_deal_attachments_local";

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const parsed = Number(v.replace(/[$,]/g, ""));
  return isFinite(parsed) ? parsed : null;
}

export function calculateDealAnalysis(input: DealInput): DealAnalysis {
  const asking = num(input.asking_price);
  const arv = num(input.arv);
  const repairs = num(input.repair_estimate) ?? 0;
  const acreage = num(input.acreage);
  const isLand = input.property_type === "land";
  const riskFlags: string[] = [];
  const missingInfo: string[] = [];
  const metrics: DealMetric[] = [];
  let maxAllowableOffer: number | null = null;
  let recommendation: DealAnalysis["recommendation"] = "Needs More Info";

  if (!asking) missingInfo.push("Seller asking price");
  if (!input.address && !input.parcel_id) missingInfo.push("Address or parcel ID");

  if (isLand) {
    if (!acreage) missingInfo.push("Acreage or lot dimensions");
    if (!input.zoning?.trim()) missingInfo.push("Zoning");
    if (!input.utilities?.trim()) missingInfo.push("Utility path");
    if (!input.road_frontage?.trim()) missingInfo.push("Road frontage/access");
    if (!arv) missingInfo.push("Estimated resale, builder, or finished-lot value");

    const pricePerAcre = asking && acreage ? asking / acreage : null;
    maxAllowableOffer = arv ? arv * 0.55 : null;
    const spread = asking && maxAllowableOffer ? maxAllowableOffer - asking : null;

    metrics.push(
      { label: "Asking price", value: money(asking) },
      { label: "Acres", value: acreage ? String(acreage) : "—" },
      { label: "Price / acre", value: money(pricePerAcre) },
      { label: "Est. exit value", value: money(arv) },
      { label: "Land MAO", value: money(maxAllowableOffer), tone: maxAllowableOffer && asking && maxAllowableOffer >= asking ? "good" : "warn" },
    );

    if (!input.utilities?.trim()) riskFlags.push("Utility availability is not confirmed.");
    if (!input.zoning?.trim()) riskFlags.push("Zoning/buildability is not confirmed.");
    if (!input.road_frontage?.trim()) riskFlags.push("Legal and physical access need confirmation.");

    if (asking && maxAllowableOffer && spread !== null && spread >= Math.max(10_000, asking * 0.15)) recommendation = "Strong Review";
    else if (asking && maxAllowableOffer && spread !== null && spread >= 0) recommendation = "Review With Caution";
    else if (asking && maxAllowableOffer && spread !== null && spread < 0) recommendation = "Likely Pass";
  } else {
    if (!arv) missingInfo.push("ARV or stabilized value");
    if (!input.repair_estimate && input.property_type !== "rental") missingInfo.push("Repair estimate");

    maxAllowableOffer = arv ? arv * 0.7 - repairs : null;
    const spread = asking && maxAllowableOffer ? maxAllowableOffer - asking : null;
    const margin = arv && asking ? ((arv - asking - repairs) / arv) * 100 : null;

    metrics.push(
      { label: "Asking price", value: money(asking) },
      { label: "ARV/value", value: money(arv) },
      { label: "Repairs", value: money(repairs) },
      { label: "MAO", value: money(maxAllowableOffer), tone: maxAllowableOffer && asking && maxAllowableOffer >= asking ? "good" : "warn" },
      { label: "Gross margin", value: margin === null ? "—" : pct(margin), tone: margin !== null && margin >= 20 ? "good" : "warn" },
    );

    if (repairs > 0 && arv && repairs / arv > 0.35) riskFlags.push("Repair estimate is high relative to value.");
    if (asking && maxAllowableOffer && asking > maxAllowableOffer) riskFlags.push("Asking price is above rule-of-thumb MAO.");

    if (asking && maxAllowableOffer && spread !== null && spread >= Math.max(15_000, asking * 0.15)) recommendation = "Strong Review";
    else if (asking && maxAllowableOffer && spread !== null && spread >= 0) recommendation = "Review With Caution";
    else if (asking && maxAllowableOffer && spread !== null && spread < 0) recommendation = "Likely Pass";
  }

  const known = [asking, arv, input.address || input.parcel_id, input.source, input.notes].filter(Boolean).length;
  const confidence: DealAnalysis["confidence"] = missingInfo.length <= 1 && known >= 4 ? "High" : missingInfo.length <= 3 ? "Medium" : "Low";
  if (missingInfo.length >= 4 && recommendation === "Strong Review") recommendation = "Review With Caution";

  const summary = isLand
    ? `${recommendation}: land value depends on buildability, access, utilities, and comp support. Verify the checklist before making a firm offer.`
    : `${recommendation}: pricing should be validated against ARV, repair scope, holding costs, and exit strategy before the group approves an offer.`;

  return { recommendation, summary, metrics, riskFlags, missingInfo, maxAllowableOffer, confidence };
}

type ChecklistSeed = Omit<DealDueDiligenceItem, "id" | "deal_id" | "created_at" | "updated_at" | "updated_by">;

function item(sort: number, title: string, why: string, evidence: string): ChecklistSeed {
  return { title, why_it_matters: why, required_evidence: evidence, status: "open", owner: null, due_date: null, sort_order: sort };
}

export function generateDueDiligenceChecklist(input: DealInput): ChecklistSeed[] {
  const base = [
    item(10, "Confirm seller ownership", "The group should know the seller has authority to negotiate.", "County owner record, deed, or title search note."),
    item(20, "Check liens, taxes, and code issues", "Hidden obligations can erase margin or block closing.", "Tax record, lien search, code search, or attorney/title note."),
    item(30, "Validate market comps", "The decision should be based on current support, not hope.", "At least 3 relevant comps with source links."),
    item(40, "Confirm exit strategy", "Offer price depends on whether this is a hold, resale, build, or assignment.", "Written strategy note with target buyer or hold assumptions."),
  ];

  if (input.property_type === "land") {
    return [
      ...base,
      item(50, "Verify zoning and future land use", "Land value depends on what can legally be built or done.", "Zoning record and future land-use screenshot/link."),
      item(60, "Confirm legal and physical access", "No access can make a parcel difficult or impossible to monetize.", "Plat, GIS map, road frontage confirmation, easement record if needed."),
      item(70, "Verify utilities or septic/sewer path", "Utility uncertainty can change the entire offer price.", "Water/sewer availability, power proximity, septic/perc requirements."),
      item(80, "Check floodplain, wetlands, buffers, and slope", "Environmental or topography constraints reduce buildable land.", "FEMA/GIS/wetlands/topography screenshots or notes."),
      item(90, "Estimate buildable envelope", "Acreage is not the same as usable land.", "Setback/minimum-lot-size analysis or planning department note."),
      item(100, "Calculate price per buildable lot", "Members need to see value per usable outcome.", "Buildable-lot count, comp support, and calculated price per lot."),
      item(110, "Estimate entitlement and site-prep costs", "Clearing, grading, plats, variances, or utility taps can be material.", "Rough cost estimate or vendor/planning note."),
    ];
  }

  return [
    ...base,
    item(50, "Confirm occupancy status", "Occupancy affects access, timing, cash-for-keys, and legal risk.", "Seller statement, photo, showing note, or occupancy verification."),
    item(60, "Inspect property condition", "Repair scope drives MAO and risk.", "Photo set, walkthrough notes, or inspection report."),
    item(70, "Validate repair estimate", "A weak repair estimate creates false margin.", "Contractor range, scope sheet, or comparable rehab budget."),
    item(80, "Check permit and utility history", "Open permits or inactive utilities can create delay and cost.", "Permit search and utility status note."),
    item(90, "Calculate holding and closing costs", "The group needs full cash exposure before voting.", "Cost worksheet with taxes, insurance, closing, lender, and holding assumptions."),
  ];
}

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function normalizeDeal(row: Record<string, unknown>): Deal {
  return {
    ...(row as unknown as Deal),
    links: Array.isArray(row.links) ? row.links as string[] : [],
    analysis: (row.analysis && typeof row.analysis === "object" ? row.analysis : calculateDealAnalysis(row as unknown as DealInput)) as DealAnalysis,
  };
}

function cleanDealInput(input: DealInput): DealInput {
  return {
    ...input,
    source: input.source?.trim() || null,
    strategy: input.strategy.trim() || "review",
    address: input.address?.trim() || null,
    parcel_id: input.parcel_id?.trim() || null,
    seller_name: input.seller_name?.trim() || null,
    seller_phone: input.seller_phone?.trim() || null,
    zoning: input.zoning?.trim() || null,
    road_frontage: input.road_frontage?.trim() || null,
    utilities: input.utilities?.trim() || null,
    notes: input.notes?.trim() || null,
    submitted_by: input.submitted_by?.trim() || null,
    assigned_to: input.assigned_to?.trim() || null,
    next_follow_up_date: input.next_follow_up_date || null,
    lead_temperature: input.lead_temperature || null,
    campaign_source: input.campaign_source?.trim() || null,
    review_intent: input.review_intent || null,
    submission_summary: input.submission_summary?.trim() || null,
    requested_next_step: input.requested_next_step?.trim() || null,
    submit_uncertainties: input.submit_uncertainties?.trim() || null,
    first_submitted_at: input.first_submitted_at || null,
    last_submitted_at: input.last_submitted_at || null,
    review_round: input.review_round ?? 0,
    last_review_notification_at: input.last_review_notification_at || null,
  };
}

function diffDeal(before: Deal | null, after: DealInput): Record<string, { before: unknown; after: unknown }> {
  if (!before) return {};
  const keys: Array<keyof DealInput> = [
    "title", "source", "property_type", "strategy", "status", "urgency", "address", "parcel_id",
    "seller_name", "seller_phone", "asking_price", "arv", "repair_estimate", "acreage", "zoning",
    "road_frontage", "utilities", "notes", "submitted_by", "assigned_to", "next_follow_up_date",
    "lead_temperature", "campaign_source", "review_intent", "submission_summary", "requested_next_step",
    "submit_uncertainties", "first_submitted_at", "last_submitted_at", "review_round", "last_review_notification_at",
  ];
  return keys.reduce<Record<string, { before: unknown; after: unknown }>>((acc, key) => {
    const left = before[key] ?? null;
    const right = after[key] ?? null;
    if (JSON.stringify(left) !== JSON.stringify(right)) acc[key] = { before: left, after: right };
    return acc;
  }, {});
}

export async function createDealActivity(
  patch: { deal_id: string; actor: string; activity_type: DealActivity["activity_type"]; summary: string; field_changes?: Record<string, unknown> },
): Promise<{ error: string | null }> {
  const row = { ...patch, field_changes: patch.field_changes ?? {} };
  if (!supabase) {
    const now = new Date().toISOString();
    const activity: DealActivity = { id: `activity-${Date.now()}`, created_at: now, ...row };
    localSet(LOCAL_ACTIVITY, [activity, ...localGet<DealActivity[]>(LOCAL_ACTIVITY, [])]);
    return { error: null };
  }
  const { error } = await supabase.from("meridian_deal_activity").insert(row);
  return { error: error?.message ?? null };
}

export async function fetchDealActivity(dealId: string): Promise<DealActivity[]> {
  if (!supabase) return localGet<DealActivity[]>(LOCAL_ACTIVITY, []).filter(a => a.deal_id === dealId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase
    .from("meridian_deal_activity")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DealActivity[];
}

export async function fetchDealAttachments(dealId: string): Promise<DealAttachment[]> {
  if (!supabase) return localGet<DealAttachment[]>(LOCAL_ATTACHMENTS, []).filter(a => a.deal_id === dealId && !a.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase
    .from("meridian_deal_attachments")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DealAttachment[];
}

export async function createDealAttachment(
  patch: { deal_id: string; title: string; attachment_type: DealAttachmentType; url: string; notes?: string | null },
  actor: string,
): Promise<{ data: DealAttachment | null; error: string | null }> {
  const row = {
    deal_id: patch.deal_id,
    title: patch.title.trim(),
    attachment_type: patch.attachment_type,
    url: patch.url.trim(),
    notes: patch.notes?.trim() || null,
    created_by: actor,
  };
  if (!row.title || !row.url) return { data: null, error: "Attachment title and URL are required." };
  if (!supabase) {
    const now = new Date().toISOString();
    const attachment: DealAttachment = { ...row, id: `attachment-${Date.now()}`, created_at: now, deleted_at: null };
    localSet(LOCAL_ATTACHMENTS, [attachment, ...localGet<DealAttachment[]>(LOCAL_ATTACHMENTS, [])]);
    await createDealActivity({ deal_id: patch.deal_id, actor, activity_type: "attachment-added", summary: `Added attachment: ${row.title}`, field_changes: row });
    return { data: attachment, error: null };
  }
  const { data, error } = await supabase.from("meridian_deal_attachments").insert(row).select().single();
  if (!error) await createDealActivity({ deal_id: patch.deal_id, actor, activity_type: "attachment-added", summary: `Added attachment: ${row.title}`, field_changes: row });
  return { data: (data as DealAttachment) ?? null, error: error?.message ?? null };
}

export async function fetchDeals(): Promise<Deal[]> {
  if (!supabase) return localGet<Deal[]>(LOCAL_DEALS, []);
  const { data, error } = await supabase
    .from("meridian_deals")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeDeal);
}

export async function fetchDealChecklist(dealId: string): Promise<DealDueDiligenceItem[]> {
  if (!supabase) return localGet<DealDueDiligenceItem[]>(LOCAL_CHECKLIST, []).filter(i => i.deal_id === dealId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await supabase
    .from("meridian_deal_due_diligence_items")
    .select("*")
    .eq("deal_id", dealId)
    .order("sort_order");
  if (error || !data) return [];
  return data as DealDueDiligenceItem[];
}

export async function fetchDealVotes(dealId: string): Promise<DealVote[]> {
  if (!supabase) return localGet<DealVote[]>(LOCAL_VOTES, []).filter(v => v.deal_id === dealId);
  const { data, error } = await supabase
    .from("meridian_deal_votes")
    .select("*")
    .eq("deal_id", dealId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as DealVote[];
}

export async function fetchDealAgreement(dealId: string): Promise<DealAgreement | null> {
  if (!supabase) return localGet<DealAgreement[]>(LOCAL_AGREEMENTS, []).find(a => a.deal_id === dealId) ?? null;
  const { data, error } = await supabase
    .from("meridian_deal_agreements")
    .select("*")
    .eq("deal_id", dealId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as DealAgreement;
}

export async function createDeal(input: DealInput, actor: string): Promise<{ data: Deal | null; error: string | null }> {
  const clean = cleanDealInput({ ...input, submitted_by: input.submitted_by ?? actor, assigned_to: input.assigned_to ?? actor });
  const analysis = calculateDealAnalysis(input);
  const links = (input.links ?? []).map(l => l.trim()).filter(Boolean);
  if (!supabase) {
    const now = new Date().toISOString();
    const deal: Deal = {
      ...clean,
      id: `local-${Date.now()}`,
      status: input.status ?? "under-review",
      links,
      analysis,
      created_at: now,
      created_by: actor,
      updated_at: now,
      updated_by: actor,
      deleted_at: null,
    };
    localSet(LOCAL_DEALS, [deal, ...localGet<Deal[]>(LOCAL_DEALS, [])]);
    const checklist = generateDueDiligenceChecklist(input).map((seed, idx): DealDueDiligenceItem => ({
      ...seed,
      id: `${deal.id}-${idx}`,
      deal_id: deal.id,
      created_at: now,
      updated_at: now,
      updated_by: actor,
    }));
    localSet(LOCAL_CHECKLIST, [...localGet<DealDueDiligenceItem[]>(LOCAL_CHECKLIST, []), ...checklist]);
    await createDealActivity({ deal_id: deal.id, actor, activity_type: "created", summary: "Created deal intake packet.", field_changes: clean as unknown as Record<string, unknown> });
    return { data: deal, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_deals")
    .insert({ ...clean, links, analysis, status: clean.status ?? "under-review", created_by: actor, updated_by: actor })
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Deal create failed" };

  const deal = normalizeDeal(data as Record<string, unknown>);
  const checklist = generateDueDiligenceChecklist(input).map(seed => ({ ...seed, deal_id: deal.id }));
  const { error: checklistError } = await supabase.from("meridian_deal_due_diligence_items").insert(checklist);
  await createDealActivity({ deal_id: deal.id, actor, activity_type: "created", summary: "Created deal intake packet.", field_changes: clean as unknown as Record<string, unknown> });
  return { data: deal, error: checklistError?.message ?? null };
}

export async function updateDeal(
  id: string,
  input: DealInput,
  actor: string,
): Promise<{ data: Deal | null; error: string | null }> {
  const current = (await fetchDeals()).find(deal => deal.id === id) ?? null;
  const clean = cleanDealInput(input);
  const analysis = calculateDealAnalysis(clean);
  const links = (input.links ?? []).map(l => l.trim()).filter(Boolean);
  const row = {
    ...clean,
    links,
    analysis,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };

  if (!supabase) {
    const rows = localGet<Deal[]>(LOCAL_DEALS, []);
    const next = rows.map(deal => deal.id === id ? normalizeDeal({ ...deal, ...row }) : deal);
    localSet(LOCAL_DEALS, next);
    await createDealActivity({ deal_id: id, actor, activity_type: current?.status !== clean.status ? "status-change" : "updated", summary: current?.status !== clean.status ? `Status changed to ${clean.status}.` : "Updated deal details.", field_changes: diffDeal(current, clean) });
    return { data: next.find(deal => deal.id === id) ?? null, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_deals")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Deal update failed" };
  await createDealActivity({ deal_id: id, actor, activity_type: current?.status !== clean.status ? "status-change" : "updated", summary: current?.status !== clean.status ? `Status changed to ${clean.status}.` : "Updated deal details.", field_changes: diffDeal(current, clean) });
  return { data: normalizeDeal(data as Record<string, unknown>), error: null };
}

export async function updateChecklistItemStatus(
  id: string,
  status: ChecklistStatus,
  actor: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    const rows = localGet<DealDueDiligenceItem[]>(LOCAL_CHECKLIST, []);
    const existing = rows.find(r => r.id === id);
    localSet(LOCAL_CHECKLIST, rows.map(r => r.id === id ? { ...r, status, updated_at: new Date().toISOString(), updated_by: actor } : r));
    if (existing) await createDealActivity({ deal_id: existing.deal_id, actor, activity_type: "checklist-update", summary: `Checklist updated: ${existing.title} -> ${status}`, field_changes: { checklist_item_id: id, status } });
    return { error: null };
  }
  const { data: existing } = await supabase.from("meridian_deal_due_diligence_items").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("meridian_deal_due_diligence_items")
    .update({ status, updated_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  if (!error && existing) await createDealActivity({ deal_id: existing.deal_id, actor, activity_type: "checklist-update", summary: `Checklist updated: ${existing.title} -> ${status}`, field_changes: { checklist_item_id: id, status } });
  return { error: error?.message ?? null };
}

export async function upsertDealVote(
  dealId: string,
  memberName: string,
  vote: DealVoteOption,
  note: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<DealVote[]>(LOCAL_VOTES, []);
    const existing = rows.find(v => v.deal_id === dealId && v.member_name === memberName);
    const next = existing
      ? rows.map(v => v === existing ? { ...v, vote, note: note.trim() || null, updated_at: now } : v)
      : [{ id: `vote-${Date.now()}`, deal_id: dealId, member_name: memberName, vote, note: note.trim() || null, created_at: now, updated_at: now }, ...rows];
    localSet(LOCAL_VOTES, next);
    return { error: null };
  }
  const { error } = await supabase.from("meridian_deal_votes").upsert({
    deal_id: dealId,
    member_name: memberName,
    vote,
    note: note.trim() || null,
    updated_at: now,
  }, { onConflict: "deal_id,member_name" });
  return { error: error?.message ?? null };
}

export async function upsertDealAgreement(
  input: DealAgreementInput,
  actor: string,
): Promise<{ data: DealAgreement | null; error: string | null }> {
  const now = new Date().toISOString();
  const row = {
    ...input,
    offer_authority: num(input.offer_authority),
    earnest_money: num(input.earnest_money),
    diligence_budget: num(input.diligence_budget),
    capital_needed: num(input.capital_needed),
    capital_commitments: input.capital_commitments?.trim() || null,
    credit_guarantees: input.credit_guarantees?.trim() || null,
    member_roles: input.member_roles?.trim() || null,
    economics: input.economics?.trim() || null,
    overrun_rule: input.overrun_rule?.trim() || null,
    exit_plan: input.exit_plan?.trim() || null,
    approval_threshold: input.approval_threshold?.trim() || null,
    go_no_go_deadline: input.go_no_go_deadline?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: now,
    updated_by: actor,
    approved_at: input.status === "approved" || input.status === "signed" ? now : null,
    approved_by: input.status === "approved" || input.status === "signed" ? actor : null,
  };

  if (!supabase) {
    const rows = localGet<DealAgreement[]>(LOCAL_AGREEMENTS, []);
    const existing = rows.find(a => a.deal_id === input.deal_id);
    const nextAgreement: DealAgreement = existing
      ? { ...existing, ...row }
      : {
          ...row,
          id: `agreement-${Date.now()}`,
          created_at: now,
          created_by: actor,
        };
    localSet(LOCAL_AGREEMENTS, existing ? rows.map(a => a.id === existing.id ? nextAgreement : a) : [nextAgreement, ...rows]);
    return { data: nextAgreement, error: null };
  }

  const existing = await fetchDealAgreement(input.deal_id);
  const { data, error } = await supabase.from("meridian_deal_agreements").upsert({
    ...(existing ? { id: existing.id } : {}),
    ...row,
    created_by: existing?.created_by ?? actor,
  }, { onConflict: "deal_id" }).select().single();
  return { data: data as DealAgreement | null, error: error?.message ?? null };
}

export function buildDealAgreementMemo(deal: Deal, agreement: DealAgreementInput | DealAgreement | null, votes: DealVote[]): string {
  const a = agreement;
  const voteLines = votes.length
    ? votes.map(v => `- ${v.member_name}: ${v.vote}${v.note ? ` — ${v.note}` : ""}`).join("\n")
    : "- No member votes recorded yet.";
  return [
    "MERIDIAN COLLECTIVE",
    "Deal Approval Memo / Deal Participation Agreement",
    "",
    "Purpose",
    "This memo supplements the Meridian Collective Operating Agreement for this specific deal only. Equal company membership does not require equal deal economics; this memo controls the deal-level capital, risk, roles, and economics approved for this opportunity.",
    "",
    `Deal: ${deal.title}`,
    `Location: ${deal.address || deal.parcel_id || "Pending"}`,
    `Strategy: ${deal.strategy}`,
    `Status: ${a?.status ?? "draft"}`,
    "",
    "Offer & Budget Authority",
    `- Offer authority: ${money(a?.offer_authority)}`,
    `- Earnest money: ${money(a?.earnest_money)}`,
    `- Due diligence budget: ${money(a?.diligence_budget)}`,
    `- Capital needed: ${money(a?.capital_needed)}`,
    `- Go/no-go deadline: ${a?.go_no_go_deadline || "Pending"}`,
    "",
    "Capital, Credit & Guarantees",
    a?.capital_commitments || "Pending member-by-member capital commitments.",
    "",
    a?.credit_guarantees || "Pending credit, guarantee, or lender exposure terms.",
    "",
    "Roles & Responsibilities",
    a?.member_roles || "Pending member role assignments.",
    "",
    "Deal Economics",
    a?.economics || "Pending profit/loss split, preferred return, fees, commissions, and waterfall terms.",
    "",
    "Overruns / Additional Capital",
    a?.overrun_rule || "Pending rule for overruns, capital calls, member loans, and opt-in/opt-out rights.",
    "",
    "Exit Plan",
    a?.exit_plan || "Pending sale, hold, assignment, refinance, or pass criteria.",
    "",
    "Approval Rule",
    a?.approval_threshold || "Majority approval unless debt, guarantees, outside equity, acquisition, or OA-defined major decisions require supermajority/unanimous consent.",
    "",
    "Member Votes",
    voteLines,
    "",
    "Notes",
    a?.notes || "None.",
  ].join("\n");
}
