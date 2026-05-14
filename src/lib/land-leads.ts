import { supabase } from "./supabase";
import type { DealInput } from "./deals";
import { buildSourceFieldValues, type SourceFieldCategory, type SourceFieldType } from "./land-insights-fields";
import { calculateLandUnderwriting, type LandExitType, type LandUnderwritingStatus } from "./land-underwriting";

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
  phone_3?: string | null;
  phone_4?: string | null;
  phone_5?: string | null;
  phone_6?: string | null;
  phone_1_type?: string | null;
  phone_2_type?: string | null;
  phone_3_type?: string | null;
  phone_4_type?: string | null;
  phone_5_type?: string | null;
  phone_6_type?: string | null;
  email: string | null;
  property_address: string | null;
  parcel_id: string | null;
  calculated_acreage?: number | null;
  parcel_sq_ft?: number | null;
  fips?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  legal_description?: string | null;
  parcel_alt_apn?: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  mailing_address: string | null;
  mail_address?: string | null;
  mail_city?: string | null;
  mail_state?: string | null;
  mail_zip?: string | null;
  mail_county?: string | null;
  acreage: number | null;
  asking_price: number | null;
  assessed_value: number | null;
  market_value: number | null;
  structure_sq_ft?: number | null;
  structure_count?: number | null;
  structure_year_built?: number | null;
  structure_stories?: number | null;
  structure_units?: number | null;
  structure_rooms?: number | null;
  owner_first_names?: string | null;
  owner_1_full_name?: string | null;
  owner_1_first_name?: string | null;
  owner_1_middle_name?: string | null;
  owner_1_last_name?: string | null;
  owner_1_suffix?: string | null;
  owner_2_full_name?: string | null;
  owner_2_first_name?: string | null;
  owner_2_middle_name?: string | null;
  owner_2_last_name?: string | null;
  owner_2_suffix?: string | null;
  improvement_value?: number | null;
  improvement_percentage?: number | null;
  land_value?: number | null;
  total_parcel_value?: number | null;
  market_land_value?: number | null;
  market_improvement_value?: number | null;
  tax_year?: number | null;
  tax_delinquent_starting_year?: number | null;
  last_sale_date?: string | null;
  last_sale_price?: number | null;
  previous_owners?: string | null;
  previous_owner_1?: string | null;
  previous_owner_2?: string | null;
  deed_book?: string | null;
  deed_page?: string | null;
  deed_type?: string | null;
  zoning: string | null;
  subdivision?: string | null;
  lot?: string | null;
  block?: string | null;
  land_use: string | null;
  owner_type?: string | null;
  owner_occupied?: boolean | null;
  do_not_mail?: boolean | null;
  in_hoa?: boolean | null;
  family_transfer?: boolean | null;
  google_map_url?: string | null;
  google_earth_url?: string | null;
  property_tax?: number | null;
  taxed_delinquent_since?: string | null;
  owner_out_of_state?: boolean | null;
  owner_out_of_county?: boolean | null;
  owner_out_of_zip?: boolean | null;
  mortgage_amount?: number | null;
  mortgage_length?: number | null;
  mortgage_lender?: string | null;
  mortgage_type?: string | null;
  mortgage_loan_type?: string | null;
  mortgage_interest?: number | null;
  school_district?: string | null;
  parcel_link?: string | null;
  comping_link?: string | null;
  min_elevation?: number | null;
  max_elevation?: number | null;
  avg_elevation?: number | null;
  min_slope?: number | null;
  max_slope?: number | null;
  avg_slope?: number | null;
  slope_0_0_5_pct?: number | null;
  slope_0_5_2_5_pct?: number | null;
  slope_2_5_5_pct?: number | null;
  slope_5_7_5_pct?: number | null;
  slope_7_5_10_pct?: number | null;
  slope_10_15_pct?: number | null;
  slope_15_20_pct?: number | null;
  slope_20_25_pct?: number | null;
  slope_25_30_pct?: number | null;
  slope_30_40_pct?: number | null;
  slope_40_50_pct?: number | null;
  slope_over_50_pct?: number | null;
  property_url: string | null;
  road_frontage_ft?: number | null;
  is_land_locked?: boolean | null;
  flood_zone_percent?: number | null;
  flood_zone_type?: string | null;
  wetlands_percent?: number | null;
  topography?: string | null;
  bad_topography?: boolean | null;
  tax_delinquent?: boolean | null;
  tax_delinquent_years?: number | null;
  mineral_rights_status?: string | null;
  hoa_status?: string | null;
  min_lot_size_acres?: number | null;
  market_value_estimate_ppa?: number | null;
  market_value_estimate_comp_count?: number | null;
  market_value_estimate_confidence?: string | null;
  market_value_estimate_gini_index?: number | null;
  tag_odd_shape?: boolean | null;
  tag_structure?: boolean | null;
  tag_farmland?: boolean | null;
  tag_subdivide?: boolean | null;
  tag_entitlement?: boolean | null;
  seller_iq?: string | null;
  dnc?: boolean | null;
  state_dnc?: boolean | null;
  litigator?: boolean | null;
  age?: number | null;
  gender?: string | null;
  ethnic_group?: string | null;
  religion?: string | null;
  education_level?: string | null;
  occupation?: string | null;
  language?: string | null;
  marital_status?: string | null;
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
  sourceColumnCount: number;
  sourceColumnsMapped: number;
  calculatorReadyColumnCount: number;
  usableLeads: number;
  safeToImport: number;
  missingPhone: number;
  missingOwner: number;
  exactDuplicates: number;
  possibleDuplicates: number;
  alreadyConverted: number;
  skippedDuplicates: number;
  propertyRows: number;
  uniqueLeadCount: number;
  textableLeadCount: number;
  multiPropertyLeadCount: number;
  averageScore: number;
  detectedFields: LandLeadDetectedField[];
  groupedLeadSamples: LandLeadGroupPreview[];
  sampleLeads: Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>;
  duplicateKeys: string[];
  duplicateMatches: LeadDuplicateMatch[];
  csvText: string;
  error: string | null;
}

export interface LandLeadDetectedField {
  label: string;
  mappedFrom: string | null;
  status: "mapped" | "missing";
}

export interface LandLeadGroupPreview {
  leadLabel: string;
  phone: string | null;
  propertyCount: number;
  counties: string[];
  sampleProperties: string[];
}

export interface LeadDuplicateMatch {
  confidence: "exact" | "possible" | "already-converted";
  incomingLabel: string;
  existingLabel: string;
  duplicateOf: string | null;
  existingStatus: ImportedLandLead["status"] | null;
  existingDealId: string | null;
  reasons: string[];
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

export interface ImportedLandLeadFieldValue {
  id: string;
  lead_id: string;
  source_header: string;
  field_key: string;
  category: SourceFieldCategory;
  data_type: SourceFieldType;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
  searchable: boolean;
  filterable: boolean;
  calculator_ready: boolean;
  source_order: number;
  created_at: string;
}

export interface LandUnderwritingResultRow {
  id: string;
  lead_id: string;
  exit_type: LandExitType;
  label: string;
  status: LandUnderwritingStatus;
  max_offer: number | null;
  required_ppa: number | null;
  required_resale_value: number | null;
  projected_spread: number | null;
  land_insights_ppa: number | null;
  land_insights_value: number | null;
  key_assumption: string | null;
  blocker: string | null;
  next_step: string | null;
  rank: number;
  assumptions: Record<string, unknown>;
  input_snapshot: Record<string, unknown>;
  calculated_at: string;
  created_at: string;
}

const LOCAL_BATCHES = "meridian_land_lead_batches_local";
const LOCAL_LEADS = "meridian_imported_land_leads_local";
const LOCAL_FIELD_VALUES = "meridian_imported_land_lead_field_values_local";
const LOCAL_UNDERWRITING_RESULTS = "meridian_land_underwriting_results_local";
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

function pickKey(row: Record<string, string>, aliases: string[]): string | null {
  const normalized = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = normalized[normalizeHeader(alias)];
    if (key && clean(row[key])) return key;
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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeParcel(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function leadIdentityKey(lead: Pick<ImportedLandLead, "phone" | "phone_2" | "owner_name" | "mailing_address" | "county">): string {
  const phone = normalizePhone(lead.phone) || normalizePhone(lead.phone_2);
  if (phone.length >= 7) return `phone:${phone}`;
  const owner = normalizeText(lead.owner_name);
  const mailing = normalizeText(lead.mailing_address);
  if (owner && mailing) return `owner-mail:${owner}|${mailing}`;
  const county = normalizeText(lead.county);
  if (owner && county) return `owner-county:${owner}|${county}`;
  return `row:${owner || mailing || Math.random().toString(36).slice(2)}`;
}

function summarizeLeadGroups(leads: Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>): LandLeadGroupPreview[] {
  const groups = new Map<string, Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>>();
  leads.forEach(lead => {
    const key = leadIdentityKey(lead);
    groups.set(key, [...(groups.get(key) ?? []), lead]);
  });
  return Array.from(groups.values())
    .map(group => {
      const first = group[0];
      return {
        leadLabel: first.owner_name || first.phone || first.phone_2 || "Owner unknown",
        phone: first.phone || first.phone_2 || null,
        propertyCount: group.length,
        counties: Array.from(new Set(group.map(lead => lead.county).filter((value): value is string => !!value))).slice(0, 3),
        sampleProperties: group
          .map(lead => lead.property_address || lead.parcel_id || "Unlabeled property")
          .slice(0, 3),
      };
    })
    .sort((a, b) => b.propertyCount - a.propertyCount || a.leadLabel.localeCompare(b.leadLabel));
}

const DETECTED_FIELD_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: "Owner", aliases: ["owner", "owner name", "owner names", "owner name(s)", "seller", "seller name", "name", "full name"] },
  { label: "Primary phone", aliases: ["phone", "phone 1", "primary phone", "seller phone", "mobile", "cell"] },
  { label: "Additional phones", aliases: ["phone 2", "phone 3", "phone 4", "phone 5", "phone 6"] },
  { label: "Phone types", aliases: ["phone 1 type", "phone 2 type", "phone 3 type", "phone 4 type", "phone 5 type", "phone 6 type"] },
  { label: "Property address", aliases: ["property address", "parcel address", "site address", "situs address", "address", "location", "property"] },
  { label: "APN / parcel", aliases: ["parcel id", "parcel", "apn", "tax id", "tax parcel", "pin"] },
  { label: "Owner details", aliases: ["owner first name(s)", "owner 1 full name", "owner 2 full name"] },
  { label: "Mailing address parts", aliases: ["mail address", "mail city", "mail state", "mail zip", "mail county"] },
  { label: "Location coordinates", aliases: ["latitude", "longitude"] },
  { label: "County", aliases: ["county", "property county"] },
  { label: "Acreage", aliases: ["acreage", "calculated acreage", "calculated a", "acres", "lot size acres", "land acres"] },
  { label: "Legal / deed", aliases: ["legal description", "deed book", "deed page", "deed type"] },
  { label: "Sale history", aliases: ["last sale date", "last sale price", "previous owner(s)"] },
  { label: "Tax details", aliases: ["tax year", "property tax", "taxed delinquent since", "tax delinquent starting year"] },
  { label: "Owner flags", aliases: ["owner occupied", "owner out of state", "owner out of county", "owner out of zip", "do not mail"] },
  { label: "Mortgage", aliases: ["mortgage amount", "mortgage lender", "mortgage type", "mortgage interest"] },
  { label: "Structure", aliases: ["structure sq ft", "structure count", "structure year built"] },
  { label: "Elevation / slope", aliases: ["min elevation", "max elevation", "avg elevation", "min slope", "max slope", "avg slope"] },
  { label: "Road frontage", aliases: ["road frontage ft", "road frontage"] },
  { label: "Land locked", aliases: ["land locked", "tag land locked"] },
  { label: "Flood zone", aliases: ["flood zone percent", "flood zone type", "flood zone", "flood"] },
  { label: "Wetlands", aliases: ["wetlands percent", "wetlands", "tag wetlands"] },
  { label: "Topography", aliases: ["topography", "slope", "tag bad topography", "bad topography"] },
  { label: "Tax delinquent", aliases: ["tax delinquent", "delinquent taxes", "years delinquent", "tax delinquent years"] },
  { label: "HOA", aliases: ["hoa", "hoa flag", "poa"] },
  { label: "Mineral rights", aliases: ["mineral rights", "minerals"] },
  { label: "Min lot size", aliases: ["min lot size", "minimum lot size"] },
  { label: "Links", aliases: ["google map", "google earth", "parcel link", "comping link"] },
  { label: "Value estimate details", aliases: ["market value estimate ppa", "market value estimate comp count", "market value estimate confidence", "market value estimate gini index"] },
  { label: "Land Insights tags", aliases: ["tag:odd shape", "tag:structure", "tag:farmland", "tag:subdivide", "tag:entitlement"] },
  { label: "SMS suppression", aliases: ["dnc", "state dnc", "litigator"] },
  { label: "Source demographics", aliases: ["age", "gender", "ethnic group", "religion", "education level", "occupation", "language", "marital status"] },
];

function detectMappedFields(row: Record<string, string> | undefined): LandLeadDetectedField[] {
  if (!row) return DETECTED_FIELD_ALIASES.map(field => ({ label: field.label, mappedFrom: null, status: "missing" as const }));
  return DETECTED_FIELD_ALIASES.map(field => {
    const mappedFrom = pickKey(row, field.aliases);
    return { label: field.label, mappedFrom, status: mappedFrom ? "mapped" : "missing" };
  });
}

function normalizeUrl(value: string | null | undefined): string {
  try {
    const url = new URL(value ?? "");
    url.hash = "";
    url.search = "";
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/g, "");
  } catch {
    return normalizeText(value);
  }
}

function leadLabel(lead: Pick<ImportedLandLead, "owner_name" | "property_address" | "parcel_id" | "phone" | "phone_2">): string {
  return lead.property_address || lead.parcel_id || lead.owner_name || lead.phone || lead.phone_2 || "Unknown lead";
}

function duplicateReasons(
  a: Pick<ImportedLandLead, "parcel_id" | "property_address" | "phone" | "phone_2" | "owner_name" | "mailing_address" | "county" | "acreage" | "property_url">,
  b: Pick<ImportedLandLead, "parcel_id" | "property_address" | "phone" | "phone_2" | "owner_name" | "mailing_address" | "county" | "acreage" | "property_url">,
): string[] {
  const reasons: string[] = [];
  const parcelA = normalizeParcel(a.parcel_id);
  const parcelB = normalizeParcel(b.parcel_id);
  const addressA = normalizeText(a.property_address);
  const addressB = normalizeText(b.property_address);
  const urlA = normalizeUrl(a.property_url);
  const urlB = normalizeUrl(b.property_url);
  const ownerA = normalizeText(a.owner_name);
  const ownerB = normalizeText(b.owner_name);
  const mailingA = normalizeText(a.mailing_address);
  const mailingB = normalizeText(b.mailing_address);
  const countyA = normalizeText(a.county);
  const countyB = normalizeText(b.county);
  const phones = [normalizePhone(a.phone), normalizePhone(a.phone_2)].filter(phone => phone.length >= 7);
  const otherPhones = [normalizePhone(b.phone), normalizePhone(b.phone_2)].filter(phone => phone.length >= 7);
  const acreageMatch = typeof a.acreage === "number"
    && typeof b.acreage === "number"
    && Math.abs(a.acreage - b.acreage) <= 0.02;

  if (parcelA && parcelA === parcelB) reasons.push("same parcel/APN");
  if (addressA && addressA === addressB) reasons.push("same property address");
  if (urlA && urlA === urlB) reasons.push("same property link");
  if (phones.some(phone => otherPhones.includes(phone))) reasons.push("same phone");
  if (ownerA && ownerA === ownerB && countyA && countyA === countyB) reasons.push("same owner and county");
  if (ownerA && ownerA === ownerB && mailingA && mailingA === mailingB) reasons.push("same owner mailing address");
  if (ownerA && ownerA === ownerB && countyA && countyA === countyB && acreageMatch) reasons.push("same owner, county, and acreage");

  return reasons;
}

function matchConfidence(reasons: string[], matched: ImportedLandLead): LeadDuplicateMatch["confidence"] | null {
  if (!reasons.length) return null;
  if (matched.status === "converted" || !!matched.deal_id) return "already-converted";
  if (reasons.some(reason => ["same parcel/APN", "same property address", "same property link"].includes(reason))) return "exact";
  if (reasons.includes("same phone") && reasons.some(reason => reason.includes("owner") || reason.includes("county"))) return "exact";
  return "possible";
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
  const parcelLink = pick(row, ["parcel link"]);
  const googleMap = pick(row, ["google map", "google maps", "map"]);
  const googleEarth = pick(row, ["google earth", "earth"]);
  const base = {
    batch_id: batchId,
    source_system: sourceSystem,
    campaign_source: campaignSource,
    owner_name: owner,
    phone,
    phone_2: phone2,
    phone_3: pick(row, ["phone 3"]),
    phone_4: pick(row, ["phone 4"]),
    phone_5: pick(row, ["phone 5"]),
    phone_6: pick(row, ["phone 6"]),
    phone_1_type: pick(row, ["phone 1 type"]),
    phone_2_type: pick(row, ["phone 2 type"]),
    phone_3_type: pick(row, ["phone 3 type"]),
    phone_4_type: pick(row, ["phone 4 type"]),
    phone_5_type: pick(row, ["phone 5 type"]),
    phone_6_type: pick(row, ["phone 6 type"]),
    email: pick(row, ["email", "seller email", "owner email"]),
    property_address: propertyAddress,
    parcel_id: parcel,
    calculated_acreage: parseNumber(pick(row, ["calculated acreage", "calculated a"])),
    parcel_sq_ft: parseNumber(pick(row, ["parcel sq ft", "parcel square feet"])),
    fips: pick(row, ["fips"]),
    latitude: parseNumber(pick(row, ["latitude", "lat"])),
    longitude: parseNumber(pick(row, ["longitude", "lng", "lon"])),
    legal_description: pick(row, ["legal description"]),
    parcel_alt_apn: pick(row, ["parcel alt apn", "alternate apn", "alt apn"]),
    county,
    city,
    state,
    zip,
    mailing_address: pick(row, ["mail full address", "mailing address", "owner mailing address", "mail address", "mail", "mailing"]),
    mail_address: pick(row, ["mail address"]),
    mail_city: pick(row, ["mail city"]),
    mail_state: pick(row, ["mail state"]),
    mail_zip: pick(row, ["mail zip", "mail zipcode"]),
    mail_county: pick(row, ["mail county"]),
    acreage: parseNumber(pick(row, ["acreage", "calculated acreage", "calculated a", "acres", "lot size acres", "land acres"])),
    asking_price: parseNumber(pick(row, ["asking price", "ask", "list price", "seller price"])),
    assessed_value: parseNumber(pick(row, ["assessed value", "tax assessed value", "assessment", "improvement value"])),
    market_value: value,
    structure_sq_ft: parseNumber(pick(row, ["structure sq ft"])),
    structure_count: parseNumber(pick(row, ["structure count"])),
    structure_year_built: parseNumber(pick(row, ["structure year built"])),
    structure_stories: parseNumber(pick(row, ["structure number of stories"])),
    structure_units: parseNumber(pick(row, ["structure number of units"])),
    structure_rooms: parseNumber(pick(row, ["structure number of rooms"])),
    owner_first_names: pick(row, ["owner first name(s)", "owner first names"]),
    owner_1_full_name: pick(row, ["owner 1 full name"]),
    owner_1_first_name: pick(row, ["owner 1 first name"]),
    owner_1_middle_name: pick(row, ["owner 1 middle name"]),
    owner_1_last_name: pick(row, ["owner 1 last name"]),
    owner_1_suffix: pick(row, ["owner 1 suffix"]),
    owner_2_full_name: pick(row, ["owner 2 full name"]),
    owner_2_first_name: pick(row, ["owner 2 first name"]),
    owner_2_middle_name: pick(row, ["owner 2 middle name"]),
    owner_2_last_name: pick(row, ["owner 2 last name"]),
    owner_2_suffix: pick(row, ["owner 2 suffix"]),
    improvement_value: parseNumber(pick(row, ["improvement value"])),
    improvement_percentage: parseNumber(pick(row, ["improvement percentage"])),
    land_value: parseNumber(pick(row, ["land value"])),
    total_parcel_value: parseNumber(pick(row, ["total parcel value"])),
    market_land_value: parseNumber(pick(row, ["market land value"])),
    market_improvement_value: parseNumber(pick(row, ["market improvement value"])),
    tax_year: parseNumber(pick(row, ["tax year"])),
    tax_delinquent_starting_year: parseNumber(pick(row, ["tax delinquent starting year"])),
    last_sale_date: pick(row, ["last sale date"]),
    last_sale_price: parseNumber(pick(row, ["last sale price"])),
    previous_owners: pick(row, ["previous owner(s)", "previous owners"]),
    previous_owner_1: pick(row, ["previous owner 1"]),
    previous_owner_2: pick(row, ["previous owner 2"]),
    deed_book: pick(row, ["deed book"]),
    deed_page: pick(row, ["deed page"]),
    deed_type: pick(row, ["deed type"]),
    zoning: pick(row, ["zoning", "zone", "zoning code"]),
    subdivision: pick(row, ["subdivision"]),
    lot: pick(row, ["lot"]),
    block: pick(row, ["block"]),
    land_use: pick(row, ["land use description", "land use", "property use", "use code", "property type"]),
    owner_type: pick(row, ["owner type"]),
    owner_occupied: boolish(pick(row, ["owner occupied"])),
    do_not_mail: boolish(pick(row, ["do not mail"])),
    in_hoa: boolish(pick(row, ["in hoa", "hoa", "hoa flag"])),
    family_transfer: boolish(pick(row, ["family transfer"])),
    google_map_url: googleMap,
    google_earth_url: googleEarth,
    property_tax: parseNumber(pick(row, ["property tax", "tax amount", "annual tax"])),
    taxed_delinquent_since: pick(row, ["taxed delinquent since"]),
    owner_out_of_state: boolish(pick(row, ["owner out of state"])),
    owner_out_of_county: boolish(pick(row, ["owner out of county"])),
    owner_out_of_zip: boolish(pick(row, ["owner out of zip"])),
    mortgage_amount: parseNumber(pick(row, ["mortgage amount"])),
    mortgage_length: parseNumber(pick(row, ["mortgage length"])),
    mortgage_lender: pick(row, ["mortgage lender"]),
    mortgage_type: pick(row, ["mortgage type"]),
    mortgage_loan_type: pick(row, ["mortgage loan type"]),
    mortgage_interest: parseNumber(pick(row, ["mortgage interest"])),
    school_district: pick(row, ["school district", "district"]),
    parcel_link: parcelLink,
    comping_link: pick(row, ["comping link"]),
    min_elevation: parseNumber(pick(row, ["min elevation"])),
    max_elevation: parseNumber(pick(row, ["max elevation"])),
    avg_elevation: parseNumber(pick(row, ["avg elevation"])),
    min_slope: parseNumber(pick(row, ["min slope"])),
    max_slope: parseNumber(pick(row, ["max slope"])),
    avg_slope: parseNumber(pick(row, ["avg slope"])),
    slope_0_0_5_pct: parseNumber(pick(row, ["slope 0-0.5%"])),
    slope_0_5_2_5_pct: parseNumber(pick(row, ["slope 0.5-2.5%"])),
    slope_2_5_5_pct: parseNumber(pick(row, ["slope 2.5-5%"])),
    slope_5_7_5_pct: parseNumber(pick(row, ["slope 5-7.5%"])),
    slope_7_5_10_pct: parseNumber(pick(row, ["slope 7.5-10%"])),
    slope_10_15_pct: parseNumber(pick(row, ["slope 10-15%"])),
    slope_15_20_pct: parseNumber(pick(row, ["slope 15-20%"])),
    slope_20_25_pct: parseNumber(pick(row, ["slope 20-25%"])),
    slope_25_30_pct: parseNumber(pick(row, ["slope 25-30%"])),
    slope_30_40_pct: parseNumber(pick(row, ["slope 30-40%"])),
    slope_40_50_pct: parseNumber(pick(row, ["slope 40-50%"])),
    slope_over_50_pct: parseNumber(pick(row, ["slope >50%"])),
    property_url: pick(row, ["url", "link", "property url", "listing url", "land insights url", "data link", "parcel link", "map link", "google maps", "earth"]) || parcelLink || googleMap || googleEarth,
    road_frontage_ft: parseNumber(pick(row, ["road frontage ft", "road frontage"])),
    is_land_locked: boolish(pick(row, ["land locked", "tag land locked"])),
    flood_zone_percent: parseNumber(pick(row, ["flood zone percent", "flood zone", "flood"])),
    flood_zone_type: pick(row, ["flood zone type", "flood zone"]),
    wetlands_percent: parseNumber(pick(row, ["wetlands percent", "wetlands", "tag wetlands"])),
    topography: pick(row, ["topography", "slope"]),
    bad_topography: boolish(pick(row, ["tag bad topography", "bad topography"])),
    tax_delinquent: boolish(pick(row, ["tax delinquent", "delinquent taxes"])),
    tax_delinquent_years: parseNumber(pick(row, ["years delinquent", "tax delinquent years"])),
    mineral_rights_status: pick(row, ["mineral rights", "minerals"]),
    hoa_status: pick(row, ["in hoa", "hoa", "hoa flag", "poa"]),
    min_lot_size_acres: parseNumber(pick(row, ["min lot size", "minimum lot size"])),
    market_value_estimate_ppa: parseNumber(pick(row, ["market value estimate ppa"])),
    market_value_estimate_comp_count: parseNumber(pick(row, ["market value estimate comp count"])),
    market_value_estimate_confidence: pick(row, ["market value estimate confidence"]),
    market_value_estimate_gini_index: parseNumber(pick(row, ["market value estimate gini index"])),
    tag_odd_shape: boolish(pick(row, ["tag:odd shape", "tag odd shape"])),
    tag_structure: boolish(pick(row, ["tag:structure", "tag structure"])),
    tag_farmland: boolish(pick(row, ["tag:farmland", "tag farmland"])),
    tag_subdivide: boolish(pick(row, ["tag:subdivide", "tag subdivide"])),
    tag_entitlement: boolish(pick(row, ["tag:entitlement", "tag entitlement"])),
    seller_iq: pick(row, ["selleriq", "seller iq"]),
    dnc: boolish(pick(row, ["dnc"])),
    state_dnc: boolish(pick(row, ["state dnc"])),
    litigator: boolish(pick(row, ["litigator"])),
    age: parseNumber(pick(row, ["age"])),
    gender: pick(row, ["gender"]),
    ethnic_group: pick(row, ["ethnic group"]),
    religion: pick(row, ["religion"]),
    education_level: pick(row, ["education level"]),
    occupation: pick(row, ["occupation"]),
    language: pick(row, ["language"]),
    marital_status: pick(row, ["marital status"]),
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

function findDuplicateMatch(
  lead: Omit<ImportedLandLead, "id" | "created_at" | "updated_at">,
  existing: ImportedLandLead[],
): { lead: ImportedLandLead | null; confidence: LeadDuplicateMatch["confidence"] | null; reasons: string[] } {
  let best: { lead: ImportedLandLead | null; confidence: LeadDuplicateMatch["confidence"] | null; reasons: string[]; score: number } = { lead: null, confidence: null, reasons: [], score: 0 };
  existing.forEach(row => {
    const reasons = duplicateReasons(lead, row);
    const confidence = matchConfidence(reasons, row);
    const score = reasons.length + (confidence === "exact" ? 10 : confidence === "already-converted" ? 20 : 0);
    if (confidence && score > best.score) best = { lead: row, confidence, reasons, score };
  });
  return { lead: best.lead, confidence: best.confidence, reasons: best.reasons };
}

function applyDuplicateMetadata<T extends Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>(leads: T[], existing: ImportedLandLead[]): T[] {
  const seen = new Map<string, { id: string | null; converted: boolean; label: string }>();
  existing.forEach(lead => {
    const key = duplicateKey(lead);
    if (key) seen.set(key, { id: lead.id, converted: lead.status === "converted" || !!lead.deal_id, label: leadLabel(lead) });
  });
  return leads.map(lead => {
    const exact = seen.get(duplicateKey(lead));
    const duplicate = exact ? null : findDuplicateMatch(lead, existing);
    const fuzzy = duplicate?.lead ?? null;
    const converted = exact?.converted || duplicate?.confidence === "already-converted";
    const duplicate_of = exact?.id || fuzzy?.id || null;
    const duplicate_status = duplicate_of ? (converted ? "already-converted" : "possible-duplicate") : "new";
    const next = { ...lead, duplicate_status, duplicate_of } as T;
    const key = duplicateKey(next);
    if (key && !seen.has(key)) seen.set(key, { id: null, converted: false, label: leadLabel(next) });
    return next;
  });
}

function buildDuplicateMatches(leads: Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>, existing: ImportedLandLead[]): LeadDuplicateMatch[] {
  return leads.flatMap(lead => {
    if (lead.duplicate_status === "new") return [];
    const matched = lead.duplicate_of
      ? existing.find(row => row.id === lead.duplicate_of) ?? null
      : findDuplicateMatch(lead, existing).lead;
    if (!matched) return [];
    const reasons = duplicateReasons(lead, matched);
    const confidence = lead.duplicate_status === "already-converted"
      ? "already-converted"
      : matchConfidence(reasons, matched) ?? "possible";
    return [{
      confidence,
      incomingLabel: leadLabel(lead),
      existingLabel: leadLabel(matched),
      duplicateOf: matched.id,
      existingStatus: matched.status,
      existingDealId: matched.deal_id,
      reasons: reasons.length ? reasons : ["matches an existing import fingerprint"],
    }];
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
): Promise<{ count: number; rows: ImportedLandLead[]; error: { message?: string; code?: string } | null }> {
  if (!supabase) return { count: 0, rows: [], error: null };
  let count = 0;
  const rows: ImportedLandLead[] = [];
  const chunkSize = 100;
  for (let index = 0; index < leads.length; index += chunkSize) {
    const chunk = leads.slice(index, index + chunkSize);
    const payload = useLegacyShape ? chunk.map(legacyLeadInsert) : chunk;
    const { data, error } = await supabase
      .from("meridian_imported_land_leads")
      .insert(payload)
      .select("*");
    if (error) return { count, rows, error };
    rows.push(...((data ?? []) as ImportedLandLead[]));
    count += chunk.length;
  }
  return { count, rows, error: null };
}

function fieldRowsForLead(leadId: string, rawData: Record<string, unknown>) {
  return buildSourceFieldValues(rawData).map(field => ({
    lead_id: leadId,
    source_header: field.source_header,
    field_key: field.field_key,
    category: field.category,
    data_type: field.data_type,
    value_text: field.value_text,
    value_number: field.value_number,
    value_boolean: field.value_boolean,
    value_date: field.value_date,
    value_json: field.value_json,
    searchable: field.searchable,
    filterable: field.filterable,
    calculator_ready: field.calculator_ready,
    source_order: field.source_order,
  }));
}

async function insertFieldValueRowsInChunks(
  insertedRows: ImportedLandLead[],
  sourceLeads: Array<Omit<ImportedLandLead, "id" | "created_at" | "updated_at">>,
): Promise<{ count: number; error: { message?: string; code?: string } | null }> {
  const payload = insertedRows.flatMap((row, index) =>
    fieldRowsForLead(row.id, sourceLeads[index]?.raw_data ?? row.raw_data ?? {}),
  );
  if (!payload.length) return { count: 0, error: null };
  if (!supabase) {
    const now = new Date().toISOString();
    const localRows = payload.map((row, index): ImportedLandLeadFieldValue => ({
      ...row,
      id: `field-${Date.now()}-${index}`,
      category: row.category as SourceFieldCategory,
      data_type: row.data_type as SourceFieldType,
      created_at: now,
    }));
    localSet(LOCAL_FIELD_VALUES, [...localRows, ...localGet<ImportedLandLeadFieldValue[]>(LOCAL_FIELD_VALUES, [])]);
    return { count: localRows.length, error: null };
  }
  let count = 0;
  const chunkSize = 500;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { error } = await supabase
      .from("meridian_imported_land_lead_field_values")
      .upsert(chunk, { onConflict: "lead_id,field_key,source_order" });
    if (error) return { count, error };
    count += chunk.length;
  }
  return { count, error: null };
}

function underwritingRowsForLead(lead: ImportedLandLead) {
  const summary = calculateLandUnderwriting(lead);
  return summary.results.map(item => ({
    lead_id: lead.id,
    exit_type: item.exitType,
    label: item.label,
    status: item.status,
    max_offer: item.maxOffer,
    required_ppa: item.requiredPpa,
    required_resale_value: item.requiredResaleValue,
    projected_spread: item.projectedSpread,
    land_insights_ppa: item.landInsightsPpa,
    land_insights_value: item.landInsightsValue,
    key_assumption: item.keyAssumption,
    blocker: item.blocker,
    next_step: item.nextStep,
    rank: item.rank,
    assumptions: summary.assumptions as unknown as Record<string, unknown>,
    input_snapshot: summary.inputSnapshot,
    calculated_at: new Date().toISOString(),
  }));
}

export async function upsertLandUnderwritingForLeads(leads: ImportedLandLead[]): Promise<{ count: number; error: string | null }> {
  const payload = leads.flatMap(underwritingRowsForLead);
  if (!payload.length) return { count: 0, error: null };
  if (!supabase) {
    const now = new Date().toISOString();
    const rows = payload.map((row, index): LandUnderwritingResultRow => ({
      ...row,
      id: `underwriting-${Date.now()}-${index}`,
      exit_type: row.exit_type as LandExitType,
      status: row.status as LandUnderwritingStatus,
      created_at: now,
    }));
    const existing = localGet<LandUnderwritingResultRow[]>(LOCAL_UNDERWRITING_RESULTS, []);
    const keys = new Set(rows.map(row => `${row.lead_id}|${row.exit_type}`));
    localSet(LOCAL_UNDERWRITING_RESULTS, [...rows, ...existing.filter(row => !keys.has(`${row.lead_id}|${row.exit_type}`))]);
    return { count: rows.length, error: null };
  }
  let count = 0;
  const chunkSize = 300;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { error } = await supabase
      .from("meridian_land_underwriting_results")
      .upsert(chunk, { onConflict: "lead_id,exit_type" });
    if (error) return { count, error: error.message };
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
    return { filename: args.filename, rowsFound: 0, sourceColumnCount: 0, sourceColumnsMapped: 0, calculatorReadyColumnCount: 0, usableLeads: 0, safeToImport: 0, missingPhone: 0, missingOwner: 0, exactDuplicates: 0, possibleDuplicates: 0, alreadyConverted: 0, skippedDuplicates: 0, propertyRows: 0, uniqueLeadCount: 0, textableLeadCount: 0, multiPropertyLeadCount: 0, averageScore: 0, detectedFields: detectMappedFields(undefined), groupedLeadSamples: [], sampleLeads: [], duplicateKeys: [], duplicateMatches: [], csvText: args.csvText, error: "No lead rows found. Upload a CSV with a header row." };
  }
  const sourceFields = buildSourceFieldValues(rows[0] ?? {});
  const existing = await fetchImportedLandLeads(5000);
  const normalized = applyDuplicateMetadata(rows.map(row => normalizeLead(row, args.sourceSystem, args.campaignSource?.trim() || null, args.actor, null)), existing);
  const usable = normalized.filter(lead => lead.owner_name || lead.phone || lead.phone_2 || lead.parcel_id || lead.property_address);
  const groupedLeadSamples = summarizeLeadGroups(usable);
  const scores = usable.map(lead => lead.lead_score ?? 0);
  const duplicateMatches = buildDuplicateMatches(usable, existing);
  const exactDuplicates = duplicateMatches.filter(match => match.confidence === "exact").length;
  const possibleDuplicates = usable.filter(lead => lead.duplicate_status === "possible-duplicate").length;
  const alreadyConverted = usable.filter(lead => lead.duplicate_status === "already-converted").length;
  const skippedDuplicates = possibleDuplicates + alreadyConverted;
  return {
    filename: args.filename,
    rowsFound: rows.length,
    sourceColumnCount: sourceFields.length,
    sourceColumnsMapped: sourceFields.length,
    calculatorReadyColumnCount: sourceFields.filter(field => field.calculator_ready).length,
    usableLeads: usable.length,
    safeToImport: usable.filter(lead => lead.duplicate_status === "new").length,
    missingPhone: usable.filter(lead => !lead.phone && !lead.phone_2).length,
    missingOwner: usable.filter(lead => !lead.owner_name).length,
    exactDuplicates,
    possibleDuplicates,
    alreadyConverted,
    skippedDuplicates,
    propertyRows: usable.length,
    uniqueLeadCount: groupedLeadSamples.length,
    textableLeadCount: groupedLeadSamples.filter(group => !!group.phone).length,
    multiPropertyLeadCount: groupedLeadSamples.filter(group => group.propertyCount > 1).length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    detectedFields: detectMappedFields(rows[0]),
    groupedLeadSamples: groupedLeadSamples.slice(0, 8),
    sampleLeads: usable.slice(0, 5),
    duplicateKeys: usable.filter(lead => lead.duplicate_status !== "new").slice(0, 10).map(duplicateKey),
    duplicateMatches: duplicateMatches.slice(0, 12),
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
    const safeInserts = normalized.filter(lead => lead.duplicate_status === "new");
    const leads = safeInserts.map((lead, index): ImportedLandLead => ({
      ...lead,
      id: `${batch.id}-${index}`,
      created_at: now,
      updated_at: now,
    }));
    localSet(LOCAL_BATCHES, [batch, ...localGet<LandLeadBatch[]>(LOCAL_BATCHES, [])]);
    localSet(LOCAL_LEADS, [...leads, ...existing]);
    await insertFieldValueRowsInChunks(leads, safeInserts);
    await upsertLandUnderwritingForLeads(leads);
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
  const normalized = applyDuplicateMetadata(rows.map(row => normalizeLead(row, batch.source_system, batch.campaign_source, args.actor, batch.id)), existing);
  const inserts = normalized.filter(lead => lead.duplicate_status === "new");
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
  const savedLeads = enhanced.rows.length ? enhanced.rows : inserts.slice(0, enhanced.count).map((lead, index) => ({
    ...lead,
    id: `${batch.id}-imported-${index}`,
    created_at: now,
    updated_at: now,
  })) as ImportedLandLead[];
  const fieldValues = await insertFieldValueRowsInChunks(savedLeads, inserts);
  const underwriting = await upsertLandUnderwritingForLeads(savedLeads);
  const extraWarnings = [
    fieldValues.error
      ? isSchemaMismatch(fieldValues.error)
        ? "Run migration 042 to enable full source-field mapping for imported Land Insights columns."
        : `Source-field mapping warning: ${fieldValues.error.message ?? "Could not save mapped field values."}`
      : null,
    underwriting.error
      ? underwriting.error.toLowerCase().includes("column") || underwriting.error.toLowerCase().includes("schema")
        ? "Run migration 043 to enable automatic land underwriting results."
        : `Underwriting warning: ${underwriting.error}`
      : null,
  ].filter(Boolean);
  return {
    batch,
    leads: savedLeads,
    error: null,
    warning: [warning, ...extraWarnings].filter(Boolean).join(" ") || null,
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

export async function fetchImportedLandLeadFieldValues(leadId: string): Promise<ImportedLandLeadFieldValue[]> {
  if (!supabase) {
    return localGet<ImportedLandLeadFieldValue[]>(LOCAL_FIELD_VALUES, [])
      .filter(row => row.lead_id === leadId)
      .sort((a, b) => a.source_order - b.source_order);
  }
  const { data, error } = await supabase
    .from("meridian_imported_land_lead_field_values")
    .select("*")
    .eq("lead_id", leadId)
    .order("source_order");
  if (error || !data) return [];
  return data as ImportedLandLeadFieldValue[];
}

export async function fetchLandUnderwritingResults(leadIds: string | string[]): Promise<LandUnderwritingResultRow[]> {
  const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
  if (!ids.length) return [];
  if (!supabase) {
    return localGet<LandUnderwritingResultRow[]>(LOCAL_UNDERWRITING_RESULTS, [])
      .filter(row => ids.includes(row.lead_id))
      .sort((a, b) => b.rank - a.rank);
  }
  const { data, error } = await supabase
    .from("meridian_land_underwriting_results")
    .select("*")
    .in("lead_id", ids)
    .order("rank", { ascending: false });
  if (error || !data) return [];
  return data as LandUnderwritingResultRow[];
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
