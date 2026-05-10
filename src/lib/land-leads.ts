import { supabase } from "./supabase";
import type { DealInput } from "./deals";

export interface LandLeadBatch {
  id: string;
  source_system: string;
  original_filename: string | null;
  campaign_source: string | null;
  row_count: number;
  uploaded_by: string | null;
  status?: "not-started" | "in-progress" | "completed";
  assigned_to?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  import_summary?: Record<string, unknown>;
  notes?: string | null;
  created_at: string;
}

export interface ImportedLandLead {
  id: string;
  batch_id: string | null;
  source_system: string;
  campaign_source: string | null;
  owner_name: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  property_address: string | null;
  parcel_id: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  mailing_address: string | null;
  acreage: number | null;
  asking_price: number | null;
  assessed_value: number | null;
  market_value: number | null;
  zoning: string | null;
  land_use: string | null;
  property_url: string | null;
  status: "new" | "contacted" | "interested" | "converted" | "passed";
  deal_id: string | null;
  duplicate_status?: "new" | "possible-duplicate" | "already-converted";
  duplicate_of?: string | null;
  lead_score?: number;
  score_reasons?: string[];
  assigned_to?: string | null;
  next_follow_up_date?: string | null;
  outreach_count?: number;
  last_activity_at?: string | null;
  last_activity_type?: string | null;
  sms_opt_status?: "unknown" | "opted-in" | "opted-out";
  last_sms_at?: string | null;
  last_sms_direction?: "inbound" | "outbound" | null;
  last_sms_body?: string | null;
  sakari_contact_id?: string | null;
  sakari_conversation_id?: string | null;
  notes: string | null;
  raw_data: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadImportResult {
  batch: LandLeadBatch | null;
  leads: ImportedLandLead[];
  error: string | null;
  warning?: string | null;
}

export interface LandLeadImportPreview {
  filename: string;
  rowsFound: number;
  usableLeads: number;
  missingPhone: number;
  missingOwner: number;
  possibleDuplicates: number;
  alreadyConverted: number;
  averageScore: number;
  sampleLeads: Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>;
  duplicateKeys: string[];
  csvText: string;
  error: string | null;
}

export interface ImportedLandLeadActivity {
  id: string;
  lead_id: string;
  actor: string | null;
  activity_type: "called" | "texted" | "emailed" | "left-voicemail" | "wrong-number" | "interested" | "not-interested" | "follow-up-set" | "note" | "converted";
  summary: string;
  next_follow_up_date: string | null;
  created_at: string;
}

const LOCAL_BATCHES = "meridian_land_lead_batches_local";
const LOCAL_LEADS = "meridian_imported_land_leads_local";
const LOCAL_ACTIVITIES = "meridian_imported_land_lead_activities_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function boolish(value: unknown): boolean {
  const text = clean(value)?.toLowerCase();
  return !!text && !["n", "no", "false", "0", "none"].includes(text);
}

function hasPositiveNumber(value: unknown): boolean {
  const parsed = parseNumber(value);
  return typeof parsed === "number" && parsed > 0;
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pick(row: Record<string, string>, aliases: string[]): string | null {
  const normalized = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value;
    return acc;
  }, {});
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    if (clean(value)) return clean(value);
  }
  return null;
}

function noteLine(row: Record<string, string>, label: string, aliases: string[]): string {
  const value = pick(row, aliases);
  return value ? `${label}: ${value}` : "";
}

function duplicateKey(lead: Pick<ImportedLandLead, "parcel_id" | "property_address" | "phone" | "phone_2" | "owner_name">): string {
  return [
    lead.parcel_id,
    lead.property_address,
    lead.phone || lead.phone_2,
    lead.owner_name,
  ].filter(Boolean).join("|").toLowerCase().replace(/\s+/g, " ").trim();
}

function strongDuplicateMatch(a: Pick<ImportedLandLead, "parcel_id" | "property_address" | "phone" | "phone_2">, b: Pick<ImportedLandLead, "parcel_id" | "property_address" | "phone" | "phone_2">): boolean {
  const parcelMatch = !!a.parcel_id && !!b.parcel_id && a.parcel_id.toLowerCase() === b.parcel_id.toLowerCase();
  const addressMatch = !!a.property_address && !!b.property_address && a.property_address.toLowerCase() === b.property_address.toLowerCase();
  const phones = [a.phone, a.phone_2].filter(Boolean).map(v => String(v).replace(/\D/g, ""));
  const otherPhones = [b.phone, b.phone_2].filter(Boolean).map(v => String(v).replace(/\D/g, ""));
  const phoneMatch = phones.some(phone => phone.length >= 7 && otherPhones.includes(phone));
  return parcelMatch || addressMatch || phoneMatch;
}

function scoreLead(row: Record<string, string>, lead: Pick<ImportedLandLead, "phone" | "phone_2" | "email" | "property_address" | "parcel_id" | "acreage" | "market_value" | "land_use">): { lead_score: number; score_reasons: string[] } {
  let score = 20;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => { score += points; reasons.push(reason); };
  const subtract = (points: number, reason: string) => { score -= points; reasons.push(reason); };

  if (lead.phone || lead.phone_2) add(15, "Phone present");
  if (lead.email) add(5, "Email present");
  if (lead.parcel_id) add(8, "APN present");
  if (lead.property_address) add(8, "Parcel address present");
  if (typeof lead.acreage === "number" && lead.acreage >= 0.25 && lead.acreage <= 10) add(8, "Usable acreage range");
  if (lead.market_value) add(8, "Value estimate present");
  if ((lead.land_use || "").toLowerCase().includes("vacant")) add(8, "Vacant land");
  if (hasPositiveNumber(pick(row, ["road frontage ft", "road frontage"]))) add(8, "Road frontage");
  if (["high", "medium"].includes((pick(row, ["selleriq"]) || "").toLowerCase())) add(5, "SellerIQ signal");
  if (boolish(pick(row, ["land locked", "tag land locked"]))) subtract(20, "Land locked");
  if (hasPositiveNumber(pick(row, ["flood zone percent", "flood zone", "flood"]))) subtract(10, "Flood flag");
  if (hasPositiveNumber(pick(row, ["wetlands percent", "wetlands", "tag wetlands"]))) subtract(10, "Wetlands flag");
  if (boolish(pick(row, ["tag bad topography"]))) subtract(8, "Bad topography flag");
  if (!lead.phone && !lead.phone_2 && !lead.email) subtract(12, "No direct contact");

  return { lead_score: Math.max(0, Math.min(100, score)), score_reasons: reasons };
}

const HEADER_HINTS = new Set([
  "apn",
  "parcelid",
  "parceladdress",
  "ownername",
  "ownernames",
  "mailfulladdress",
  "acreage",
  "calculatedacreage",
  "county",
  "phone1",
  "email",
]);

function findHeaderIndex(rows: string[][]): number {
  const firstRows = rows.slice(0, 10);
  const hinted = firstRows.findIndex(row => {
    const normalized = row.map(normalizeHeader);
    const score = normalized.filter(header => HEADER_HINTS.has(header)).length;
    return score >= 3;
  });
  if (hinted >= 0) return hinted;
  if (rows[0]?.length === 1 && (rows[1]?.length ?? 0) > 1) return 1;
  return 0;
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  const headerIndex = findHeaderIndex(rows);
  if (rows.length - headerIndex < 2) return [];
  const headers = rows[headerIndex].map(header => header.trim());
  return rows.slice(headerIndex + 1).map(values => headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header || `Column ${index + 1}`] = values[index]?.trim() ?? "";
    return acc;
  }, {})).filter(row => Object.values(row).some(value => value.trim()));
}

function normalizeLead(row: Record<string, string>, sourceSystem: string, campaignSource: string | null, actor: string, batchId: string | null): Omit<ImportedLandLead, "id" | "created_at" | "updated_at"> {
  const propertyAddress = pick(row, ["property address", "parcel address", "site address", "situs address", "address", "location", "property"]);
  const city = pick(row, ["city", "property city", "situs city"]);
  const state = pick(row, ["state", "property state", "situs state"]);
  const zip = pick(row, ["zip", "zipcode", "postal code", "property zip"]);
  const county = pick(row, ["county", "property county"]);
  const parcel = pick(row, ["parcel id", "parcel", "apn", "tax id", "tax parcel", "pin"]);
  const owner = pick(row, ["owner", "owner name", "owner names", "owner name(s)", "seller", "seller name", "name", "full name"]);
  const phone = pick(row, ["phone", "phone 1", "primary phone", "seller phone", "mobile", "cell"]);
  const phone2 = pick(row, ["phone 2", "secondary phone", "alternate phone", "alt phone"]);
  const value = parseNumber(pick(row, ["market value estimate", "market total parcel value", "market value", "estimated value", "value", "total parcel value", "land value", "land price", "price", "total value"]));
  const base = {
    batch_id: batchId,
    source_system: sourceSystem,
    campaign_source: campaignSource,
    owner_name: owner,
    phone,
    phone_2: phone2,
    email: pick(row, ["email", "seller email", "owner email"]),
    property_address: propertyAddress,
    parcel_id: parcel,
    county,
    city,
    state,
    zip,
    mailing_address: pick(row, ["mail full address", "mailing address", "owner mailing address", "mail address", "mail", "mailing"]),
    acreage: parseNumber(pick(row, ["acreage", "calculated acreage", "calculated a", "acres", "lot size acres", "land acres"])),
    asking_price: parseNumber(pick(row, ["asking price", "ask", "list price", "seller price"])),
    assessed_value: parseNumber(pick(row, ["assessed value", "tax assessed value", "assessment", "improvement value"])),
    market_value: value,
    zoning: pick(row, ["zoning", "zone", "zoning code"]),
    land_use: pick(row, ["land use description", "land use", "property use", "use code", "property type"]),
    property_url: pick(row, ["url", "link", "property url", "listing url", "land insights url", "data link", "parcel link", "map link", "google maps", "earth"]),
    status: "new" as const,
    deal_id: null,
    duplicate_status: "new" as const,
    duplicate_of: null,
    assigned_to: actor,
    next_follow_up_date: null,
    outreach_count: 0,
    last_activity_at: null,
    last_activity_type: null,
    notes: pick(row, ["notes", "remarks", "comments"]),
    raw_data: row,
    uploaded_by: actor,
  };
  return { ...base, ...scoreLead(row, base) };
}

function applyDuplicateMetadata<T extends Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>(leads: T[], existing: ImportedLandLead[]): T[] {
  const seen = new Map<string, { id: string | null; converted: boolean }>();
  existing.forEach(lead => {
    const key = duplicateKey(lead);
    if (key) seen.set(key, { id: lead.id, converted: lead.status === "converted" || !!lead.deal_id });
  });
  return leads.map(lead => {
    const exact = seen.get(duplicateKey(lead));
    const fuzzy = exact ? null : existing.find(row => strongDuplicateMatch(lead, row));
    const converted = exact?.converted || fuzzy?.status === "converted" || !!fuzzy?.deal_id;
    const duplicate_of = exact?.id || fuzzy?.id || null;
    const duplicate_status = duplicate_of ? (converted ? "already-converted" : "possible-duplicate") : "new";
    const next = { ...lead, duplicate_status, duplicate_of } as T;
    const key = duplicateKey(next);
    if (key && !seen.has(key)) seen.set(key, { id: null, converted: false });
    return next;
  });
}

function isSchemaMismatch(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "PGRST204"
    || message.includes("column")
    || message.includes("schema cache")
    || message.includes("does not exist")
    || message.includes("could not find");
}

function legacyLeadInsert(lead: Omit<ImportedLandLead, "id" | "created_at" | "updated_at">) {
  return {
    batch_id: lead.batch_id,
    source_system: lead.source_system,
    campaign_source: lead.campaign_source,
    owner_name: lead.owner_name,
    phone: lead.phone,
    phone_2: lead.phone_2,
    email: lead.email,
    property_address: lead.property_address,
    parcel_id: lead.parcel_id,
    county: lead.county,
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    mailing_address: lead.mailing_address,
    acreage: lead.acreage,
    asking_price: lead.asking_price,
    assessed_value: lead.assessed_value,
    market_value: lead.market_value,
    zoning: lead.zoning,
    land_use: lead.land_use,
    property_url: lead.property_url,
    status: lead.status,
    deal_id: lead.deal_id,
    notes: lead.notes,
    raw_data: lead.raw_data,
    uploaded_by: lead.uploaded_by,
  };
}

async function insertLeadRowsInChunks(
  leads: Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>,
  useLegacyShape = false,
): Promise<{ count: number; error: { message?: string; code?: string } | null }> {
  if (!supabase) return { count: 0, error: null };
  let count = 0;
  const chunkSize = 100;
  for (let index = 0; index < leads.length; index += chunkSize) {
    const chunk = leads.slice(index, index + chunkSize);
    const payload = useLegacyShape ? chunk.map(legacyLeadInsert) : chunk;
    const { error } = await supabase
      .from("meridian_imported_land_leads")
      .insert(payload);
    if (error) return { count, error };
    count += chunk.length;
  }
  return { count, error: null };
}

export async function previewLandLeadsCsv(args: {
  csvText: string;
  filename: string;
  sourceSystem: string;
  campaignSource?: string | null;
  actor: string;
}): Promise<LandLeadImportPreview> {
  const rows = parseCsv(args.csvText);
  if (rows.length === 0) {
    return { filename: args.filename, rowsFound: 0, usableLeads: 0, missingPhone: 0, missingOwner: 0, possibleDuplicates: 0, alreadyConverted: 0, averageScore: 0, sampleLeads: [], duplicateKeys: [], csvText: args.csvText, error: "No lead rows found. Upload a CSV with a header row." };
  }
  const existing = await fetchImportedLandLeads(5000);
  const normalized = applyDuplicateMetadata(rows.map(row => normalizeLead(row, args.sourceSystem, args.campaignSource?.trim() || null, args.actor, null)), existing);
  const usable = normalized.filter(lead => lead.owner_name || lead.phone || lead.phone_2 || lead.parcel_id || lead.property_address);
  const scores = usable.map(lead => lead.lead_score ?? 0);
  return {
    filename: args.filename,
    rowsFound: rows.length,
    usableLeads: usable.length,
    missingPhone: usable.filter(lead => !lead.phone && !lead.phone_2).length,
    missingOwner: usable.filter(lead => !lead.owner_name).length,
    possibleDuplicates: usable.filter(lead => lead.duplicate_status === "possible-duplicate").length,
    alreadyConverted: usable.filter(lead => lead.duplicate_status === "already-converted").length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    sampleLeads: usable.slice(0, 5),
    duplicateKeys: usable.filter(lead => lead.duplicate_status !== "new").slice(0, 10).map(duplicateKey),
    csvText: args.csvText,
    error: null,
  };
}

export async function importLandLeadsFromCsv(args: {
  csvText: string;
  filename: string;
  sourceSystem: string;
  campaignSource?: string | null;
  actor: string;
}): Promise<LeadImportResult> {
  const rows = parseCsv(args.csvText);
  if (rows.length === 0) return { batch: null, leads: [], error: "No lead rows found. Upload a CSV with a header row." };
  const now = new Date().toISOString();
  const batchSeed = {
    source_system: args.sourceSystem.trim() || "land-list",
    original_filename: args.filename,
    campaign_source: args.campaignSource?.trim() || null,
    row_count: rows.length,
    uploaded_by: args.actor,
  };
  const enhancedBatchFields = {
    assigned_to: args.actor,
    status: "not-started" as const,
    import_summary: {
      rows_found: rows.length,
      imported_at: now,
    },
  };

  if (!supabase) {
    const batch: LandLeadBatch = { ...batchSeed, ...enhancedBatchFields, id: `lead-batch-${Date.now()}`, created_at: now };
    const existing = localGet<ImportedLandLead[]>(LOCAL_LEADS, []);
    const normalized = applyDuplicateMetadata(rows.map(row => normalizeLead(row, batch.source_system, batch.campaign_source, args.actor, batch.id)), existing);
    const leads = normalized.map((lead, index): ImportedLandLead => ({
      ...lead,
      id: `${batch.id}-${index}`,
      created_at: now,
      updated_at: now,
    }));
    localSet(LOCAL_BATCHES, [batch, ...localGet<LandLeadBatch[]>(LOCAL_BATCHES, [])]);
    localSet(LOCAL_LEADS, [...leads, ...existing]);
    return { batch, leads, error: null };
  }

  const { data: batchData, error: batchError } = await supabase
    .from("meridian_land_lead_import_batches")
    .insert({ ...batchSeed, ...enhancedBatchFields })
    .select()
    .single();
  let batch = batchData as LandLeadBatch | null;
  let warning: string | null = null;
  if ((batchError || !batchData) && isSchemaMismatch(batchError)) {
    const legacy = await supabase
      .from("meridian_land_lead_import_batches")
      .insert(batchSeed)
      .select()
      .single();
    if (legacy.error || !legacy.data) return { batch: null, leads: [], error: legacy.error?.message ?? batchError?.message ?? "Could not create import batch." };
    batch = legacy.data as LandLeadBatch;
    warning = "Imported with the existing database schema. Run migration 028 to enable scoring, duplicate flags, batch status, and activity logging.";
  } else if (batchError || !batchData) {
    return { batch: null, leads: [], error: batchError?.message ?? "Could not create import batch." };
  }
  if (!batch) return { batch: null, leads: [], error: "Could not create import batch." };

  const existing = await fetchImportedLandLeads(5000);
  const inserts = applyDuplicateMetadata(rows.map(row => normalizeLead(row, batch.source_system, batch.campaign_source, args.actor, batch.id)), existing);
  const enhanced = await insertLeadRowsInChunks(inserts);
  if (enhanced.error && isSchemaMismatch(enhanced.error)) {
    const legacy = await insertLeadRowsInChunks(inserts, true);
    if (legacy.error) return { batch, leads: [], error: legacy.error?.message ?? enhanced.error?.message ?? "Could not import lead rows." };
    return {
      batch,
      leads: inserts.slice(0, legacy.count).map((lead, index) => ({
        ...legacyLeadInsert(lead),
        id: `${batch.id}-imported-${index}`,
        created_at: now,
        updated_at: now,
        duplicate_status: lead.duplicate_status,
        duplicate_of: lead.duplicate_of,
        lead_score: lead.lead_score,
        score_reasons: lead.score_reasons,
        assigned_to: lead.assigned_to,
        next_follow_up_date: lead.next_follow_up_date,
        outreach_count: lead.outreach_count,
        last_activity_at: lead.last_activity_at,
        last_activity_type: lead.last_activity_type,
      })),
      error: null,
      warning: warning ?? "Imported with the existing database schema. Run migration 028 to enable scoring, duplicate flags, batch status, and activity logging.",
    };
  }
  if (enhanced.error) return { batch, leads: [], error: enhanced.error?.message ?? "Could not import lead rows." };
  return {
    batch,
    leads: inserts.slice(0, enhanced.count).map((lead, index) => ({
      ...lead,
      id: `${batch.id}-imported-${index}`,
      created_at: now,
      updated_at: now,
    })),
    error: null,
    warning,
  };
}

export async function fetchLandLeadBatches(limit = 30): Promise<LandLeadBatch[]> {
  if (!supabase) {
    return localGet<LandLeadBatch[]>(LOCAL_BATCHES, [])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from("meridian_land_lead_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as LandLeadBatch[];
}

export async function fetchImportedLandLeads(limit = 250): Promise<ImportedLandLead[]> {
  if (!supabase) {
    return localGet<ImportedLandLead[]>(LOCAL_LEADS, [])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from("meridian_imported_land_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as ImportedLandLead[];
}

export async function updateImportedLandLeadStatus(id: string, status: ImportedLandLead["status"], dealId?: string | null): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<ImportedLandLead[]>(LOCAL_LEADS, []);
    localSet(LOCAL_LEADS, rows.map(row => row.id === id ? { ...row, status, deal_id: dealId ?? row.deal_id, updated_at: now } : row));
    return { error: null };
  }
  const { error } = await supabase
    .from("meridian_imported_land_leads")
    .update({ status, deal_id: dealId ?? null, updated_at: now })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function updateLandLeadBatch(id: string, patch: Partial<Pick<LandLeadBatch, "status" | "assigned_to" | "notes">>): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const row = {
    ...patch,
    started_at: patch.status === "in-progress" ? now : undefined,
    completed_at: patch.status === "completed" ? now : undefined,
  };
  if (!supabase) {
    const batches = localGet<LandLeadBatch[]>(LOCAL_BATCHES, []);
    localSet(LOCAL_BATCHES, batches.map(batch => batch.id === id ? { ...batch, ...row } : batch));
    return { error: null };
  }
  const { error } = await supabase
    .from("meridian_land_lead_import_batches")
    .update(row)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function createImportedLandLeadActivity(args: {
  leadId: string;
  actor: string;
  activityType: ImportedLandLeadActivity["activity_type"];
  summary: string;
  nextFollowUpDate?: string | null;
}): Promise<{ data: ImportedLandLeadActivity | null; error: string | null }> {
  const now = new Date().toISOString();
  const row = {
    lead_id: args.leadId,
    actor: args.actor,
    activity_type: args.activityType,
    summary: args.summary.trim() || statusLabel(args.activityType),
    next_follow_up_date: args.nextFollowUpDate || null,
  };
  if (!supabase) {
    const activity: ImportedLandLeadActivity = { ...row, id: `lead-activity-${Date.now()}`, created_at: now };
    localSet(LOCAL_ACTIVITIES, [activity, ...localGet<ImportedLandLeadActivity[]>(LOCAL_ACTIVITIES, [])]);
    const leads = localGet<ImportedLandLead[]>(LOCAL_LEADS, []);
    localSet(LOCAL_LEADS, leads.map(lead => {
      if (lead.id !== args.leadId) return lead;
      const outreach = ["called", "texted", "emailed", "left-voicemail"].includes(args.activityType);
      const nextStatus = args.activityType === "interested" ? "interested"
        : args.activityType === "not-interested" ? "passed"
          : lead.status === "new" && ["called", "texted", "emailed", "left-voicemail", "wrong-number", "follow-up-set"].includes(args.activityType) ? "contacted"
            : lead.status;
      return {
        ...lead,
        status: nextStatus,
        outreach_count: (lead.outreach_count ?? 0) + (outreach ? 1 : 0),
        last_activity_at: now,
        last_activity_type: args.activityType,
        next_follow_up_date: args.nextFollowUpDate || lead.next_follow_up_date || null,
        updated_at: now,
      };
    }));
    return { data: activity, error: null };
  }
  const { data, error } = await supabase
    .from("meridian_imported_land_lead_activities")
    .insert(row)
    .select()
    .single();
  return { data: data as ImportedLandLeadActivity | null, error: error?.message ?? null };
}

export async function fetchImportedLandLeadActivities(leadId?: string, limit = 80): Promise<ImportedLandLeadActivity[]> {
  if (!supabase) {
    return localGet<ImportedLandLeadActivity[]>(LOCAL_ACTIVITIES, [])
      .filter(row => !leadId || row.lead_id === leadId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  let query = supabase
    .from("meridian_imported_land_lead_activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (leadId) query = query.eq("lead_id", leadId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as ImportedLandLeadActivity[];
}

function statusLabel(value: string): string {
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function leadToDealDraft(lead: ImportedLandLead): Partial<DealInput> & { linksText?: string } {
  const title = lead.property_address || lead.parcel_id || `${lead.owner_name || "Imported"} land lead`;
  const location = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
  return {
    title,
    source: lead.source_system,
    property_type: "land",
    strategy: "land resale",
    status: "lead",
    urgency: "routine",
    address: location || lead.property_address || "",
    parcel_id: lead.parcel_id || "",
    seller_name: lead.owner_name || "",
    seller_phone: lead.phone || lead.phone_2 || "",
    asking_price: lead.asking_price,
    arv: lead.market_value || lead.assessed_value,
    acreage: lead.acreage,
    zoning: lead.zoning || "",
    notes: [
      lead.notes,
      lead.county ? `County: ${lead.county}` : "",
      lead.land_use ? `Land use: ${lead.land_use}` : "",
      lead.mailing_address ? `Owner mailing address: ${lead.mailing_address}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      lead.phone_2 ? `Alt phone: ${lead.phone_2}` : "",
      noteLine(lead.raw_data as Record<string, string>, "Property tax", ["property tax", "tax amount", "annual tax"]),
      noteLine(lead.raw_data as Record<string, string>, "Wetlands", ["wetlands", "wetland"]),
      noteLine(lead.raw_data as Record<string, string>, "Flood", ["flood", "flood zone", "floodplain"]),
      noteLine(lead.raw_data as Record<string, string>, "Road frontage", ["road frontage ft", "road frontage"]),
      noteLine(lead.raw_data as Record<string, string>, "Land locked", ["land locked", "tag land locked"]),
      noteLine(lead.raw_data as Record<string, string>, "School district", ["school district", "district"]),
      noteLine(lead.raw_data as Record<string, string>, "Google map", ["google maps", "map", "maps"]),
      noteLine(lead.raw_data as Record<string, string>, "Earth link", ["earth", "google earth"]),
    ].filter(Boolean).join("\n"),
    campaign_source: lead.campaign_source || "",
    linksText: lead.property_url || "",
  };
}
