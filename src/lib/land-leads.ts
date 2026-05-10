import { supabase } from "./supabase";
import type { DealInput } from "./deals";

export interface LandLeadBatch {
  id: string;
  source_system: string;
  original_filename: string | null;
  campaign_source: string | null;
  row_count: number;
  uploaded_by: string | null;
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
}

const LOCAL_BATCHES = "meridian_land_lead_batches_local";
const LOCAL_LEADS = "meridian_imported_land_leads_local";

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
  if (rows.length < 2) return [];
  const headers = rows[0].map(header => header.trim());
  return rows.slice(1).map(values => headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header || `Column ${index + 1}`] = values[index]?.trim() ?? "";
    return acc;
  }, {}));
}

function normalizeLead(row: Record<string, string>, sourceSystem: string, campaignSource: string | null, actor: string, batchId: string | null): Omit<ImportedLandLead, "id" | "created_at" | "updated_at"> {
  const propertyAddress = pick(row, ["property address", "site address", "situs address", "address", "location", "property"]);
  const city = pick(row, ["city", "property city", "situs city"]);
  const state = pick(row, ["state", "property state", "situs state"]);
  const zip = pick(row, ["zip", "zipcode", "postal code", "property zip"]);
  const county = pick(row, ["county", "property county"]);
  const parcel = pick(row, ["parcel id", "parcel", "apn", "tax id", "tax parcel", "pin"]);
  const owner = pick(row, ["owner", "owner name", "seller", "seller name", "name"]);
  const phone = pick(row, ["phone", "phone 1", "primary phone", "seller phone", "mobile", "cell"]);
  const phone2 = pick(row, ["phone 2", "secondary phone", "alternate phone", "alt phone"]);
  const value = parseNumber(pick(row, ["market value", "estimated value", "value", "land value", "total value"]));
  return {
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
    mailing_address: pick(row, ["mailing address", "owner mailing address", "mail address"]),
    acreage: parseNumber(pick(row, ["acreage", "acres", "lot size acres", "land acres"])),
    asking_price: parseNumber(pick(row, ["asking price", "ask", "list price", "price"])),
    assessed_value: parseNumber(pick(row, ["assessed value", "tax assessed value", "assessment"])),
    market_value: value,
    zoning: pick(row, ["zoning", "zone", "zoning code"]),
    land_use: pick(row, ["land use", "property use", "use code", "property type"]),
    property_url: pick(row, ["url", "link", "property url", "listing url", "map link"]),
    status: "new",
    deal_id: null,
    notes: pick(row, ["notes", "remarks", "comments"]),
    raw_data: row,
    uploaded_by: actor,
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

  if (!supabase) {
    const batch: LandLeadBatch = { ...batchSeed, id: `lead-batch-${Date.now()}`, created_at: now };
    const leads = rows.map((row, index): ImportedLandLead => ({
      ...normalizeLead(row, batch.source_system, batch.campaign_source, args.actor, batch.id),
      id: `${batch.id}-${index}`,
      created_at: now,
      updated_at: now,
    }));
    localSet(LOCAL_BATCHES, [batch, ...localGet<LandLeadBatch[]>(LOCAL_BATCHES, [])]);
    localSet(LOCAL_LEADS, [...leads, ...localGet<ImportedLandLead[]>(LOCAL_LEADS, [])]);
    return { batch, leads, error: null };
  }

  const { data: batchData, error: batchError } = await supabase
    .from("meridian_land_lead_import_batches")
    .insert(batchSeed)
    .select()
    .single();
  if (batchError || !batchData) return { batch: null, leads: [], error: batchError?.message ?? "Could not create import batch." };

  const batch = batchData as LandLeadBatch;
  const inserts = rows.map(row => normalizeLead(row, batch.source_system, batch.campaign_source, args.actor, batch.id));
  const { data, error } = await supabase
    .from("meridian_imported_land_leads")
    .insert(inserts)
    .select();
  if (error || !data) return { batch, leads: [], error: error?.message ?? "Could not import lead rows." };
  return { batch, leads: data as ImportedLandLead[], error: null };
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
    ].filter(Boolean).join("\n"),
    campaign_source: lead.campaign_source || "",
    linksText: lead.property_url || "",
  };
}

