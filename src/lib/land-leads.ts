import { supabase } from "./supabase";
import type { DealInput, DealPropertyType } from "./deals";
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

export type ImportedLandLeadIdentityFields = {
  id?: string | null;
  phone?: string | null;
  phone_2?: string | null;
  owner_name?: string | null;
  mailing_address?: string | null;
  mail_address?: string | null;
  county?: string | null;
  state?: string | null;
  parcel_id?: string | null;
  property_address?: string | null;
};

type ImportedLandLeadMetricsRow = Pick<ImportedLandLead, "status"> & ImportedLandLeadIdentityFields;

export interface ImportedLandLeadListMetrics {
  properties: number;
  contacts: number;
}

export interface LeadImportResult {
  batch: LandLeadBatch | null;
  leads: ImportedLandLead[];
  error: string | null;
  warning?: string | null;
}

type ListingDetails = Record<string, string | number | null>;
export type ManualResearchLeadPatch = Partial<Pick<ImportedLandLead,
  "parcel_id"
  | "property_address"
  | "county"
  | "city"
  | "state"
  | "zip"
  | "latitude"
  | "longitude"
  | "acreage"
  | "calculated_acreage"
  | "owner_name"
  | "mailing_address"
  | "zoning"
  | "land_use"
  | "subdivision"
  | "hoa_status"
  | "asking_price"
  | "assessed_value"
  | "market_value"
  | "property_tax"
  | "tax_delinquent"
  | "tax_delinquent_years"
  | "road_frontage_ft"
  | "is_land_locked"
  | "flood_zone_percent"
  | "flood_zone_type"
  | "wetlands_percent"
  | "min_lot_size_acres"
  | "parcel_link"
  | "comping_link"
  | "notes"
>>;

export interface ManualResearchLeadUpdateInput {
  actor: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  patch: ManualResearchLeadPatch;
}

export interface SingleLinkLandLeadInput {
  sourceUrl: string;
  sourceSystem?: string;
  campaignSource?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  propertyAddress?: string | null;
  parcelId?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  acreage?: number | null;
  askingPrice?: number | null;
  marketValue?: number | null;
  assessedValue?: number | null;
  propertyTax?: number | null;
  zoning?: string | null;
  landUse?: string | null;
  subdivision?: string | null;
  hoaStatus?: string | null;
  listingStatus?: string | null;
  listingDate?: string | null;
  water?: string | null;
  sewer?: string | null;
  utilities?: string | null;
  sourceMls?: string | null;
  listingDescription?: string | null;
  listingDetails?: ListingDetails | null;
  listingText?: string | null;
  notes?: string | null;
  actor: string;
}

export interface ListingUrlHints {
  propertyAddress?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  parcelId?: string | null;
  acreage?: number | null;
  askingPrice?: number | null;
  marketValue?: number | null;
  assessedValue?: number | null;
  propertyTax?: number | null;
  zoning?: string | null;
  landUse?: string | null;
  subdivision?: string | null;
  hoaStatus?: string | null;
  listingStatus?: string | null;
  listingDate?: string | null;
  water?: string | null;
  sewer?: string | null;
  utilities?: string | null;
  sourceMls?: string | null;
  listingDescription?: string | null;
  dealPropertyType?: DealPropertyType | null;
  listingDetails?: ListingDetails;
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

export type LandDueDiligenceCategory = "access" | "flood" | "wetlands" | "zoning" | "tax" | "gis" | "comps" | "ownership" | "utilities" | "notes";
export type LandDueDiligenceStatus = "todo" | "in-progress" | "verified" | "blocked" | "not-applicable";
export type LandCompType = "sold" | "active" | "pending" | "expired" | "manual-note";
export type LandCompConfidence = "high" | "medium" | "low" | "needs-review";
export type LandCompRelationshipStatus = "potential" | "accepted" | "rejected";

export interface CountyResearchSource {
  county: string;
  state: string;
  category: LandDueDiligenceCategory;
  source_name: string;
  source_url: string;
  instructions: string;
}

export interface LandDueDiligenceItem {
  id: string;
  lead_id: string;
  category: LandDueDiligenceCategory;
  title: string;
  status: LandDueDiligenceStatus;
  result_summary: string | null;
  source_name: string | null;
  source_url: string | null;
  evidence_value: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LandCompRecord {
  id: string;
  lead_id: string;
  link_id?: string | null;
  comp_property_id?: string | null;
  comp_key?: string | null;
  comp_type: LandCompType;
  address: string | null;
  parcel_id: string | null;
  county: string | null;
  city?: string | null;
  state: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price: number | null;
  acreage: number | null;
  price_per_acre: number | null;
  sale_or_list_date: string | null;
  distance_miles: number | null;
  similarity_score?: number | null;
  relationship_status?: LandCompRelationshipStatus | null;
  match_reason?: string | null;
  source_system: string | null;
  source_url: string | null;
  listing_text?: string | null;
  listing_details?: ListingDetails | null;
  raw_data?: Record<string, unknown> | null;
  similarity_notes: string | null;
  adjustment_notes: string | null;
  include_in_valuation: boolean;
  confidence: LandCompConfidence;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandCompInput {
  leadId: string;
  compPropertyId?: string | null;
  compType: LandCompType;
  address?: string | null;
  parcelId?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  acreage?: number | null;
  saleOrListDate?: string | null;
  distanceMiles?: number | null;
  similarityScore?: number | null;
  relationshipStatus?: LandCompRelationshipStatus | null;
  matchReason?: string | null;
  sourceSystem?: string | null;
  sourceUrl?: string | null;
  listingText?: string | null;
  listingDetails?: ListingDetails | null;
  rawData?: Record<string, unknown> | null;
  similarityNotes?: string | null;
  adjustmentNotes?: string | null;
  includeInValuation?: boolean;
  confidence?: LandCompConfidence;
  actor?: string | null;
}

export interface LandCompProperty {
  id: string;
  comp_key: string;
  comp_type: LandCompType;
  address: string | null;
  parcel_id: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  acreage: number | null;
  price_per_acre: number | null;
  sale_or_list_date: string | null;
  source_system: string | null;
  source_url: string | null;
  listing_text: string | null;
  listing_details: ListingDetails;
  raw_data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandCompLink {
  id: string;
  lead_id: string;
  comp_property_id: string;
  relationship_status: LandCompRelationshipStatus;
  distance_miles: number | null;
  similarity_score: number | null;
  match_reason: string | null;
  similarity_notes: string | null;
  adjustment_notes: string | null;
  include_in_valuation: boolean;
  confidence: LandCompConfidence;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomatedLandResearchFinding {
  category: LandDueDiligenceCategory;
  title: string;
  status: LandDueDiligenceStatus;
  result_summary: string;
  evidence_value: string | null;
  source_name: string;
  source_url: string;
  confidence: LandCompConfidence;
  blocker?: string | null;
}

export interface AutomatedLandParcelMatch {
  sourceName: string;
  sourceUrl: string;
  parcelId: string | null;
  address: string | null;
  owner: string | null;
  acreage: number | null;
  zoning: string | null;
  landUse: string | null;
  assessedValue: number | null;
  propertyTax: number | null;
  mailingAddress: string | null;
  addressMatchesSubject: boolean | null;
  raw: Record<string, unknown>;
}

export interface AutomatedLandResearchResult {
  ok: boolean;
  location: {
    latitude: number | null;
    longitude: number | null;
    matched_address: string | null;
    county: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    geocoder: string;
  };
  parcel_match: AutomatedLandParcelMatch | null;
  findings: AutomatedLandResearchFinding[];
  source_links: Array<{
    category: LandDueDiligenceCategory;
    source_name: string;
    source_url: string;
  }>;
  warnings: string[];
  checked_at: string;
  error?: string;
}

const LOCAL_BATCHES = "meridian_land_lead_batches_local";
const LOCAL_LEADS = "meridian_imported_land_leads_local";
const LOCAL_FIELD_VALUES = "meridian_imported_land_lead_field_values_local";
const LOCAL_UNDERWRITING_RESULTS = "meridian_land_underwriting_results_local";
const LOCAL_ACTIVITIES = "meridian_imported_land_lead_activities_local";
const LOCAL_DUE_DILIGENCE = "meridian_land_due_diligence_items_local";
const LOCAL_COMPS = "meridian_land_comp_records_local";
const LOCAL_COMP_PROPERTIES = "meridian_land_comp_properties_local";
const LOCAL_COMP_LINKS = "meridian_land_comp_links_local";

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

function normalizeIdentityText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeImportedLeadContactPhone(value: string | null | undefined): string | null {
  if (String(value || "").toLowerCase().startsWith("client:")) return null;
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value?.startsWith("+") ? value : null;
}

export function hasImportedLeadOwnerIdentity(ownerName: string | null | undefined): boolean {
  const owner = normalizeIdentityText(ownerName);
  return !!owner && !["unknown", "owner unknown", "unknown owner", "unknown contact", "no owner", "n/a", "na", "none", "-", "--"].includes(owner);
}

export function importedLeadContactIdentityKey(lead: ImportedLandLeadIdentityFields): string {
  const phone = normalizeImportedLeadContactPhone(lead.phone || lead.phone_2);
  if (phone) return `phone:${phone}`;

  const owner = normalizeIdentityText(lead.owner_name);
  if (hasImportedLeadOwnerIdentity(owner)) {
    const mailing = normalizeIdentityText(lead.mailing_address || lead.mail_address);
    const location = normalizeIdentityText(lead.county || lead.state);
    return `owner:${owner}|${mailing || location}`;
  }

  const property = normalizeIdentityText(lead.id || lead.parcel_id || lead.property_address || "");
  return `property:${property || "unidentified"}`;
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

export function inferLandLeadSourceFromUrl(value: string): string {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes("zillow")) return "Zillow";
    if (host.includes("realtor")) return "Realtor";
    if (host.includes("land.com") || host.includes("landwatch") || host.includes("landandfarm")) return "Land.com";
    if (host.includes("crexi")) return "Crexi";
    if (host.includes("loopnet")) return "LoopNet";
    if (host.includes("qpublic") || host.includes("gis") || host.includes("county")) return "County GIS";
    if (host.includes("google")) return "Google Maps";
  } catch {
    return "Manual Link";
  }
  return "Manual Link";
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
    tax_year: parseNumber(pick(row, ["tax year", "listing tax year"])),
    tax_delinquent_starting_year: parseNumber(pick(row, ["tax delinquent starting year"])),
    last_sale_date: pick(row, ["last sale date", "listing last sale date"]),
    last_sale_price: parseNumber(pick(row, ["last sale price", "listing last sale price"])),
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
    in_hoa: boolish(pick(row, ["in hoa", "hoa", "hoa flag", "has hoa"])),
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
    flood_zone_type: pick(row, ["flood zone type", "flood zone", "listing flood zone"]),
    wetlands_percent: parseNumber(pick(row, ["wetlands percent", "wetlands", "tag wetlands"])),
    topography: pick(row, ["topography", "slope", "lot features", "listing lot features"]),
    bad_topography: boolish(pick(row, ["tag bad topography", "bad topography"])),
    tax_delinquent: boolish(pick(row, ["tax delinquent", "delinquent taxes"])),
    tax_delinquent_years: parseNumber(pick(row, ["years delinquent", "tax delinquent years"])),
    mineral_rights_status: pick(row, ["mineral rights", "minerals"]),
    hoa_status: pick(row, ["in hoa", "hoa", "hoa flag", "has hoa", "listing hoa fee", "listing hoa monthly display", "poa"]),
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

function singleLinkRawData(input: SingleLinkLandLeadInput): Record<string, string> {
  const listingDetails = Object.entries(input.listingDetails || {}).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value !== null && value !== undefined && String(value).trim()) acc[`Listing ${key}`] = String(value);
    return acc;
  }, {});
  const listingFloodZone = clean(input.listingDetails?.["Flood Zone"]);
  const listingTopography = topographyFromListingDetails(input.listingDetails);
  const latestSold = latestSoldPriceHistory(input.listingDetails);
  const latestTax = latestPublicTaxHistory(input.listingDetails);
  const dealPropertyType = clean(input.listingDetails?.["Deal Property Type"]);
  return {
    "Source URL": input.sourceUrl.trim(),
    "Listing URL": input.sourceUrl.trim(),
    "Source Type": input.sourceSystem || inferLandLeadSourceFromUrl(input.sourceUrl),
    "Property Address": input.propertyAddress?.trim() || "",
    "Parcel ID": input.parcelId?.trim() || "",
    "Owner Name": input.ownerName?.trim() || "",
    "Phone": input.phone?.trim() || "",
    "Email": input.email?.trim() || "",
    "County": input.county?.trim() || "",
    "City": input.city?.trim() || "",
    "State": input.state?.trim() || "",
    "Zip": input.zip?.trim() || "",
    "Deal Property Type": dealPropertyType || "",
    "Acreage": input.acreage === null || input.acreage === undefined ? "" : String(input.acreage),
    "Asking Price": input.askingPrice === null || input.askingPrice === undefined ? "" : String(input.askingPrice),
    "Market Value Estimate": input.marketValue === null || input.marketValue === undefined ? "" : String(input.marketValue),
    "Tax Assessed Value": input.assessedValue === null || input.assessedValue === undefined ? "" : String(input.assessedValue),
    "Property Tax": input.propertyTax === null || input.propertyTax === undefined ? "" : String(input.propertyTax),
    "Flood Zone Type": listingFloodZone || "",
    "Topography": listingTopography || "",
    "Last Sale Date": latestSold?.date || "",
    "Last Sale Price": latestSold?.price || "",
    "Tax Year": latestTax?.year || "",
    "Zoning": input.zoning?.trim() || "",
    "Land Use": input.landUse?.trim() || "",
    "Subdivision": input.subdivision?.trim() || "",
    "HOA": input.hoaStatus?.trim() || "",
    "Listing Status": input.listingStatus?.trim() || "",
    "Date On Market": input.listingDate?.trim() || "",
    "Water": input.water?.trim() || "",
    "Sewer": input.sewer?.trim() || "",
    "Utilities": input.utilities?.trim() || "",
    "Source MLS": input.sourceMls?.trim() || "",
    "Listing Description": input.listingDescription?.trim() || "",
    "Listing Text": input.listingText?.trim() || "",
    ...listingDetails,
    "Notes": input.notes?.trim() || "",
    "Intake Method": "Single Link Intake",
  };
}

function titleCaseAddressPart(value: string): string {
  const keepUpper = new Set(["NE", "NW", "SE", "SW", "N", "S", "E", "W", "GA", "RD", "DR", "ST", "CT", "LN", "CIR", "AVE", "HWY", "PKWY"]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => {
      const upper = part.toUpperCase();
      if (keepUpper.has(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseListingMoneyValue(value: string): number | null {
  if (value.includes("--")) return null;
  const money = value.match(/\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?/)?.[0] || value;
  const cleaned = money.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  const multiplier = /m$/i.test(cleaned) ? 1000000 : /k$/i.test(cleaned) ? 1000 : 1;
  const numeric = Number(cleaned.replace(/[mk]$/i, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
}

function parseListingAddressLine(line: string): ListingUrlHints {
  const full = line.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (full) {
    return {
      propertyAddress: titleCaseAddressPart(full[1]),
      city: titleCaseAddressPart(full[2]),
      state: full[3].toUpperCase(),
      zip: full[4].slice(0, 5),
    };
  }
  return { propertyAddress: titleCaseAddressPart(line) };
}

function normalizeListingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function listingSummaryNotes(hints: ListingUrlHints): string | null {
  const details = hints.listingDetails || {};
  const lines = [
    hints.listingStatus ? `Listing status: ${hints.listingStatus}` : "",
    hints.listingDate ? `Date on market: ${hints.listingDate}` : "",
    hints.landUse ? `Property type: ${hints.landUse}` : "",
    hints.subdivision ? `Subdivision: ${hints.subdivision}` : "",
    hints.hoaStatus ? `HOA: ${hints.hoaStatus}` : "",
    details["HOA Fee"] ? `HOA fee: ${details["HOA Fee"]}` : "",
    details["Waterfront"] ? `Waterfront: ${details["Waterfront"]}` : "",
    details["Waterfront Features"] ? `Waterfront features: ${details["Waterfront Features"]}` : "",
    details["Waterfront Frontage"] ? `Waterfront frontage: ${details["Waterfront Frontage"]}` : "",
    details["Body Of Water"] ? `Body of water: ${details["Body Of Water"]}` : "",
    details["Lot Features"] ? `Lot features: ${details["Lot Features"]}` : "",
    details["Special Conditions"] ? `Special conditions: ${details["Special Conditions"]}` : "",
    details["Listing Terms"] ? `Listing terms: ${details["Listing Terms"]}` : "",
    details["Flood Zone"] ? `Flood zone: ${details["Flood Zone"]}` : "",
    details["Buildability Note"] ? `Buildability: ${details["Buildability Note"]}` : "",
    details["Days On Zillow"] ? `Days on Zillow: ${details["Days On Zillow"]}` : "",
    details["Views"] ? `Zillow views: ${details["Views"]}` : "",
    details["Saves"] ? `Zillow saves: ${details["Saves"]}` : "",
    details["Listing Agent"] ? `Listing agent: ${details["Listing Agent"]}${details["Listing Agent Phone"] ? ` ${details["Listing Agent Phone"]}` : ""}` : "",
    details["Listing Brokerage"] ? `Listing brokerage: ${details["Listing Brokerage"]}` : "",
    hints.water ? `Water: ${hints.water}` : "",
    hints.sewer ? `Sewer: ${hints.sewer}` : "",
    hints.utilities ? `Utilities: ${hints.utilities}` : "",
    hints.sourceMls ? `MLS source: ${hints.sourceMls}` : "",
    hints.listingDescription ? `Listing description: ${hints.listingDescription}` : "",
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

export function listingUrlHints(sourceUrl: string): ListingUrlHints {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean).map(part => decodeURIComponent(part));
    const homeDetailsIndex = parts.findIndex(part => part.toLowerCase() === "homedetails");
    const slug = homeDetailsIndex >= 0 ? parts[homeDetailsIndex + 1] : null;
    if (!slug) return {};
    const cleanedSlug = slug
      .replace(/_\d+_zpid$/i, "")
      .replace(/_zpid$/i, "")
      .replace(/\.(html?)$/i, "");
    const tokens = cleanedSlug.split("-").filter(Boolean);
    const zip = tokens.at(-1);
    const state = tokens.at(-2);
    if (!zip || !/^\d{5}$/.test(zip) || !state || !/^[A-Za-z]{2}$/.test(state)) return {};
    const cityToken = tokens.at(-3);
    const streetTokens = tokens.slice(0, -3);
    return {
      propertyAddress: streetTokens.length ? titleCaseAddressPart(streetTokens.join(" ")) : null,
      city: cityToken ? titleCaseAddressPart(cityToken) : null,
      state: state.toUpperCase(),
      zip,
    };
  } catch {
    return {};
  }
}

function moneyText(value: string | null | undefined): string | null {
  const text = clean(value);
  return text && /^\$/.test(text) && !text.includes("--") ? text : null;
}

function lineAfter(lines: string[], pattern: RegExp): string | null {
  const index = lines.findIndex(line => pattern.test(line));
  if (index < 0) return null;
  return clean(lines[index + 1]);
}

function valueBeforeLine(lines: string[], label: RegExp): string | null {
  const index = lines.findIndex(line => label.test(line));
  if (index <= 0) return null;
  return clean(lines[index - 1]);
}

function colonValue(lines: string[], label: string): string | null {
  const prefix = `${label}:`.toLowerCase();
  const line = lines.find(row => row.toLowerCase().startsWith(prefix));
  return clean(line ? line.slice(label.length + 1) : null);
}

function sectionLines(lines: string[], start: RegExp, end: RegExp[]): string[] {
  const startIndex = lines.findIndex(line => start.test(line));
  if (startIndex < 0) return [];
  const relativeEnd = lines.slice(startIndex + 1).findIndex(line => end.some(pattern => pattern.test(line)));
  const endIndex = relativeEnd >= 0 ? startIndex + 1 + relativeEnd : lines.length;
  return lines.slice(startIndex + 1, endIndex);
}

function parseListingSource(value: string | null): { source: string | null; mls: string | null } {
  const text = value?.replace(/MLS Logo.*$/i, "").trim() || "";
  if (!text) return { source: null, mls: null };
  const mls = text.match(/MLS#:\s*([A-Za-z0-9-]+)/i)?.[1] || null;
  return { source: text.replace(/,\s*MLS#:.*/i, "").trim() || text, mls };
}

function parsedListingJsonRows(value: string | number | null | undefined): Array<Record<string, string>> {
  const text = clean(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is Record<string, string> =>
      !!row && typeof row === "object" && !Array.isArray(row),
    );
  } catch {
    return [];
  }
}

function latestSoldPriceHistory(details: ListingDetails | null | undefined): { date: string; price: string } | null {
  const rows = parsedListingJsonRows(details?.["Price History"]);
  const sold = rows.find(row => /sold/i.test(row.event || "") && moneyText(row.price));
  return sold?.date && sold.price ? { date: sold.date, price: sold.price } : null;
}

function latestPublicTaxHistory(details: ListingDetails | null | undefined): { year: string; propertyTaxes: string; taxAssessment: string } | null {
  const rows = parsedListingJsonRows(details?.["Public Tax History"]);
  const latest = rows.find(row => row.year || row.propertyTaxes || row.taxAssessment);
  return latest
    ? {
      year: latest.year || "",
      propertyTaxes: latest.propertyTaxes || "",
      taxAssessment: latest.taxAssessment || "",
    }
    : null;
}

function topographyFromListingDetails(details: ListingDetails | null | undefined): string | null {
  const lotFeatures = clean(details?.["Lot Features"]);
  if (!lotFeatures) return null;
  const topoTerms = lotFeatures
    .split(",")
    .map(part => part.trim())
    .filter(part => /slope|sloped|steep|level|rolling|hilly|wooded|corner/i.test(part));
  return topoTerms.length ? topoTerms.join(", ") : null;
}

function parseListingAgent(mainLines: string[]): { name: string | null; phone: string | null; brokerage: string | null } {
  const listedByIndex = mainLines.findIndex(line => /^(Listed by:|Listing Provided by:)$/i.test(line));
  if (listedByIndex < 0) return { name: null, phone: null, brokerage: null };
  const agentLine = clean(mainLines[listedByIndex + 1]?.replace(/,$/, ""));
  const brokerageLine = clean(mainLines[listedByIndex + 2]?.replace(/,$/, ""));
  const phone = agentLine?.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)?.[1]
    || brokerageLine?.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)?.[1]
    || null;
  const name = clean(phone ? agentLine?.replace(phone, "").replace(/[, ]+$/, "") : agentLine);
  const brokerage = clean(phone ? brokerageLine?.replace(phone, "").replace(/[, .]+$/, "") : brokerageLine);
  return { name, phone, brokerage };
}

function parseScore(lines: string[], label: RegExp): { score: string | null; description: string | null } {
  const index = lines.findIndex(line => label.test(line));
  if (index < 0) return { score: null, description: null };
  return {
    score: clean(lines[index + 1]),
    description: clean(lines[index + 2]),
  };
}

function parseSchoolLines(lines: string[]): string | null {
  const startIndex = lines.findIndex(line => /^Nearby schools$/i.test(line));
  if (startIndex < 0) return null;
  const endIndex = lines.slice(startIndex + 1).findIndex(line => /^(Show more|Skip carousel|Nearby homes)$/i.test(line));
  const rows = lines.slice(startIndex + 1, endIndex >= 0 ? startIndex + 1 + endIndex : Math.min(lines.length, startIndex + 35));
  return rows.join(" | ").slice(0, 1500) || null;
}

function parsePriceHistory(lines: string[]): string | null {
  const rows = sectionLines(lines, /^Price history$/i, [/^Public tax history$/i, /^Monthly payment$/i, /^BuyAbility/i, /^Payment breakdown$/i, /^Climate risks$/i]);
  const entries: Array<Record<string, string>> = [];
  for (let index = 0; index < rows.length; index += 1) {
    let date = rows[index];
    let event = rows[index + 1] || "";
    let window = rows.slice(index + 2, index + 8);
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
      const tabbed = rows[index].split(/\t+/).map(part => part.trim()).filter(Boolean);
      if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(tabbed[0] || "")) continue;
      date = tabbed[0];
      event = tabbed[1] || event;
      window = [...tabbed.slice(2), ...rows.slice(index + 1, index + 7)];
    }
    const price = window.map(row => moneyText(row)).find(Boolean) || "";
    const change = window.find(row => /^[-+]?[\d.]+%$/.test(row)) || "";
    const pricePerSqft = window.find(row => /^\$[\d,.-]+\/sqft$/i.test(row)) || "";
    const source = clean(window.find(row => /^Source:/i.test(row))?.replace(/^Source:\s*/i, "")) || "";
    entries.push({ date, event, price, change, pricePerSqft, source });
  }
  return entries.length ? JSON.stringify(entries.slice(0, 30)) : null;
}

function parsePublicTaxHistory(lines: string[]): string | null {
  const rows = sectionLines(lines, /^Public tax history$/i, [/^Monthly payment$/i, /^BuyAbility/i, /^Payment breakdown$/i, /^Climate risks$/i, /^Neighborhood:/i]);
  if (rows.some(line => /^Tax history is unavailable\.$/i.test(line))) return "Unavailable";
  const entries: Array<Record<string, string>> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const tabbed = rows[index].split(/\t+/).map(part => part.trim()).filter(Boolean);
    if (/^\d{4}$/.test(tabbed[0] || "") && tabbed.length >= 3) {
      entries.push({ year: tabbed[0], propertyTaxes: tabbed[1], taxAssessment: tabbed.slice(2).join(" ") });
      continue;
    }
    if (!/^\d{4}$/.test(rows[index])) continue;
    const propertyTaxes = rows[index + 1] || "";
    const taxAssessment = rows[index + 2] || "";
    entries.push({ year: rows[index], propertyTaxes, taxAssessment });
  }
  return entries.length ? JSON.stringify(entries.slice(0, 20)) : null;
}

function parseListingCards(lines: string[], start: RegExp, end: RegExp[]): string | null {
  const rows = sectionLines(lines, start, end);
  const cards: Array<Record<string, string>> = [];
  const fullAddressPattern = /^\d{1,6}\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i;
  for (let index = 0; index < rows.length; index += 1) {
    const price = rows[index].match(/\$\s?[\d,]+(?:\.\d+)?\+?/)?.[0] || moneyText(rows[index]) || (rows[index] === "$--" ? "$--" : null);
    if (!price) continue;
    const window = rows.slice(index + 1, index + 16);
    const address = window.find(line => fullAddressPattern.test(line)) || "";
    if (!address) continue;
    const summary = clean(rows[index].replace(price, "")) || window.find(line => /\bacres?\b|\bSquare Feet\b|\bsqft\b|\bbd\b|\bba\b/i.test(line)) || "";
    const status = clean(summary.match(/\b(Active|Lot \/ Land for sale|Lot\/Land|For Sale|For Sale By Owner|Off Market|Sold|Auction|Pending|New Construction)\b/i)?.[1])
      || window.find(line => /^(Active|Lot \/ Land for sale|Lot\/Land|For Sale|For Sale By Owner|Off Market|Sold|Auction|Pending|New Construction)$/i.test(line))
      || "";
    const source = window.find(line =>
      !fullAddressPattern.test(line)
      && !/^More$/i.test(line)
      && !/^(Previous photo|Next photo|Save)$/i.test(line)
      && /MLS ID|GAMLS|FMLS|Hive MLS|REALT|REALTY|PROPERTIES|GROUP|COMMUNITIES|BROKER|ESTATE|KELLER|EXP|COLDWELL|NORMAN|HESTER|RIGHT PATH/i.test(line),
    ) || "";
    const noteIndex = window.findIndex(line => /^More$/i.test(line));
    const note = noteIndex >= 0 ? clean(window[noteIndex + 1]) || "" : "";
    cards.push({ price, summary, address, status, source, note });
  }
  return cards.length ? JSON.stringify(cards.slice(0, 30)) : null;
}

function parseAvailableHomes(lines: string[]): string | null {
  const rows = sectionLines(lines, /^Available homes$/i, [/^Source:/i, /^Contact builder$/i, /^Price history$/i]);
  const homes: Array<Record<string, string>> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const listing = clean(rows[index]);
    const price = clean(rows[index + 1]);
    const bedBath = clean(rows[index + 2]);
    const status = clean(rows[index + 3]);
    if (!listing || !price || !/^\$/.test(price)) continue;
    homes.push({ listing, price, bedBath: bedBath || "", status: status || "" });
    index += 3;
  }
  return homes.length ? JSON.stringify(homes.slice(0, 40)) : null;
}

function parsePlanCards(lines: string[], start: RegExp, end: RegExp[]): string | null {
  const rows = sectionLines(lines, start, end);
  const plans: Array<Record<string, string>> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const price = rows[index]?.match(/^from\s+\$[\d,]+/i)?.[0] || moneyText(rows[index]);
    if (!price) continue;
    const window = rows.slice(index + 1, index + 10);
    const summary = window.find(line => /\bbd\b|\bba\b|\bsqft\b/i.test(line)) || "";
    const name = window.find(line => /\bplan\b/i.test(line) && !/\bbd\b|\bba\b|\bsqft\b/i.test(line)) || "";
    const status = window.find(line => /New Construction|Active|Available|Pending/i.test(line)) || "";
    const builder = window.find(line => !/^New Construction$/i.test(line) && /Homes|Communities|Residential|Builders|Group/i.test(line)) || "";
    plans.push({ price, summary, name, status, builder });
  }
  return plans.length ? JSON.stringify(plans.slice(0, 40)) : null;
}

function parsePaymentBreakdown(lines: string[]): string | null {
  const rows = sectionLines(lines, /^(Monthly payment|Payment breakdown)$/i, [/^Climate risks$/i, /^Neighborhood:/i, /^Street View$/i]);
  if (!rows.length) return null;
  const labels = [
    "Estimated monthly payment",
    "Principal & interest",
    "Mortgage insurance",
    "Property taxes",
    "Home insurance",
    "HOA fees",
    "Utilities",
  ];
  const labelSet = new Set(labels.map(label => label.toLowerCase()));
  const values = labels.reduce<Record<string, string>>((acc, label) => {
    const index = rows.findIndex(line => line.toLowerCase() === label.toLowerCase());
    if (index < 0) return acc;
    const value = clean(rows[index + 1]);
    if (value && !labelSet.has(value.toLowerCase())) acc[label] = value;
    return acc;
  }, {});
  return Object.keys(values).length ? JSON.stringify(values) : null;
}

function parseFooterValueRows(lines: string[], start: RegExp, end: RegExp[]): string | null {
  const rows = sectionLines(lines, start, end);
  const values: Array<Record<string, string>> = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (!/Homes for Sale$/i.test(rows[index])) continue;
    const value = clean(rows[index + 1]);
    if (!value || !/^[$-]/.test(value)) continue;
    values.push({ area: rows[index].replace(/\s+Homes for Sale$/i, ""), value });
  }
  return values.length ? JSON.stringify(values.slice(0, 60)) : null;
}

function parseListingLabelValues(lines: string[]): string | null {
  const pairs = lines.flatMap(line => {
    const match = line.match(/^([^:]{2,90}):\s*(.+)$/);
    if (!match) return [];
    return [{ label: match[1].trim(), value: match[2].trim() }];
  });
  return pairs.length ? JSON.stringify(pairs.slice(0, 120)) : null;
}

function parseTextListBetween(lines: string[], start: RegExp, end: RegExp[], maxChars = 1500): string | null {
  const text = clean(sectionLines(lines, start, end).join(" ").slice(0, maxChars));
  return text || null;
}

function parseListingSectionSnapshot(lines: string[]): string | null {
  const heading = /^(Facts & features|Interior|Bedrooms & bathrooms|Rooms|Primary bedroom|Bedroom|Primary bathroom|Dining room|Kitchen|Heating|Cooling|Appliances|Features|Interior area|Video & virtual tour|Property|Parking|Accessibility|Lot|Details|Construction|Type & style|Materials|Condition|Utilities & green energy|Community & HOA|Community|HOA|Location|Financial & listing details|Services availability|Offer Insights|Price history|Public tax history|Monthly payment|BuyAbility.*payment|Payment breakdown|Climate risks|Nearby schools|Nearby homes|Local experts|Similar homes|Homes for you|Available homes|Other available plans|For Sale|Choose Homes by Amenity|Select Property Type|Popular Searches|Nearby .* Homes|.* Neighborhood Homes|.* Homes by Zip Code|More to Explore|Have You Considered Renting\?)$/i;
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } = { title: "Page header", lines: [] };
  for (const line of lines) {
    if (heading.test(line)) {
      if (current.lines.length) sections.push(current);
      current = { title: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push(current);
  return sections.length ? JSON.stringify(sections.slice(0, 80)) : null;
}

function classifyListingDealPropertyType(args: {
  mainText: string;
  allText: string;
  landUseLine: string | null | undefined;
  homeType: string | null;
  propertySubtype: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  interiorArea: string | null;
}): DealPropertyType {
  const text = [
    args.landUseLine,
    args.homeType,
    args.propertySubtype,
    args.mainText.slice(0, 1200),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(commercial|retail|industrial|office|mixed use|warehouse)\b/.test(text)) return "commercial";
  if (/\b(duplex|triplex|quadplex|multi[-\s]?family|apartment|apartments)\b/.test(text)) return "rental";
  if (/\b(townhouse|townhome|single family|single-family|condo|condominium|home type|new construction|buildable plan|bedrooms|bathrooms)\b/.test(text)) return "house";
  if ((args.bedrooms || args.bathrooms || args.interiorArea) && !/\b(acres?|lot\/land|residential lot|unimproved land|vacant land)\b/.test(text)) return "house";
  if (/\b(residential lot|lot\s*\/\s*land|lot\/land|vacant land|unimproved land|acreage|farm|land)\b/.test(text)) return "land";
  return "other";
}

export function listingTextHints(listingText: string): ListingUrlHints {
  const lines = listingText.split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return {};

  const priceHistoryIndex = lines.findIndex(line => /^price history$/i.test(line));
  const carouselIndex = lines.findIndex(line => /^(nearby homes|similar homes|homes for you)$/i.test(line));
  const mainEnd = [priceHistoryIndex, carouselIndex].filter(index => index >= 0).sort((a, b) => a - b)[0] ?? lines.length;
  const mainLines = lines.slice(0, mainEnd);
  const mainText = mainLines.join(" ");
  const allText = lines.join(" ");
  const extractLineValue = (label: string): string | null => {
    const prefix = `${label}:`.toLowerCase();
    const line = mainLines.find(row => row.toLowerCase().startsWith(prefix));
    return clean(line ? line.slice(label.length + 1) : null);
  };
  const valueAfterStandaloneLabel = (pattern: RegExp): string | null => {
    const index = mainLines.findIndex(line => pattern.test(line));
    if (index < 0) return null;
    return clean(mainLines.slice(index + 1, index + 4).find(line => line !== ":"));
  };

  const priceLineIndex = mainLines.findIndex(line => /^\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?$/i.test(line) && !line.includes("--"));
  const priceLine = priceLineIndex >= 0
    ? mainLines[priceLineIndex]
    : mainLines.find(line => /\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?\b/.test(line) && !line.includes("--"));
  const fullAddressPattern = /^\d{1,6}\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i;
  const streetAddressPattern = /^\d{1,6}\s+.+\s(?:Rd|Road|Dr|Drive|Cir|Circle|St|Street|Ave|Avenue|Ln|Lane|Ct|Court|Way|Trl|Trail|Pkwy|Hwy|Highway|Ter|Terrace|Blvd|Boulevard|Pl|Place)\b(?:\s+[NSEW]{1,2})?$/i;
  const lineIsAddress = (line: string) =>
    !/image of|interested in|travel times|street view|nearby|previous photo|next photo|skip carousel/i.test(line)
    && (fullAddressPattern.test(line) || streetAddressPattern.test(line));
  const nearbyAddress = priceLineIndex >= 0 ? mainLines.slice(priceLineIndex + 1, priceLineIndex + 8).find(lineIsAddress) : null;
  const addressLine = nearbyAddress || mainLines.find(lineIsAddress) || "";
  const addressHints = addressLine ? parseListingAddressLine(addressLine) : {};

  const splitAcreIndex = mainLines.findIndex((line, index) => /^acres?$/i.test(line) && /^[\d.]+$/.test(mainLines[index - 1] || ""));
  const acresFromSplitLines = splitAcreIndex > 0 ? Number(mainLines[splitAcreIndex - 1]) : null;
  const acresMatch = mainText.match(/(?:Size:\s*)?([\d.]+)\s+Acres?\b/i)
    || mainText.match(/([\d.]+)\s+acres?\s+lot/i);
  const parcelMatch = mainText.match(/Parcel number:\s*([A-Za-z0-9-]+)/i);
  const listingDateMatch = mainText.match(/Date on market:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const assessedValueMatch = mainText.match(/Tax assessed value:\s*(\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?)/i);
  const propertyTaxMatch = mainText.match(/Annual tax amount:\s*(\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?)/i);
  const marketValueMatch = mainText.match(/(?:Estimated market value|Zestimate®?)\s*(\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?)/i);
  const standaloneCountyLine = lines.find(line => /^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+County$/i.test(line) && !/^Georgia/i.test(line));
  const embeddedGeorgiaCounty = allText.match(/Georgia([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+County\b/);
  const genericCounty = allText.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+County\b/);
  const countyName = standaloneCountyLine?.replace(/\s+County$/i, "")
    || embeddedGeorgiaCounty?.[1]
    || (genericCounty?.[1] && !/^Georgia/i.test(genericCounty[1]) ? genericCounty[1] : null);
  const statusLine = mainLines.find(line => /^(active|for sale|pending|under contract|sold|off market|auction|new construction)$/i.test(line));
  const landUseLine = mainLines.find(line => /^(residential lot|lot\s*\/\s*land|lot\/land|land|acreage|commercial lot|farm|unimproved land)$/i.test(line));
  const homeType = extractLineValue("Home type") || mainLines.find(line => /^(townhouse|townhome|single family|single-family|condo|condominium|manufactured home|mobile home|multi-family|multifamily)$/i.test(line)) || null;
  const propertySubtype = extractLineValue("Property subtype");
  const buildablePlanMatch = mainText.match(/Buildable plan:\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/i);
  const bedrooms = valueBeforeLine(mainLines, /^beds$/i) || extractLineValue("Bedrooms");
  const bathrooms = valueBeforeLine(mainLines, /^baths$/i) || extractLineValue("Bathrooms");
  const interiorArea = extractLineValue("Total interior livable area") || mainLines.find(line => /^[\d,]+\s+sqft$/i.test(line)) || null;
  const listingDealPropertyType = classifyListingDealPropertyType({
    mainText,
    allText,
    landUseLine,
    homeType,
    propertySubtype,
    bedrooms,
    bathrooms,
    interiorArea,
  });
  const sourceLine = extractLineValue("Source")?.replace(/\s*MLS Logo.*$/i, "").trim() || null;
  const specialIndex = mainLines.findIndex(line => /^what'?s special$/i.test(line));
  const specialEnd = specialIndex >= 0
    ? mainLines.findIndex((line, index) => index > specialIndex && /^(show more|hide|\d+\s+days|stay connected|listing updated|listed by:|source:|facts & features)$/i.test(line))
    : -1;
  const listingDescription = specialIndex >= 0
    ? mainLines.slice(specialIndex + 1, specialEnd > specialIndex ? specialEnd : Math.min(mainLines.length, specialIndex + 5)).join(" ").slice(0, 1000)
    : null;
  const sourceInfo = parseListingSource(sourceLine);
  const agent = parseListingAgent(mainLines);
  const featureValues = mainLines
    .filter(line => /^Features:/i.test(line))
    .map(line => line.replace(/^Features:\s*/i, "").trim())
    .filter(Boolean);
  const hoaFee = colonValue(mainLines, "HOA fee");
  const monthlyHoa = mainLines.find(line => /^\$\s?[\d,]+(?:\.\d+)?\/mo HOA$/i.test(line)) || null;
  const walk = parseScore(lines, /^Walk Score/);
  const bike = parseScore(lines, /^Bike Score/);
  const floodZone = lineAfter(lines, /^Flood zone$/i);
  const neighborhood = colonValue(lines, "Neighborhood") || lineAfter(lines, /^Neighborhood$/i);
  const priceHistory = parsePriceHistory(lines);
  const publicTaxHistory = parsePublicTaxHistory(lines);
  const nearbyHomes = parseListingCards(lines, /^Nearby homes$/i, [/^Local experts/i, /^Similar homes$/i]);
  const similarHomes = parseListingCards(lines, /^Similar homes$/i, [/^Homes for you$/i, /^Skip carousel$/i]);
  const homesForYou = parseListingCards(lines, /^Homes for you$/i, [/^The data relating/i, /^For Sale$/i]);
  const availableHomes = parseAvailableHomes(lines);
  const otherAvailablePlans = parsePlanCards(lines, /^Other available plans$/i, [/^Listing provided by$/i, /^Georgia/i]);
  const searchResultListings = parseListingCards(lines, /^Sort: Homes for You$/i, [/^Save this search$/i, /^Listings identified/i]);
  const paymentBreakdown = parsePaymentBreakdown(lines);
  const nearbyCityValues = parseFooterValueRows(lines, /^Nearby .* Homes$/i, [/^.* Neighborhood Homes$/i, /^.* Homes by Zip Code$/i]);
  const neighborhoodValues = parseFooterValueRows(lines, /^.* Neighborhood Homes$/i, [/^.* Homes by Zip Code$/i, /^Estimate Your Home Sale Proceeds$/i]);
  const zipValues = parseFooterValueRows(lines, /^.* Homes by Zip Code$/i, [/^Estimate Your Home Sale Proceeds$/i, /^More to Explore/i]);
  const listingLabelValues = parseListingLabelValues(lines);
  const listingSectionSnapshot = parseListingSectionSnapshot(lines);
  const paymentValues = paymentBreakdown ? JSON.parse(paymentBreakdown) as Record<string, string> : {};
  const searchTitleIndex = lines.findIndex((line, index) =>
    /\b(Land|Real Estate & Homes For Sale|Homes For Sale)$/i.test(line)
    && /^\d[\d,]*\s+results$/i.test(lines[index + 1] || ""),
  );
  const primaryBedroomRows = sectionLines(mainLines, /^Primary bedroom$/i, [/^Bedroom$/i, /^Primary bathroom$/i, /^Dining room$/i]);
  const bedroomRows = sectionLines(mainLines, /^Bedroom$/i, [/^Primary bathroom$/i, /^Dining room$/i, /^Kitchen$/i, /^Heating$/i]);
  const primaryBathroomRows = sectionLines(mainLines, /^Primary bathroom$/i, [/^Dining room$/i, /^Kitchen$/i, /^Heating$/i]);
  const diningRoomRows = sectionLines(mainLines, /^Dining room$/i, [/^Kitchen$/i, /^Heating$/i]);
  const kitchenRows = sectionLines(mainLines, /^Kitchen$/i, [/^Heating$/i, /^Cooling$/i, /^Appliances$/i]);
  const lotRows = sectionLines(mainLines, /^Lot$/i, [/^Details$/i, /^Construction$/i, /^Utilities & green energy$/i]);
  const communityRows = sectionLines(mainLines, /^Community$/i, [/^HOA$/i, /^Location$/i, /^Financial & listing details$/i]);
  const interiorFeatureText = parseTextListBetween(mainLines, /^Features$/i, [/^Interior area$/i, /^Property$/i]);
  const zestimateHistoryIndex = lines.findIndex(line => /^Zestimate®? history$/i.test(line));
  const details: ListingDetails = {
    "Paste Line Count": lines.length,
    "Listing Status": statusLine || null,
    "Deal Property Type": listingDealPropertyType,
    "Listing Photo Count": mainText.match(/See all\s+([\d,]+)\s+photos/i)?.[1] || null,
    "Headline Price": priceLine || null,
    "Primary Address": addressLine || null,
    "Plan Name": buildablePlanMatch?.[1] || null,
    "Plan Community": buildablePlanMatch?.[2] || null,
    "Plan City": buildablePlanMatch?.[3] || null,
    "Plan State": buildablePlanMatch?.[4]?.toUpperCase() || null,
    "Plan Zip": buildablePlanMatch?.[5] || null,
    "Bedrooms": bedrooms,
    "Bathrooms": bathrooms,
    "Full Bathrooms": extractLineValue("Full bathrooms"),
    "Half Bathrooms": extractLineValue("1/2 bathrooms"),
    "Main Level Bathrooms": extractLineValue("Main level bathrooms"),
    "Main Level Bedrooms": extractLineValue("Main level bedrooms"),
    "Room Types": extractLineValue("Room types"),
    "Primary Bedroom Features": colonValue(primaryBedroomRows, "Features"),
    "Primary Bedroom Level": colonValue(primaryBedroomRows, "Level"),
    "Bedroom Features": colonValue(bedroomRows, "Features"),
    "Primary Bathroom Features": colonValue(primaryBathroomRows, "Features"),
    "Dining Room Features": colonValue(diningRoomRows, "Features"),
    "Kitchen Features": colonValue(kitchenRows, "Features"),
    "Heating": lineAfter(mainLines, /^Heating$/i),
    "Cooling": lineAfter(mainLines, /^Cooling$/i),
    "Appliances Included": extractLineValue("Included"),
    "Laundry": extractLineValue("Laundry"),
    "Interior Features": interiorFeatureText,
    "Flooring": extractLineValue("Flooring"),
    "Windows": extractLineValue("Windows"),
    "Basement": extractLineValue("Basement"),
    "Fireplaces": extractLineValue("Number of fireplaces"),
    "Fireplace Features": extractLineValue("Fireplace features"),
    "Common Walls": extractLineValue("Common walls with other units/homes"),
    "Interior Livable Area": interiorArea,
    "Total Structure Area": extractLineValue("Total structure area"),
    "Finished Area Above Ground": extractLineValue("Finished area above ground"),
    "Finished Area Below Ground": extractLineValue("Finished area below ground"),
    "Virtual Tour": mainLines.some(line => /^View virtual tour$/i.test(line)) ? "Available" : null,
    "Parking Total Spaces": extractLineValue("Total spaces"),
    "Parking Features": extractLineValue("Parking features"),
    "Garage Spaces": extractLineValue("Garage spaces"),
    "Accessibility Features": extractLineValue("Accessibility features"),
    "Levels": extractLineValue("Levels"),
    "Stories": extractLineValue("Stories"),
    "Patio And Porch": extractLineValue("Patio & porch"),
    "Exterior Features": extractLineValue("Exterior features"),
    "Pool Features": extractLineValue("Pool features"),
    "Spa Features": extractLineValue("Spa features"),
    "Fencing": extractLineValue("Fencing"),
    "Has View": extractLineValue("Has view"),
    "View Description": extractLineValue("View description"),
    "Acreage Display": acresFromSplitLines ? `${acresFromSplitLines} Acres` : acresMatch?.[0] || null,
    "Lot Dimensions": extractLineValue("Dimensions"),
    "Additional Structures": extractLineValue("Additional structures"),
    "Other Equipment": extractLineValue("Other equipment"),
    "Horse Amenities": extractLineValue("Horse amenities"),
    "Property Type": landUseLine || homeType || propertySubtype || null,
    "Home Type": homeType,
    "Property Subtype": propertySubtype,
    "Architectural Style": extractLineValue("Architectural style"),
    "Materials": lineAfter(mainLines, /^Materials$/i),
    "Foundation": extractLineValue("Foundation"),
    "Roof": extractLineValue("Roof"),
    "Condition": lineAfter(mainLines, /^Condition$/i) || mainLines.find(line => /^New Construction$/i.test(line)) || null,
    "New Construction": extractLineValue("New construction"),
    "Year Built": extractLineValue("Year built"),
    "Builder Name": extractLineValue("Builder name"),
    "Buildable Plan": /Buildable plan/i.test(mainText) ? "Yes" : null,
    "Community Name": buildablePlanMatch?.[2] || clean(mainLines.find(line => / Plan,\s*[^,]+$/i.test(line))?.replace(/^.* Plan,\s*/i, "")) || extractLineValue("Subdivision"),
    "Community Description": clean(sectionLines(lines, /^About the community$/i, [/^Show more$/i, /^Source:/i, /^\d+\s+homes in this community$/i]).join(" ").slice(0, 2500)),
    "Available Homes": availableHomes,
    "Other Available Plans": otherAvailablePlans,
    "Lot Size Text": mainLines.find(line => /\bAcres? Lot\b|\bsqft lot\b|\bSquare Feet\b/i.test(line)) || null,
    "Built In": mainText.match(/Built in\s+([^\s]+)/i)?.[1] || null,
    "Zestimate": lineAfter(lines, /^Zestimate®?$/i),
    "Estimated Sales Range": lineAfter(lines, /^Estimated sales range$/i),
    "Rent Zestimate": lineAfter(lines, /^Rent Zestimate®?$/i),
    "Zestimate History": zestimateHistoryIndex >= 0
      ? clean(lines.slice(zestimateHistoryIndex + 1, zestimateHistoryIndex + 8).join(" "))
      : null,
    "Price Per Sqft": mainLines.find(line => /^\$[\d,.-]+\/sqft$/i.test(line)) || null,
    "HOA Monthly Display": monthlyHoa,
    "What's Special": specialIndex >= 0 ? clean(mainLines[specialIndex + 1]) : null,
    "Days On Zillow": mainText.match(/([\d,]+)\s+days\s+on Zillow/i)?.[1] || null,
    "Views": mainText.match(/\|\s*([\d,]+)\s+views/i)?.[1] || null,
    "Saves": mainText.match(/\|\s*[\d,]+\s+views\s*\|\s*([\d,]+)\s+saves/i)?.[1] || null,
    "Zillow Last Checked": colonValue(lines, "Zillow last checked"),
    "Listing Updated": colonValue(lines, "Listing updated"),
    "Also Listed On": clean(mainLines.find(line => /^Also listed on\b/i.test(line))?.replace(/^Also listed on\s*/i, "")),
    "Listing Agent": agent.name,
    "Listing Agent Phone": agent.phone,
    "Listing Brokerage": agent.brokerage,
    "MLS Number": sourceInfo.mls,
    "Waterfront": colonValue(mainLines, "On waterfront"),
    "Waterfront Features": colonValue(mainLines, "Waterfront features"),
    "Body Of Water": colonValue(mainLines, "Body of water"),
    "Waterfront Frontage": colonValue(mainLines, "Frontage length"),
    "Lot Features": colonValue(lotRows, "Features") || featureValues[0] || null,
    "Community Features": colonValue(communityRows, "Features") || featureValues[1] || null,
    "Special Conditions": colonValue(mainLines, "Special conditions"),
    "HOA Fee": hoaFee,
    "Region": colonValue(mainLines, "Region"),
    "Cumulative Days On Market": colonValue(mainLines, "Cumulative days on market"),
    "Listing Agreement": colonValue(mainLines, "Listing agreement"),
    "Listing Terms": colonValue(mainLines, "Listing terms"),
    "Road Surface Type": colonValue(mainLines, "Road surface type"),
    "Electric": colonValue(mainLines, "Electric"),
    "Green Energy Efficient Items": colonValue(mainLines, "Energy efficient items"),
    "Energy Generation": colonValue(mainLines, "Energy generation"),
    "Security": colonValue(mainLines, "Security"),
    "Electric Utility On Property": colonValue(mainLines, "Electric utility on property"),
    "Offer Insights": lineAfter(lines, /^Offer Insights$/i),
    "Payment Breakdown": paymentBreakdown,
    "BuyAbility Estimated Payment": valueAfterStandaloneLabel(/^Est\. payment$/i) || valueAfterStandaloneLabel(/^Est\.$/i),
    "Down Payment": lineAfter(lines, /^Down payment$/i),
    "Credit Score": lineAfter(lines, /^Credit score$/i),
    "Down Payment Assistance": parseTextListBetween(lines, /^Down payment assistance$/i, [/^Climate risks$/i, /^Nearby schools$/i], 800),
    "Monthly Estimated Payment": paymentValues["Estimated monthly payment"] || valueAfterStandaloneLabel(/^Est\. payment$/i) || valueAfterStandaloneLabel(/^Est\.$/i),
    "Monthly Principal And Interest": paymentValues["Principal & interest"] || null,
    "Monthly Mortgage Insurance": paymentValues["Mortgage insurance"] || null,
    "Monthly Property Taxes": paymentValues["Property taxes"] || null,
    "Monthly Home Insurance": paymentValues["Home insurance"] || null,
    "Monthly HOA Fees": paymentValues["HOA fees"] || null,
    "Monthly Utilities": paymentValues["Utilities"] || null,
    "Flood Zone": floodZone,
    "Neighborhood": neighborhood,
    "Walk Score": walk.score,
    "Walk Score Label": walk.description,
    "Bike Score": bike.score,
    "Bike Score Label": bike.description,
    "Schools": parseSchoolLines(lines),
    "Price History": priceHistory,
    "Public Tax History": publicTaxHistory,
    "Nearby Homes": nearbyHomes,
    "Similar Homes": similarHomes,
    "Homes For You": homesForYou,
    "Search Result Title": searchTitleIndex >= 0 ? lines[searchTitleIndex] : null,
    "Search Result Count": searchTitleIndex >= 0 ? lines[searchTitleIndex + 1] : null,
    "Search Result Listings": searchResultListings,
    "Nearby City Values": nearbyCityValues,
    "Neighborhood Values": neighborhoodValues,
    "Zip Values": zipValues,
    "Listing Label Values": listingLabelValues,
    "Listing Section Snapshot": listingSectionSnapshot,
    "Buildability Note": /non-buildable|not buildable/i.test(mainText) ? "Non-buildable lot mentioned in listing copy" : null,
    "Recreational Use Mentioned": /recreational use|boating|fishing/i.test(mainText) ? "Yes" : null,
  };

  return {
    ...addressHints,
    propertyAddress: addressHints.propertyAddress || (buildablePlanMatch ? `${buildablePlanMatch[1]} Plan, ${buildablePlanMatch[2]}` : null),
    city: addressHints.city || buildablePlanMatch?.[3] || null,
    state: addressHints.state || buildablePlanMatch?.[4]?.toUpperCase() || null,
    zip: addressHints.zip || buildablePlanMatch?.[5] || null,
    county: countyName ? `${titleCaseAddressPart(countyName)} County` : null,
    parcelId: parcelMatch?.[1] || null,
    acreage: acresFromSplitLines || (acresMatch?.[1] ? Number(acresMatch[1]) : null),
    askingPrice: priceLine ? parseListingMoneyValue(priceLine) : null,
    marketValue: marketValueMatch?.[1] ? parseListingMoneyValue(marketValueMatch[1]) : null,
    assessedValue: assessedValueMatch?.[1] ? parseListingMoneyValue(assessedValueMatch[1]) : null,
    propertyTax: propertyTaxMatch?.[1] ? parseListingMoneyValue(propertyTaxMatch[1]) : null,
    zoning: extractLineValue("Zoning"),
    landUse: landUseLine || homeType || propertySubtype || null,
    subdivision: extractLineValue("Subdivision"),
    hoaStatus: extractLineValue("Has HOA"),
    listingStatus: statusLine || null,
    listingDate: normalizeListingDate(listingDateMatch?.[1]),
    water: extractLineValue("Water"),
    sewer: extractLineValue("Sewer"),
    utilities: extractLineValue("Utilities for property"),
    sourceMls: sourceInfo.source || sourceLine,
    listingDescription: clean(listingDescription),
    dealPropertyType: listingDealPropertyType,
    listingDetails: details,
  };
}

export async function createSingleLinkLandLead(input: SingleLinkLandLeadInput): Promise<LeadImportResult> {
  const url = input.sourceUrl.trim();
  if (!url) return { batch: null, leads: [], error: "Paste a property or listing link first." };

  const now = new Date().toISOString();
  const sourceSystem = input.sourceSystem?.trim() || inferLandLeadSourceFromUrl(url);
  const campaignSource = input.campaignSource?.trim() || "Single Link Intake";
  const urlHints = listingUrlHints(url);
  const textHints = listingTextHints(input.listingText || "");
  const parsedNotes = listingSummaryNotes(textHints);
  const notes = [input.notes?.trim(), parsedNotes].filter(Boolean).join("\n") || null;
  const enrichedInput: SingleLinkLandLeadInput = {
    ...input,
    propertyAddress: input.propertyAddress?.trim() || textHints.propertyAddress || urlHints.propertyAddress || null,
    parcelId: input.parcelId?.trim() || textHints.parcelId || null,
    county: input.county?.trim() || textHints.county || null,
    city: input.city?.trim() || textHints.city || urlHints.city || null,
    state: input.state?.trim() || textHints.state || urlHints.state || null,
    zip: input.zip?.trim() || textHints.zip || urlHints.zip || null,
    acreage: input.acreage ?? textHints.acreage ?? null,
    askingPrice: input.askingPrice ?? textHints.askingPrice ?? null,
    marketValue: input.marketValue ?? textHints.marketValue ?? null,
    assessedValue: input.assessedValue ?? textHints.assessedValue ?? null,
    propertyTax: input.propertyTax ?? textHints.propertyTax ?? null,
    zoning: input.zoning?.trim() || textHints.zoning || null,
    landUse: input.landUse?.trim() || textHints.landUse || null,
    subdivision: input.subdivision?.trim() || textHints.subdivision || null,
    hoaStatus: input.hoaStatus?.trim() || textHints.hoaStatus || null,
    listingStatus: input.listingStatus?.trim() || textHints.listingStatus || null,
    listingDate: input.listingDate?.trim() || textHints.listingDate || null,
    water: input.water?.trim() || textHints.water || null,
    sewer: input.sewer?.trim() || textHints.sewer || null,
    utilities: input.utilities?.trim() || textHints.utilities || null,
    sourceMls: input.sourceMls?.trim() || textHints.sourceMls || null,
    listingDescription: input.listingDescription?.trim() || textHints.listingDescription || null,
    listingDetails: { ...(textHints.listingDetails || {}), ...(input.listingDetails || {}) },
    notes,
    sourceSystem,
    campaignSource,
  };
  const rawData = singleLinkRawData(enrichedInput);

  const batchSeed = {
    source_system: sourceSystem,
    original_filename: null,
    campaign_source: campaignSource,
    row_count: 1,
    uploaded_by: input.actor,
  };
  const batchEnhancement = {
    status: "in-progress" as const,
    assigned_to: input.actor,
    started_at: now,
    import_summary: {
      intake_method: "single-link",
      source_url: url,
      source_system: sourceSystem,
      listing_text_captured: !!input.listingText?.trim(),
    },
    notes,
  };

  if (!supabase) {
    const batch: LandLeadBatch = {
      id: `single-link-batch-${Date.now()}`,
      ...batchSeed,
      ...batchEnhancement,
      completed_at: null,
      created_at: now,
    };
    const normalized = normalizeLead(rawData, sourceSystem, campaignSource, input.actor, batch.id);
    const lead: ImportedLandLead = {
      ...normalized,
      id: `single-link-lead-${Date.now()}`,
      created_at: now,
      updated_at: now,
    };
    localSet(LOCAL_BATCHES, [batch, ...localGet<LandLeadBatch[]>(LOCAL_BATCHES, [])]);
    localSet(LOCAL_LEADS, [lead, ...localGet<ImportedLandLead[]>(LOCAL_LEADS, [])]);
    await insertFieldValueRowsInChunks([lead], [normalized]);
    if (importedLeadDealPropertyType(lead) === "land") await upsertLandUnderwritingForLeads([lead]);
    return { batch, leads: [lead], error: null };
  }

  const batchResult = await supabase
    .from("meridian_land_lead_import_batches")
    .insert({ ...batchSeed, ...batchEnhancement })
    .select()
    .single();
  let batchData = batchResult.data;
  const batchError = batchResult.error;
  if (batchError || !batchData) {
    const fallback = await supabase
      .from("meridian_land_lead_import_batches")
      .insert(batchSeed)
      .select()
      .single();
    if (fallback.error || !fallback.data) {
      return { batch: null, leads: [], error: fallback.error?.message ?? batchError?.message ?? "Could not create the link intake batch." };
    }
    batchData = fallback.data;
  }

  const batch = batchData as LandLeadBatch;
  const existing = await fetchImportedLandLeads(5000);
  const normalized = applyDuplicateMetadata([normalizeLead(rawData, sourceSystem, campaignSource, input.actor, batch.id)], existing)[0];
  const inserted = await insertLeadRowsInChunks([normalized]);
  if (inserted.error) return { batch, leads: [], error: inserted.error.message ?? "Could not save the link property record." };
  const savedLead = inserted.rows[0] ?? {
    ...normalized,
    id: `${batch.id}-single-link`,
    created_at: now,
    updated_at: now,
  } as ImportedLandLead;
  await insertFieldValueRowsInChunks([savedLead], [normalized]);
  if (importedLeadDealPropertyType(savedLead) === "land") await upsertLandUnderwritingForLeads([savedLead]);
  return { batch, leads: [savedLead], error: null };
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

function countImportedLeadContactMetrics(rows: ImportedLandLeadMetricsRow[]): number {
  const groups = new Set<string>();
  rows.forEach(row => {
    if (row.status === "converted") return;
    groups.add(importedLeadContactIdentityKey(row));
  });
  return groups.size;
}

export async function fetchImportedLandLeadListMetrics(): Promise<ImportedLandLeadListMetrics | null> {
  if (!supabase) {
    const rows = localGet<ImportedLandLead[]>(LOCAL_LEADS, []);
    return {
      properties: rows.length,
      contacts: countImportedLeadContactMetrics(rows),
    };
  }

  const { count } = await supabase
    .from("meridian_imported_land_leads")
    .select("id", { count: "exact", head: true });

  const rows: ImportedLandLeadMetricsRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("meridian_imported_land_leads")
      .select("id,status,phone,phone_2,owner_name,mailing_address,mail_address,county,state,parcel_id,property_address")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error || !data) return null;
    rows.push(...(data as ImportedLandLeadMetricsRow[]));
    if (data.length < pageSize || (count !== null && rows.length >= count)) break;
  }

  return {
    properties: count ?? rows.length,
    contacts: countImportedLeadContactMetrics(rows),
  };
}

export async function fetchRecentlyUpdatedImportedLandLeads(limit = 500): Promise<ImportedLandLead[]> {
  if (!supabase) {
    return localGet<ImportedLandLead[]>(LOCAL_LEADS, [])
      .sort((a, b) =>
        (b.last_activity_at || b.updated_at || b.created_at)
          .localeCompare(a.last_activity_at || a.updated_at || a.created_at)
      )
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from("meridian_imported_land_leads")
    .select("*")
    .order("updated_at", { ascending: false })
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

function countyDisplayName(value: string | null | undefined): string | null {
  const county = clean(value);
  if (!county) return null;
  return /county$/i.test(county) ? titleCaseAddressPart(county) : `${titleCaseAddressPart(county)} County`;
}

function leadFieldHasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  const text = clean(value);
  if (!text) return false;
  return !["?", "-", "--", "n/a", "na", "none", "unknown"].includes(text.toLowerCase());
}

function shouldFillLeadField(lead: ImportedLandLead, key: keyof ImportedLandLead): boolean {
  const current = lead[key];
  if (key === "owner_name") return !hasImportedLeadOwnerIdentity(current as string | null | undefined);
  if (key === "county") {
    const county = normalizeText(current as string | null | undefined);
    return !county || county === "ga" || county === "georgia";
  }
  return !leadFieldHasValue(current);
}

function setLeadPatchValue<K extends keyof ImportedLandLead>(
  patch: Partial<ImportedLandLead>,
  lead: ImportedLandLead,
  key: K,
  value: ImportedLandLead[K] | null | undefined,
) {
  if (!leadFieldHasValue(value)) return;
  if (!shouldFillLeadField(lead, key)) return;
  patch[key] = value as ImportedLandLead[K];
}

function firstResearchFinding(result: AutomatedLandResearchResult, category: LandDueDiligenceCategory, sourceName?: string): AutomatedLandResearchFinding | null {
  return result.findings.find(finding =>
    finding.category === category && (!sourceName || finding.source_name.toLowerCase().includes(sourceName.toLowerCase())),
  ) ?? result.findings.find(finding => finding.category === category) ?? null;
}

function numericEvidence(value: string | null | undefined): number | null {
  const match = clean(value)?.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function researchFindingSnapshot(finding: AutomatedLandResearchFinding | null): Record<string, unknown> | null {
  if (!finding) return null;
  return {
    title: finding.title,
    status: finding.status,
    result: finding.result_summary,
    evidence: finding.evidence_value,
    sourceName: finding.source_name,
    sourceUrl: finding.source_url,
    confidence: finding.confidence,
    blocker: finding.blocker ?? null,
  };
}

function researchLeadPatch(lead: ImportedLandLead, result: AutomatedLandResearchResult): Partial<ImportedLandLead> | null {
  const match = result.parcel_match;
  const flood = firstResearchFinding(result, "flood", "FEMA");
  const wetlands = firstResearchFinding(result, "wetlands", "NWI");
  const access = firstResearchFinding(result, "access", "OpenStreetMap");
  const elevation = result.findings.find(finding => finding.title.toLowerCase().includes("elevation")) ?? null;
  const soil = result.findings.find(finding => finding.title.toLowerCase().includes("soil")) ?? null;
  const rawData = {
    ...(lead.raw_data || {}),
    "Automatic research": {
      checkedAt: result.checked_at,
      location: result.location,
      parcelMatch: match,
      findings: result.findings,
      sourceLinks: result.source_links,
      warnings: result.warnings,
    },
    "Location research": {
      checkedAt: result.checked_at,
      latitude: result.location.latitude,
      longitude: result.location.longitude,
      matchedAddress: result.location.matched_address,
      county: result.location.county,
      city: result.location.city,
      state: result.location.state,
      zip: result.location.zip,
      geocoder: result.location.geocoder,
    },
    ...(match ? { "County parcel research": {
      sourceName: match.sourceName,
      sourceUrl: match.sourceUrl,
      checkedAt: result.checked_at,
      parcelId: match.parcelId,
      address: match.address,
      owner: match.owner,
      acreage: match.acreage,
      zoning: match.zoning,
      landUse: match.landUse,
      assessedValue: match.assessedValue,
      propertyTax: match.propertyTax,
      mailingAddress: match.mailingAddress,
      addressMatchesSubject: match.addressMatchesSubject,
      raw: match.raw,
    } } : {}),
    ...(flood ? { "FEMA flood research": researchFindingSnapshot(flood) } : {}),
    ...(wetlands ? { "USFWS wetlands research": researchFindingSnapshot(wetlands) } : {}),
    ...(access ? { "OSM access research": researchFindingSnapshot(access) } : {}),
    ...(elevation ? { "USGS elevation research": researchFindingSnapshot(elevation) } : {}),
    ...(soil ? { "USDA soil research": researchFindingSnapshot(soil) } : {}),
  };
  const patch: Partial<ImportedLandLead> = {
    raw_data: rawData,
  };
  const county = countyDisplayName(result.location.county);
  setLeadPatchValue(patch, lead, "county", county);
  setLeadPatchValue(patch, lead, "city", result.location.city);
  setLeadPatchValue(patch, lead, "state", result.location.state);
  setLeadPatchValue(patch, lead, "zip", result.location.zip);
  setLeadPatchValue(patch, lead, "latitude", result.location.latitude);
  setLeadPatchValue(patch, lead, "longitude", result.location.longitude);
  if (typeof result.location.latitude === "number" && typeof result.location.longitude === "number") {
    setLeadPatchValue(patch, lead, "google_map_url", `https://www.google.com/maps/search/${result.location.latitude},${result.location.longitude}`);
  }

  if (match && match.addressMatchesSubject !== false) {
    setLeadPatchValue(patch, lead, "parcel_id", match.parcelId);
    setLeadPatchValue(patch, lead, "property_address", match.address);
    setLeadPatchValue(patch, lead, "owner_name", match.owner);
    setLeadPatchValue(patch, lead, "mailing_address", match.mailingAddress);
    setLeadPatchValue(patch, lead, "acreage", match.acreage);
    setLeadPatchValue(patch, lead, "calculated_acreage", match.acreage);
    setLeadPatchValue(patch, lead, "zoning", match.zoning);
    setLeadPatchValue(patch, lead, "land_use", match.landUse);
    setLeadPatchValue(patch, lead, "assessed_value", match.assessedValue);
    setLeadPatchValue(patch, lead, "property_tax", match.propertyTax);
    setLeadPatchValue(patch, lead, "parcel_link", match.sourceUrl);
  }

  if (flood?.evidence_value) {
    if (/no point intersection/i.test(flood.evidence_value)) {
      setLeadPatchValue(patch, lead, "flood_zone_percent", 0);
      setLeadPatchValue(patch, lead, "flood_zone_type", "No FEMA point intersection");
    } else {
      setLeadPatchValue(patch, lead, "flood_zone_type", flood.evidence_value);
    }
  }
  if (wetlands?.evidence_value && /no point intersection/i.test(wetlands.evidence_value)) {
    setLeadPatchValue(patch, lead, "wetlands_percent", 0);
  }
  if (access?.evidence_value && (lead.is_land_locked === null || lead.is_land_locked === undefined)) {
    if (/no road within/i.test(access.evidence_value || "")) patch.is_land_locked = true;
    if (/nearby osm road|road feature/i.test(access.evidence_value || "")) patch.is_land_locked = false;
  }
  const elevationFt = numericEvidence(elevation?.evidence_value);
  if (elevationFt !== null) setLeadPatchValue(patch, lead, "avg_elevation", elevationFt);
  const topographyParts = [
    elevation?.evidence_value ? `USGS point elevation: ${elevation.evidence_value}` : null,
    soil?.evidence_value ? `USDA soil: ${soil.evidence_value}` : null,
  ].filter(Boolean);
  if (topographyParts.length) setLeadPatchValue(patch, lead, "topography", topographyParts.join(" · "));
  return patch;
}

export async function updateImportedLandLeadFromResearch(
  lead: ImportedLandLead,
  result: AutomatedLandResearchResult,
): Promise<{ lead: ImportedLandLead | null; error: string | null }> {
  const patch = researchLeadPatch(lead, result);
  if (!patch) return { lead, error: null };
  const now = new Date().toISOString();
  const next = { ...lead, ...patch, updated_at: now };
  if (!supabase) {
    const rows = localGet<ImportedLandLead[]>(LOCAL_LEADS, []);
    localSet(LOCAL_LEADS, rows.map(row => row.id === lead.id ? next : row));
    return { lead: next, error: null };
  }
  const { data, error } = await supabase
    .from("meridian_imported_land_leads")
    .update({ ...patch, updated_at: now })
    .eq("id", lead.id)
    .select("*")
    .single();
  return { lead: data as ImportedLandLead | null, error: error?.message ?? null };
}

const MANUAL_RESEARCH_FIELD_LABELS: Partial<Record<keyof ManualResearchLeadPatch, string>> = {
  parcel_id: "Parcel ID",
  property_address: "Property address",
  county: "County",
  city: "City",
  state: "State",
  zip: "ZIP",
  latitude: "Latitude",
  longitude: "Longitude",
  acreage: "Acreage",
  calculated_acreage: "Calculated acreage",
  owner_name: "Owner",
  mailing_address: "Mailing address",
  zoning: "Zoning",
  land_use: "Land use",
  subdivision: "Subdivision",
  hoa_status: "HOA",
  asking_price: "Asking price",
  assessed_value: "Assessed value",
  market_value: "Market value",
  property_tax: "Property tax",
  tax_delinquent: "Tax delinquent",
  tax_delinquent_years: "Tax delinquent years",
  road_frontage_ft: "Road frontage",
  is_land_locked: "Landlocked",
  flood_zone_percent: "Flood zone %",
  flood_zone_type: "Flood zone type",
  wetlands_percent: "Wetlands %",
  min_lot_size_acres: "Minimum lot size",
  parcel_link: "Parcel/GIS link",
  comping_link: "Comping link",
  notes: "Property notes",
};

const MANUAL_RESEARCH_TEXT_FIELDS: Array<keyof ManualResearchLeadPatch> = [
  "parcel_id",
  "property_address",
  "county",
  "city",
  "state",
  "zip",
  "owner_name",
  "mailing_address",
  "zoning",
  "land_use",
  "subdivision",
  "hoa_status",
  "flood_zone_type",
  "parcel_link",
  "comping_link",
  "notes",
];

const MANUAL_RESEARCH_NUMBER_FIELDS: Array<keyof ManualResearchLeadPatch> = [
  "latitude",
  "longitude",
  "acreage",
  "calculated_acreage",
  "asking_price",
  "assessed_value",
  "market_value",
  "property_tax",
  "tax_delinquent_years",
  "road_frontage_ft",
  "flood_zone_percent",
  "wetlands_percent",
  "min_lot_size_acres",
];

const MANUAL_RESEARCH_BOOLEAN_FIELDS: Array<keyof ManualResearchLeadPatch> = [
  "tax_delinquent",
  "is_land_locked",
];

function normalizeManualResearchValue(key: keyof ManualResearchLeadPatch, value: unknown): unknown {
  if (MANUAL_RESEARCH_TEXT_FIELDS.includes(key)) {
    if (key === "county") return countyDisplayName(clean(value));
    if (key === "state") return clean(value)?.toUpperCase() || null;
    return clean(value);
  }
  if (MANUAL_RESEARCH_NUMBER_FIELDS.includes(key)) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (MANUAL_RESEARCH_BOOLEAN_FIELDS.includes(key)) {
    if (value === null || value === undefined || value === "") return null;
    return typeof value === "boolean" ? value : boolish(value);
  }
  return value;
}

function valuesMatchForManualResearch(a: unknown, b: unknown): boolean {
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a ?? "").trim() === String(b ?? "").trim();
}

export async function updateImportedLandLeadFromManualResearch(
  lead: ImportedLandLead,
  input: ManualResearchLeadUpdateInput,
): Promise<{ lead: ImportedLandLead | null; changedFields: string[]; error: string | null }> {
  const allowedKeys = new Set<keyof ManualResearchLeadPatch>([
    ...MANUAL_RESEARCH_TEXT_FIELDS,
    ...MANUAL_RESEARCH_NUMBER_FIELDS,
    ...MANUAL_RESEARCH_BOOLEAN_FIELDS,
  ]);
  const patch: Partial<ImportedLandLead> = {};
  const changes: Array<{ field: string; label: string; from: unknown; to: unknown }> = [];
  (Object.keys(input.patch) as Array<keyof ManualResearchLeadPatch>).forEach(key => {
    if (!allowedKeys.has(key)) return;
    const nextValue = normalizeManualResearchValue(key, input.patch[key]);
    const currentValue = lead[key as keyof ImportedLandLead];
    if (valuesMatchForManualResearch(currentValue, nextValue)) return;
    patch[key as keyof ImportedLandLead] = nextValue as never;
    changes.push({
      field: String(key),
      label: MANUAL_RESEARCH_FIELD_LABELS[key] || String(key),
      from: currentValue ?? null,
      to: nextValue ?? null,
    });
  });
  if (!changes.length) return { lead, changedFields: [], error: null };

  const now = new Date().toISOString();
  const existingUpdates = Array.isArray(lead.raw_data?.["Manual research updates"])
    ? lead.raw_data["Manual research updates"] as unknown[]
    : [];
  const sourceName = clean(input.sourceName);
  const sourceUrl = clean(input.sourceUrl);
  const updateLog = {
    checkedAt: now,
    actor: input.actor,
    sourceName,
    sourceUrl,
    notes: clean(input.notes),
    changes,
  };
  patch.raw_data = {
    ...(lead.raw_data || {}),
    "Manual research updates": [updateLog, ...existingUpdates].slice(0, 50),
  };

  const next = { ...lead, ...patch, updated_at: now };
  if (!supabase) {
    const rows = localGet<ImportedLandLead[]>(LOCAL_LEADS, []);
    localSet(LOCAL_LEADS, rows.map(row => row.id === lead.id ? next : row));
    await createImportedLandLeadActivity({
      leadId: lead.id,
      actor: input.actor,
      activityType: "note",
      summary: `Research update applied: ${changes.map(change => change.label).join(", ")}.${sourceName ? ` Source: ${sourceName}.` : ""}${sourceUrl ? ` ${sourceUrl}` : ""}${input.notes ? ` Notes: ${input.notes.trim()}` : ""}`,
    });
    return { lead: next, changedFields: changes.map(change => change.label), error: null };
  }

  const { data, error } = await supabase
    .from("meridian_imported_land_leads")
    .update({ ...patch, updated_at: now })
    .eq("id", lead.id)
    .select("*")
    .single();
  if (error) return { lead: null, changedFields: [], error: error.message };

  const activity = await createImportedLandLeadActivity({
    leadId: lead.id,
    actor: input.actor,
    activityType: "note",
    summary: `Research update applied: ${changes.map(change => change.label).join(", ")}.${sourceName ? ` Source: ${sourceName}.` : ""}${sourceUrl ? ` ${sourceUrl}` : ""}${input.notes ? ` Notes: ${input.notes.trim()}` : ""}`,
  });
  return {
    lead: data as ImportedLandLead | null,
    changedFields: changes.map(change => change.label),
    error: activity.error,
  };
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

const GEORGIA_RESEARCH_COUNTIES = [
  "Pickens",
  "Lumpkin",
  "Dawson",
  "Cherokee",
  "Clayton",
  "Cobb",
  "DeKalb",
  "Douglas",
  "Fayette",
  "Forsyth",
  "Fulton",
  "Gwinnett",
  "Henry",
  "Newton",
  "Rockdale",
  "Walton",
];

const RESEARCH_SOURCE_TEMPLATES: Array<Pick<CountyResearchSource, "category" | "source_name" | "instructions"> & { query: string }> = [
  { category: "gis", source_name: "County GIS / parcel viewer", query: "county GIS parcel viewer", instructions: "Find the parcel map, parcel card, acreage, owner, parcel ID, and map link." },
  { category: "tax", source_name: "County tax assessor", query: "county tax assessor property search", instructions: "Verify assessed value, tax year, tax amount, exemptions, and delinquency clues." },
  { category: "zoning", source_name: "County zoning / planning", query: "county zoning map planning department", instructions: "Verify zoning, future land use, minimum lot size, and subdivision constraints." },
  { category: "comps", source_name: "County sales records", query: "county land sales records assessor", instructions: "Look for vacant land sales and save clean sold comps with source links." },
];

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function countyName(value: string | null | undefined): string {
  return (value || "").replace(/\s+county$/i, "").trim();
}

function countySearchUrl(county: string, state: string, query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${county} County ${state} ${query}`)}`;
}

export function getCountyResearchSources(lead: Pick<ImportedLandLead, "county" | "state" | "latitude" | "longitude" | "property_address" | "parcel_id">): CountyResearchSource[] {
  const county = countyName(lead.county);
  const state = lead.state || "GA";
  const supported = state.toUpperCase() === "GA" && GEORGIA_RESEARCH_COUNTIES.some(name => name.toLowerCase() === county.toLowerCase());
  const localSources = supported
    ? RESEARCH_SOURCE_TEMPLATES.map(source => ({
      county,
      state,
      category: source.category,
      source_name: source.source_name,
      source_url: countySearchUrl(county, state, source.query),
      instructions: source.instructions,
    }))
    : [];

  const locationQuery = [lead.property_address, lead.parcel_id, county ? `${county} County` : null, state].filter(Boolean).join(" ");
  const nationalSources: CountyResearchSource[] = [
    {
      county: county || "Unknown",
      state,
      category: "flood",
      source_name: "FEMA flood map",
      source_url: "https://msc.fema.gov/portal/search",
      instructions: "Search the address or coordinates and record flood zone, floodway, and map panel evidence.",
    },
    {
      county: county || "Unknown",
      state,
      category: "wetlands",
      source_name: "USFWS Wetlands Mapper",
      source_url: "https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper",
      instructions: "Check mapped wetlands on or near the parcel and record rough impact.",
    },
    {
      county: county || "Unknown",
      state,
      category: "access",
      source_name: "Google Maps / road access",
      source_url: `https://www.google.com/maps/search/${encodeURIComponent(locationQuery || `${county} County ${state}`)}`,
      instructions: "Confirm visible road frontage, driveway potential, and whether the parcel appears landlocked.",
    },
    {
      county: county || "Unknown",
      state,
      category: "utilities",
      source_name: "Utility availability search",
      source_url: countySearchUrl(county || "Georgia", state, "water sewer utility availability GIS"),
      instructions: "Look for water, sewer, power, or septic clues and save the source link.",
    },
  ];

  return [...localSources, ...nationalSources];
}

export function generateLandDueDiligenceChecklist(lead: ImportedLandLead): LandDueDiligenceItem[] {
  const now = new Date().toISOString();
  const sourceByCategory = getCountyResearchSources(lead).reduce<Partial<Record<LandDueDiligenceCategory, CountyResearchSource>>>((acc, source) => {
    if (!acc[source.category]) acc[source.category] = source;
    return acc;
  }, {});
  const items: Array<{ category: LandDueDiligenceCategory; title: string; summary?: string | null; evidence?: string | null }> = [
    { category: "gis", title: "Open county GIS and confirm parcel identity", summary: lead.parcel_link ? "Parcel link imported from source file." : null, evidence: lead.parcel_id || null },
    { category: "access", title: "Confirm road frontage and landlocked risk", summary: lead.is_land_locked ? "Imported data says landlocked." : lead.road_frontage_ft ? "Road frontage imported." : null, evidence: lead.road_frontage_ft ? `${lead.road_frontage_ft} ft` : lead.is_land_locked ? "Landlocked flag" : null },
    { category: "flood", title: "Check FEMA flood zone", summary: lead.flood_zone_percent ? "Flood data imported from source file." : null, evidence: lead.flood_zone_percent != null ? `${lead.flood_zone_percent}%${lead.flood_zone_type ? ` · ${lead.flood_zone_type}` : ""}` : null },
    { category: "wetlands", title: "Check wetlands impact", summary: lead.wetlands_percent ? "Wetlands data imported from source file." : null, evidence: lead.wetlands_percent != null ? `${lead.wetlands_percent}%` : null },
    { category: "zoning", title: "Verify zoning, future land use, and minimum lot size", summary: lead.zoning ? "Zoning imported from source file." : null, evidence: [lead.zoning, lead.min_lot_size_acres ? `${lead.min_lot_size_acres} min acres` : null].filter(Boolean).join(" · ") || null },
    { category: "tax", title: "Verify assessed value, taxes, and delinquency", summary: lead.tax_delinquent ? "Tax delinquency imported from source file." : null, evidence: [lead.assessed_value ? `$${lead.assessed_value.toLocaleString()}` : null, lead.property_tax ? `$${lead.property_tax.toLocaleString()} tax` : null, lead.tax_delinquent ? "Delinquent" : null].filter(Boolean).join(" · ") || null },
    { category: "comps", title: "Add at least three sold land comps", summary: lead.market_value_estimate_comp_count ? "Land Insights comp count imported." : null, evidence: lead.market_value_estimate_comp_count ? `${lead.market_value_estimate_comp_count} LI comps` : null },
    { category: "comps", title: "Add active listing comps and check PPA support", summary: lead.market_value_estimate_ppa ? "Imported PPA estimate available." : null, evidence: lead.market_value_estimate_ppa ? `$${Math.round(lead.market_value_estimate_ppa).toLocaleString()}/ac` : null },
    { category: "ownership", title: "Confirm seller/owner and mailing address", summary: lead.owner_name ? "Owner imported from source file." : null, evidence: [lead.owner_name, lead.mailing_address].filter(Boolean).join(" · ") || null },
    { category: "notes", title: "Check elevation/topography risk", summary: lead.topography || lead.bad_topography ? "Topography data imported from source file." : null, evidence: [lead.topography, lead.bad_topography ? "Bad topography flag" : null].filter(Boolean).join(" · ") || null },
    { category: "notes", title: "Check soil/septic risk", summary: null, evidence: null },
    { category: "utilities", title: "Check utility availability", summary: null, evidence: null },
  ];

  return items.map((item, index) => {
    const source = sourceByCategory[item.category];
    const hasEvidence = !!item.evidence || item.summary?.includes("imported");
    return {
      id: `template-${lead.id}-${item.category}-${index}`,
      lead_id: lead.id,
      category: item.category,
      title: item.title,
      status: hasEvidence ? "in-progress" : "todo",
      result_summary: item.summary ?? null,
      source_name: source?.source_name ?? null,
      source_url: source?.source_url ?? null,
      evidence_value: item.evidence ?? null,
      verified_by: null,
      verified_at: null,
      notes: source?.instructions ?? null,
      sort_order: index + 1,
      created_at: now,
      updated_at: now,
    };
  });
}

export function summarizeLandComps(comps: LandCompRecord[]) {
  const usable = comps.filter(comp => comp.include_in_valuation && typeof comp.price_per_acre === "number" && comp.price_per_acre > 0);
  const ppas = usable.map(comp => comp.price_per_acre as number).sort((a, b) => a - b);
  const averagePpa = ppas.length ? Math.round(ppas.reduce((sum, value) => sum + value, 0) / ppas.length) : null;
  const medianPpa = ppas.length ? Math.round(ppas[Math.floor(ppas.length / 2)]) : null;
  const soldCount = usable.filter(comp => comp.comp_type === "sold").length;
  const activeCount = usable.filter(comp => comp.comp_type === "active").length;
  return {
    usableCount: usable.length,
    soldCount,
    activeCount,
    averagePpa,
    medianPpa,
    trusted: soldCount >= 3,
  };
}

function normalizeCompKeyText(value: string | null | undefined): string {
  return normalizeIdentityText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCompSourceUrl(value: string | null | undefined): string | null {
  const text = clean(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return text.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function buildLandCompKey(input: {
  leadId?: string | null;
  sourceUrl?: string | null;
  parcelId?: string | null;
  address?: string | null;
  county?: string | null;
  state?: string | null;
  price?: number | null;
  acreage?: number | null;
  fallbackId?: string | null;
}): string {
  const sourceUrl = normalizeCompSourceUrl(input.sourceUrl);
  if (sourceUrl) return `url:${sourceUrl}`;
  const state = normalizeCompKeyText(input.state);
  const county = normalizeCompKeyText(input.county).replace(/\s+county$/, "");
  const parcel = normalizeCompKeyText(input.parcelId);
  if (parcel) return `parcel:${state}:${county}:${parcel}`;
  const address = normalizeCompKeyText(input.address);
  if (address) return `addr:${state}:${county}:${address}`;
  return `manual:${input.leadId || "unknown"}:${input.fallbackId || Date.now()}`;
}

function mergeListingDetails(...details: Array<ListingDetails | null | undefined>): ListingDetails {
  return details.reduce<ListingDetails>((acc, detail) => {
    Object.entries(detail || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim()) acc[key] = value;
    });
    return acc;
  }, {});
}

function compRawData(input: LandCompInput, hints: ListingUrlHints, listingDetails: ListingDetails, pricePerAcre: number | null): Record<string, unknown> {
  const detailFields = Object.entries(listingDetails).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value !== null && value !== undefined && String(value).trim()) acc[`Listing ${key}`] = String(value);
    return acc;
  }, {});
  return {
    ...(input.rawData || {}),
    "Comp Role": "Reusable comp",
    "Comp Type": input.compType,
    "Comp Address": input.address?.trim() || hints.propertyAddress || "",
    "Comp Parcel ID": input.parcelId?.trim() || hints.parcelId || "",
    "Comp County": input.county?.trim() || hints.county || "",
    "Comp City": input.city?.trim() || hints.city || "",
    "Comp State": input.state?.trim() || hints.state || "",
    "Comp Zip": input.zip?.trim() || hints.zip || "",
    "Comp Price": input.price ?? hints.askingPrice ?? "",
    "Comp Acres": input.acreage ?? hints.acreage ?? "",
    "Comp PPA": pricePerAcre ?? "",
    "Comp Sale/List Date": input.saleOrListDate || hints.listingDate || "",
    "Comp Source System": input.sourceSystem?.trim() || inferLandLeadSourceFromUrl(input.sourceUrl || ""),
    "Comp Source URL": input.sourceUrl?.trim() || "",
    "Comp Source MLS": hints.sourceMls || "",
    "Comp Listing Description": hints.listingDescription || "",
    "Comp Listing Text": input.listingText?.trim() || "",
    ...detailFields,
  };
}

function landCompRecordFromParts(property: LandCompProperty, link: LandCompLink | null, leadId: string): LandCompRecord {
  return {
    id: link?.id || property.id,
    lead_id: leadId,
    link_id: link?.id || null,
    comp_property_id: property.id,
    comp_key: property.comp_key,
    comp_type: property.comp_type,
    address: property.address,
    parcel_id: property.parcel_id,
    county: property.county,
    city: property.city,
    state: property.state,
    zip: property.zip,
    latitude: property.latitude,
    longitude: property.longitude,
    price: property.price,
    acreage: property.acreage,
    price_per_acre: property.price_per_acre,
    sale_or_list_date: property.sale_or_list_date,
    distance_miles: link?.distance_miles ?? null,
    similarity_score: link?.similarity_score ?? null,
    relationship_status: link?.relationship_status ?? null,
    match_reason: link?.match_reason ?? null,
    source_system: property.source_system,
    source_url: property.source_url,
    listing_text: property.listing_text,
    listing_details: property.listing_details,
    raw_data: property.raw_data,
    similarity_notes: link?.similarity_notes ?? null,
    adjustment_notes: link?.adjustment_notes ?? null,
    include_in_valuation: link?.include_in_valuation ?? false,
    confidence: link?.confidence ?? "needs-review",
    created_by: link?.created_by || property.created_by,
    created_at: link?.created_at || property.created_at,
    updated_at: link?.updated_at || property.updated_at,
  };
}

function legacyLandCompKey(comp: LandCompRecord): string {
  return buildLandCompKey({
    leadId: comp.lead_id,
    sourceUrl: comp.source_url,
    parcelId: comp.parcel_id,
    address: comp.address,
    county: comp.county,
    state: comp.state,
    price: comp.price,
    acreage: comp.acreage,
    fallbackId: comp.id,
  });
}

function scorePotentialLandComp(lead: ImportedLandLead, comp: LandCompProperty): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const leadCounty = countyName(lead.county).toLowerCase();
  const compCounty = countyName(comp.county).toLowerCase();
  if (lead.state && comp.state && lead.state.toLowerCase() === comp.state.toLowerCase()) {
    score += 10;
    reasons.push("same state");
  }
  if (leadCounty && compCounty && leadCounty === compCounty) {
    score += 35;
    reasons.push("same county");
  }
  if (lead.zip && comp.zip && lead.zip === comp.zip) {
    score += 20;
    reasons.push("same ZIP");
  }
  if (lead.acreage && comp.acreage) {
    const ratio = Math.min(lead.acreage, comp.acreage) / Math.max(lead.acreage, comp.acreage);
    if (ratio >= 0.75) {
      score += 25;
      reasons.push("very similar acreage");
    } else if (ratio >= 0.45) {
      score += 15;
      reasons.push("workable acreage range");
    } else if (ratio >= 0.25) {
      score += 7;
      reasons.push("loose acreage range");
    }
  }
  if (comp.comp_type === "sold") {
    score += 15;
    reasons.push("sold comp");
  } else if (["active", "pending"].includes(comp.comp_type)) {
    score += 8;
    reasons.push(`${labelForPlainStatus(comp.comp_type)} market signal`);
  }
  if (comp.price_per_acre) {
    score += 5;
    reasons.push("has PPA");
  }
  return { score, reason: reasons.join(" · ") || "Saved comp record" };
}

function labelForPlainStatus(value: string): string {
  return value.replace(/-/g, " ");
}

export async function fetchLandDueDiligenceItems(lead: ImportedLandLead): Promise<LandDueDiligenceItem[]> {
  if (!supabase) {
    const rows = localGet<LandDueDiligenceItem[]>(LOCAL_DUE_DILIGENCE, [])
      .filter(row => row.lead_id === lead.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    return rows.length ? rows : generateLandDueDiligenceChecklist(lead);
  }
  const { data, error } = await supabase
    .from("meridian_land_due_diligence_items")
    .select("*")
    .eq("lead_id", lead.id)
    .order("sort_order");
  if (error || !data || data.length === 0) return generateLandDueDiligenceChecklist(lead);
  return data as LandDueDiligenceItem[];
}

export async function saveLandDueDiligenceItem(
  lead: ImportedLandLead,
  item: LandDueDiligenceItem,
  patch: Partial<Pick<LandDueDiligenceItem, "status" | "result_summary" | "evidence_value" | "notes" | "source_url" | "source_name">>,
  actor?: string | null,
): Promise<{ item: LandDueDiligenceItem | null; error: string | null }> {
  const now = new Date().toISOString();
  const next: LandDueDiligenceItem = {
    ...item,
    ...patch,
    verified_by: patch.status === "verified" ? actor || item.verified_by : item.verified_by,
    verified_at: patch.status === "verified" ? now : item.verified_at,
    updated_at: now,
  };
  const isTemplate = item.id.startsWith("template-");
  if (!supabase) {
    const rows = localGet<LandDueDiligenceItem[]>(LOCAL_DUE_DILIGENCE, []);
    const saved = isTemplate ? { ...next, id: makeId("dd"), created_at: now } : next;
    localSet(LOCAL_DUE_DILIGENCE, [saved, ...rows.filter(row => row.id !== item.id && row.id !== saved.id)]);
    return { item: saved, error: null };
  }
  if (isTemplate) {
    const { data, error } = await supabase
      .from("meridian_land_due_diligence_items")
      .insert({
        lead_id: lead.id,
        category: next.category,
        title: next.title,
        status: next.status,
        result_summary: next.result_summary,
        source_name: next.source_name,
        source_url: next.source_url,
        evidence_value: next.evidence_value,
        verified_by: next.verified_by,
        verified_at: next.verified_at,
        notes: next.notes,
        sort_order: next.sort_order,
      })
      .select()
      .single();
    return { item: data as LandDueDiligenceItem | null, error: error?.message ?? null };
  }
  const { data, error } = await supabase
    .from("meridian_land_due_diligence_items")
    .update({
      status: next.status,
      result_summary: next.result_summary,
      source_name: next.source_name,
      source_url: next.source_url,
      evidence_value: next.evidence_value,
      verified_by: next.verified_by,
      verified_at: next.verified_at,
      notes: next.notes,
      updated_at: now,
    })
    .eq("id", item.id)
    .select()
    .single();
  return { item: data as LandDueDiligenceItem | null, error: error?.message ?? null };
}

export async function fetchLandCompRecords(leadId: string): Promise<LandCompRecord[]> {
  const legacyRows = async (): Promise<LandCompRecord[]> => {
    if (!supabase) {
      return localGet<LandCompRecord[]>(LOCAL_COMPS, [])
        .filter(row => row.lead_id === leadId)
        .sort((a, b) => (b.sale_or_list_date || b.created_at).localeCompare(a.sale_or_list_date || a.created_at));
    }
    const { data, error } = await supabase
      .from("meridian_land_comp_records")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as LandCompRecord[];
  };

  if (!supabase) {
    const properties = localGet<LandCompProperty[]>(LOCAL_COMP_PROPERTIES, []);
    const links = localGet<LandCompLink[]>(LOCAL_COMP_LINKS, []).filter(row => row.lead_id === leadId);
    const linked = links
      .map(link => {
        const property = properties.find(row => row.id === link.comp_property_id);
        return property ? landCompRecordFromParts(property, link, leadId) : null;
      })
      .filter((row): row is LandCompRecord => !!row);
    const linkedKeys = new Set(linked.map(row => row.comp_key).filter(Boolean));
    const legacy = (await legacyRows()).filter(row => !linkedKeys.has(legacyLandCompKey(row)));
    return [...linked, ...legacy].sort((a, b) => (b.sale_or_list_date || b.created_at).localeCompare(a.sale_or_list_date || a.created_at));
  }

  const legacy = await legacyRows();
  const { data: links, error: linkError } = await supabase
    .from("meridian_land_comp_links")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (linkError || !links) return legacy;

  const propertyIds = Array.from(new Set((links as LandCompLink[]).map(row => row.comp_property_id).filter(Boolean)));
  if (!propertyIds.length) return legacy;

  const { data: properties, error: propertyError } = await supabase
    .from("meridian_land_comp_properties")
    .select("*")
    .in("id", propertyIds);
  if (propertyError || !properties) return legacy;

  const propertyById = new Map((properties as LandCompProperty[]).map(property => [property.id, property]));
  const linked = (links as LandCompLink[])
    .map(link => {
      const property = propertyById.get(link.comp_property_id);
      return property ? landCompRecordFromParts(property, link, leadId) : null;
    })
    .filter((row): row is LandCompRecord => !!row);
  const linkedKeys = new Set(linked.map(row => row.comp_key).filter(Boolean));
  const fallbackLegacy = legacy.filter(row => !linkedKeys.has(legacyLandCompKey(row)));
  return [...linked, ...fallbackLegacy].sort((a, b) => (b.sale_or_list_date || b.created_at).localeCompare(a.sale_or_list_date || a.created_at));
}

export async function createLandCompRecord(input: LandCompInput): Promise<{ comp: LandCompRecord | null; error: string | null }> {
  const now = new Date().toISOString();
  const textHints = listingTextHints(input.listingText || "");
  const price = input.price ?? textHints.askingPrice ?? null;
  const acreage = input.acreage ?? textHints.acreage ?? null;
  const pricePerAcre = price && acreage && acreage > 0
    ? Math.round(price / acreage)
    : null;
  const listingDetails = mergeListingDetails(textHints.listingDetails, input.listingDetails);
  const rawData = compRawData(input, textHints, listingDetails, pricePerAcre);
  const compKey = buildLandCompKey({
    leadId: input.leadId,
    sourceUrl: input.sourceUrl,
    parcelId: input.parcelId || textHints.parcelId,
    address: input.address || textHints.propertyAddress,
    county: input.county || textHints.county,
    state: input.state || textHints.state,
    price,
    acreage,
  });
  const propertyRow = {
    comp_key: compKey,
    comp_type: input.compType,
    address: input.address?.trim() || textHints.propertyAddress || null,
    parcel_id: input.parcelId?.trim() || textHints.parcelId || null,
    county: input.county?.trim() || textHints.county || null,
    city: input.city?.trim() || textHints.city || null,
    state: input.state?.trim() || textHints.state || null,
    zip: input.zip?.trim() || textHints.zip || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    price,
    acreage,
    price_per_acre: pricePerAcre,
    sale_or_list_date: input.saleOrListDate || textHints.listingDate || null,
    source_system: input.sourceSystem?.trim() || inferLandLeadSourceFromUrl(input.sourceUrl || ""),
    source_url: input.sourceUrl?.trim() || null,
    listing_text: input.listingText?.trim() || null,
    listing_details: listingDetails,
    raw_data: rawData,
    created_by: input.actor || null,
    updated_at: now,
  };
  const linkPatch = {
    lead_id: input.leadId,
    relationship_status: input.relationshipStatus || "accepted",
    distance_miles: input.distanceMiles ?? null,
    similarity_score: input.similarityScore ?? null,
    match_reason: input.matchReason?.trim() || null,
    similarity_notes: input.similarityNotes?.trim() || null,
    adjustment_notes: input.adjustmentNotes?.trim() || null,
    include_in_valuation: input.includeInValuation ?? true,
    confidence: input.confidence || "needs-review",
    created_by: input.actor || null,
    updated_at: now,
  };
  const row = {
    lead_id: input.leadId,
    comp_type: input.compType,
    address: propertyRow.address,
    parcel_id: propertyRow.parcel_id,
    county: propertyRow.county,
    state: propertyRow.state,
    price,
    acreage,
    price_per_acre: pricePerAcre,
    sale_or_list_date: propertyRow.sale_or_list_date,
    distance_miles: input.distanceMiles ?? null,
    source_system: propertyRow.source_system,
    source_url: propertyRow.source_url,
    similarity_notes: input.similarityNotes?.trim() || null,
    adjustment_notes: input.adjustmentNotes?.trim() || null,
    include_in_valuation: input.includeInValuation ?? true,
    confidence: input.confidence || "needs-review",
    created_by: input.actor || null,
  };
  if (!supabase) {
    const existingProperty = input.compPropertyId
      ? localGet<LandCompProperty[]>(LOCAL_COMP_PROPERTIES, []).find(property => property.id === input.compPropertyId) || null
      : null;
    const effectivePropertyRow = existingProperty || propertyRow;
    const comp: LandCompRecord = {
      ...row,
      id: makeId("comp"),
      link_id: makeId("comp-link"),
      comp_property_id: existingProperty?.id || input.compPropertyId || makeId("comp-property"),
      comp_key: existingProperty?.comp_key || compKey,
      comp_type: effectivePropertyRow.comp_type as LandCompType,
      address: effectivePropertyRow.address,
      parcel_id: effectivePropertyRow.parcel_id,
      county: effectivePropertyRow.county,
      city: effectivePropertyRow.city,
      state: effectivePropertyRow.state,
      zip: effectivePropertyRow.zip,
      latitude: effectivePropertyRow.latitude,
      longitude: effectivePropertyRow.longitude,
      price: effectivePropertyRow.price,
      acreage: effectivePropertyRow.acreage,
      price_per_acre: effectivePropertyRow.price_per_acre,
      sale_or_list_date: effectivePropertyRow.sale_or_list_date,
      source_system: effectivePropertyRow.source_system,
      source_url: effectivePropertyRow.source_url,
      similarity_score: linkPatch.similarity_score,
      relationship_status: linkPatch.relationship_status as LandCompRelationshipStatus,
      match_reason: linkPatch.match_reason,
      listing_text: effectivePropertyRow.listing_text,
      listing_details: effectivePropertyRow.listing_details,
      raw_data: effectivePropertyRow.raw_data,
      confidence: row.confidence as LandCompConfidence,
      created_at: now,
      updated_at: now,
    };
    const properties = localGet<LandCompProperty[]>(LOCAL_COMP_PROPERTIES, []);
    const property: LandCompProperty = {
      ...effectivePropertyRow,
      id: comp.comp_property_id || makeId("comp-property"),
      comp_type: effectivePropertyRow.comp_type as LandCompType,
      comp_key: comp.comp_key || compKey,
      listing_details: effectivePropertyRow.listing_details,
      raw_data: effectivePropertyRow.raw_data,
      created_at: existingProperty?.created_at || now,
      updated_at: now,
    };
    const link: LandCompLink = {
      ...linkPatch,
      id: comp.link_id || makeId("comp-link"),
      comp_property_id: property.id,
      relationship_status: linkPatch.relationship_status as LandCompRelationshipStatus,
      confidence: linkPatch.confidence as LandCompConfidence,
      created_at: now,
      updated_at: now,
    };
    localSet(LOCAL_COMP_PROPERTIES, [property, ...properties.filter(row => row.id !== property.id && row.comp_key !== property.comp_key)]);
    localSet(LOCAL_COMP_LINKS, [link, ...localGet<LandCompLink[]>(LOCAL_COMP_LINKS, []).filter(row => !(row.lead_id === link.lead_id && row.comp_property_id === link.comp_property_id))]);
    return { comp, error: null };
  }

  let property: LandCompProperty | null = null;
  if (input.compPropertyId) {
    const { data, error } = await supabase
      .from("meridian_land_comp_properties")
      .select("*")
      .eq("id", input.compPropertyId)
      .maybeSingle();
    if (error) return await createLegacyLandCompRecord(row);
    property = data as LandCompProperty | null;
  }
  if (!property) {
    const { data, error } = await supabase
      .from("meridian_land_comp_properties")
      .upsert(propertyRow, { onConflict: "comp_key" })
      .select()
      .single();
    if (error || !data) return await createLegacyLandCompRecord(row, error?.message);
    property = data as LandCompProperty;
  }

  const { data: linkData, error: linkError } = await supabase
    .from("meridian_land_comp_links")
    .upsert({ ...linkPatch, comp_property_id: property.id }, { onConflict: "lead_id,comp_property_id" })
    .select()
    .single();
  if (linkError || !linkData) return await createLegacyLandCompRecord(row, linkError?.message);
  return { comp: landCompRecordFromParts(property, linkData as LandCompLink, input.leadId), error: null };
}

async function createLegacyLandCompRecord(row: Record<string, unknown>, underlyingError?: string | null): Promise<{ comp: LandCompRecord | null; error: string | null }> {
  if (!supabase) return { comp: null, error: underlyingError || "Supabase is not configured." };
  const { data, error } = await supabase
    .from("meridian_land_comp_records")
    .insert(row)
    .select()
    .single();
  return { comp: data as LandCompRecord | null, error: error?.message ?? (data ? null : underlyingError ?? null) };
}

export async function linkLandCompToLead(input: {
  leadId: string;
  comp: LandCompRecord;
  actor?: string | null;
  confidence?: LandCompConfidence;
  includeInValuation?: boolean;
}): Promise<{ comp: LandCompRecord | null; error: string | null }> {
  if (!input.comp.comp_property_id) return { comp: null, error: "This comp cannot be linked because it is missing a reusable comp record." };
  return createLandCompRecord({
    leadId: input.leadId,
    compPropertyId: input.comp.comp_property_id,
    compType: input.comp.comp_type,
    relationshipStatus: "accepted",
    distanceMiles: input.comp.distance_miles,
    similarityScore: input.comp.similarity_score,
    matchReason: input.comp.match_reason,
    similarityNotes: input.comp.similarity_notes || input.comp.match_reason,
    adjustmentNotes: input.comp.adjustment_notes,
    includeInValuation: input.includeInValuation ?? true,
    confidence: input.confidence || input.comp.confidence || "needs-review",
    actor: input.actor,
  });
}

export async function fetchPotentialLandCompRecords(lead: ImportedLandLead, existingComps: LandCompRecord[] = []): Promise<LandCompRecord[]> {
  const existingPropertyIds = new Set(existingComps.map(comp => comp.comp_property_id).filter(Boolean));
  const leadState = lead.state || "GA";
  const leadCounty = countyName(lead.county).toLowerCase();
  const buildCandidates = (properties: LandCompProperty[]) => properties
    .filter(property => property.id && !existingPropertyIds.has(property.id))
    .map(property => {
      const match = scorePotentialLandComp(lead, property);
      return { property, ...match };
    })
    .filter(candidate => {
      const compCounty = countyName(candidate.property.county).toLowerCase();
      return candidate.score >= 35 || (!!leadCounty && leadCounty === compCounty);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(candidate => landCompRecordFromParts(candidate.property, {
      id: `potential-${candidate.property.id}`,
      lead_id: lead.id,
      comp_property_id: candidate.property.id,
      relationship_status: "potential",
      distance_miles: null,
      similarity_score: candidate.score,
      match_reason: candidate.reason,
      similarity_notes: null,
      adjustment_notes: null,
      include_in_valuation: false,
      confidence: "needs-review",
      created_by: null,
      created_at: candidate.property.created_at,
      updated_at: candidate.property.updated_at,
    }, lead.id));

  if (!supabase) {
    const properties = localGet<LandCompProperty[]>(LOCAL_COMP_PROPERTIES, []);
    return buildCandidates(properties.filter(property => !leadState || !property.state || property.state.toLowerCase() === leadState.toLowerCase()));
  }

  let query = supabase
    .from("meridian_land_comp_properties")
    .select("*")
    .limit(250);
  if (leadState) query = query.eq("state", leadState);
  const { data, error } = await query;
  if (error || !data) return [];
  return buildCandidates(data as LandCompProperty[]);
}

function matchingResearchItem(items: LandDueDiligenceItem[], finding: AutomatedLandResearchFinding): LandDueDiligenceItem | null {
  const exact = items.find(item => item.category === finding.category && item.title.toLowerCase() === finding.title.toLowerCase());
  if (exact) return exact;
  const categoryMatch = items.find(item => item.category === finding.category);
  return categoryMatch ?? null;
}

export async function runAutomatedLandResearch(
  lead: ImportedLandLead,
  items: LandDueDiligenceItem[],
  actor?: string | null,
): Promise<{ result: AutomatedLandResearchResult | null; items: LandDueDiligenceItem[]; lead: ImportedLandLead | null; error: string | null }> {
  let response: Response;
  try {
    response = await fetch("/api/land-research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead }),
    });
  } catch (error) {
    return {
      result: null,
      items,
      lead,
      error: `Automatic research could not start: ${error instanceof Error ? error.message : "network error"}`,
    };
  }

  const payload = await response.json().catch(() => ({})) as AutomatedLandResearchResult;
  if (!response.ok || payload.error) {
    return { result: payload, items, lead, error: payload.error || response.statusText || "Automatic research failed." };
  }

  let nextItems = [...items];
  for (const finding of payload.findings) {
    const item = matchingResearchItem(nextItems, finding);
    if (!item) continue;
    const saved = await saveLandDueDiligenceItem(lead, item, {
      status: finding.status,
      result_summary: finding.result_summary,
      evidence_value: finding.evidence_value,
      source_name: finding.source_name,
      source_url: finding.source_url,
      notes: [
        finding.blocker ? `Blocker: ${finding.blocker}` : "",
        `Auto research confidence: ${finding.confidence}.`,
        item.notes,
      ].filter(Boolean).join("\n"),
    }, actor);
    if (saved.error) {
      return { result: payload, items: nextItems, lead, error: saved.error };
    }
    if (saved.item) {
      nextItems = nextItems.map(row => row.id === item.id ? saved.item as LandDueDiligenceItem : row);
    }
  }

  const updated = await updateImportedLandLeadFromResearch(lead, payload);
  if (updated.error) {
    return { result: payload, items: nextItems, lead, error: updated.error };
  }
  if (updated.lead) {
    const fieldRows = await insertFieldValueRowsInChunks([updated.lead], [updated.lead]);
    if (fieldRows.error) {
      return { result: payload, items: nextItems, lead: updated.lead, error: fieldRows.error.message ?? "Automatic research saved, but source fields were not refreshed." };
    }
    const underwriting = await upsertLandUnderwritingForLeads([updated.lead]);
    if (underwriting.error) {
      return { result: payload, items: nextItems, lead: updated.lead, error: underwriting.error };
    }
  }

  return { result: payload, items: nextItems.sort((a, b) => a.sort_order - b.sort_order), lead: updated.lead, error: null };
}

function statusLabel(value: string): string {
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function rawTextValue(raw: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  for (const key of keys) {
    const value = clean(raw?.[key]);
    if (value) return value;
  }
  return null;
}

export function importedLeadDealPropertyType(lead: ImportedLandLead): DealPropertyType {
  const explicit = rawTextValue(lead.raw_data, ["Deal Property Type", "Listing Deal Property Type"]);
  if (explicit && ["land", "house", "rental", "commercial", "other"].includes(explicit)) return explicit as DealPropertyType;
  const text = [
    lead.land_use,
    rawTextValue(lead.raw_data, ["Listing Property Type", "Listing Home Type", "Listing Property Subtype", "Listing Condition"]),
    lead.raw_data?.["Listing Listing Section Snapshot"],
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(commercial|retail|industrial|office|mixed use|warehouse)\b/.test(text)) return "commercial";
  if (/\b(duplex|triplex|quadplex|multi[-\s]?family|apartment|apartments)\b/.test(text)) return "rental";
  if (/\b(townhouse|townhome|single family|single-family|condo|condominium|manufactured home|mobile home|new construction|buildable plan)\b/.test(text)) return "house";
  if (/\b(residential lot|lot\s*\/\s*land|lot\/land|vacant land|unimproved land|acreage|farm|land)\b/.test(text)) return "land";
  return "land";
}

function nonLandDealDraft(lead: ImportedLandLead, propertyType: DealPropertyType): Partial<DealInput> & { linksText?: string } {
  const title = lead.property_address || rawTextValue(lead.raw_data, ["Listing Primary Address"]) || lead.parcel_id || `${lead.owner_name || "Imported"} property lead`;
  const location = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
  const typeLabel = statusLabel(propertyType);
  const strategy = propertyType === "house"
    ? "residential review"
    : propertyType === "rental"
      ? "rental income review"
      : propertyType === "commercial"
        ? "commercial review"
        : "property review";
  const listingDetails = [
    rawTextValue(lead.raw_data, ["Listing Home Type"]) ? `Home type: ${rawTextValue(lead.raw_data, ["Listing Home Type"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Property Subtype"]) ? `Subtype: ${rawTextValue(lead.raw_data, ["Listing Property Subtype"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Bedrooms"]) ? `Beds: ${rawTextValue(lead.raw_data, ["Listing Bedrooms"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Bathrooms"]) ? `Baths: ${rawTextValue(lead.raw_data, ["Listing Bathrooms"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Interior Livable Area"]) ? `Interior area: ${rawTextValue(lead.raw_data, ["Listing Interior Livable Area"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Builder Name"]) ? `Builder: ${rawTextValue(lead.raw_data, ["Listing Builder Name"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Community Name"]) ? `Community: ${rawTextValue(lead.raw_data, ["Listing Community Name"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Rent Zestimate"]) ? `Rent Zestimate: ${rawTextValue(lead.raw_data, ["Listing Rent Zestimate"])}` : "",
    rawTextValue(lead.raw_data, ["Listing Price History"]) ? "Price history captured from Zillow paste." : "",
  ].filter(Boolean).join("\n");
  return {
    title,
    source: lead.source_system,
    property_type: propertyType,
    strategy,
    status: "lead",
    urgency: "routine",
    address: location || lead.property_address || "",
    parcel_id: lead.parcel_id || "",
    seller_name: lead.owner_name || "",
    seller_phone: lead.phone || lead.phone_2 || "",
    asking_price: lead.asking_price,
    arv: lead.market_value ?? lead.asking_price ?? lead.assessed_value,
    acreage: lead.acreage,
    zoning: lead.zoning || "",
    road_frontage: lead.road_frontage_ft ? `${lead.road_frontage_ft} ft` : "",
    utilities: [rawTextValue(lead.raw_data, ["Listing Water"]), rawTextValue(lead.raw_data, ["Listing Sewer"]), rawTextValue(lead.raw_data, ["Listing Utilities"])].filter(Boolean).join(" · "),
    disposition_status: "not-started",
    exit_strategy: strategy,
    target_buyer_type: propertyType === "commercial" ? "Commercial buyer / operator" : propertyType === "rental" ? "Rental investor" : "Residential buyer / investor",
    target_resale_price: lead.market_value ?? lead.asking_price ?? null,
    minimum_acceptable_price: null,
    review_intent: "needs-info-review",
    requested_next_step: `Review this as a ${typeLabel.toLowerCase()} listing, not a vacant-land calculator lead.`,
    submit_uncertainties: "Confirm comps, condition, financing assumptions, HOA/community restrictions, and whether this is an acquisition candidate or market comp.",
    submission_summary: `${title} was classified from pasted listing text as ${typeLabel.toLowerCase()}. Land PPA calculators are not the right first review path for this record.`,
    notes: [
      `${typeLabel} listing summary:`,
      listingDetails,
      "",
      lead.notes,
      lead.land_use ? `Parsed use/type: ${lead.land_use}` : "",
      lead.property_url ? `Listing URL: ${lead.property_url}` : "",
    ].filter(Boolean).join("\n"),
    campaign_source: lead.campaign_source || "",
    linksText: lead.property_url || "",
  };
}

export function leadToDealDraft(lead: ImportedLandLead): Partial<DealInput> & { linksText?: string } {
  const title = lead.property_address || lead.parcel_id || `${lead.owner_name || "Imported"} land lead`;
  const location = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
  const propertyType = importedLeadDealPropertyType(lead);
  if (propertyType !== "land") return nonLandDealDraft(lead, propertyType);
  const underwriting = calculateLandUnderwriting(lead);
  const best = underwriting.best;
  const retail = underwriting.results.find(result => result.exitType === "retail-resale");
  const buyerTypeByExit: Partial<Record<LandExitType, string>> = {
    "retail-resale": "Retail land buyer",
    "neighbor-sale": "Adjacent owner",
    "land-flip": "Land investor",
    assignment: "Local investor / buyer list",
    subdivide: "Builder / developer",
    pass: "No buyer until blocker clears",
  };
  const calculatorNotes = [
    `Best exit: ${best.label} (${best.status}).`,
    best.maxOffer !== null ? `Max offer: ${best.maxOffer.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.` : "",
    best.requiredPpa !== null ? `Required PPA: ${best.requiredPpa.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.` : "",
    best.landInsightsPpa !== null ? `Land Insights PPA: ${best.landInsightsPpa.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.` : "",
    best.projectedSpread !== null ? `Projected spread: ${best.projectedSpread.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.` : "",
    best.blocker ? `Blocker: ${best.blocker}.` : "",
    `VA next step: ${best.nextStep}`,
  ].filter(Boolean).join("\n");
  return {
    title,
    source: lead.source_system,
    property_type: "land",
    strategy: best.exitType === "pass" ? "pass / blocked land lead" : best.label,
    status: "lead",
    urgency: best.status === "strong" ? "hot" : best.status === "possible" ? "time-sensitive" : "routine",
    address: location || lead.property_address || "",
    parcel_id: lead.parcel_id || "",
    seller_name: lead.owner_name || "",
    seller_phone: lead.phone || lead.phone_2 || "",
    asking_price: lead.asking_price ?? best.maxOffer,
    arv: best.requiredResaleValue ?? best.landInsightsValue ?? lead.market_value ?? lead.assessed_value,
    acreage: lead.acreage,
    zoning: lead.zoning || "",
    road_frontage: lead.road_frontage_ft ? `${lead.road_frontage_ft} ft` : "",
    utilities: "",
    disposition_status: best.exitType === "pass" ? "not-started" : "exit-strategy-set",
    exit_strategy: best.label,
    target_buyer_type: buyerTypeByExit[best.exitType] ?? "",
    target_resale_price: best.requiredResaleValue ?? best.landInsightsValue ?? null,
    minimum_acceptable_price: best.requiredResaleValue ?? null,
    closing_costs_estimate: underwriting.assumptions.closingCost,
    marketing_costs_estimate: best.exitType === "retail-resale" || best.exitType === "neighbor-sale"
      ? Math.round((best.requiredResaleValue ?? best.landInsightsValue ?? 0) * underwriting.assumptions.brokerCommissionPct)
      : null,
    desired_minimum_spread: underwriting.assumptions.targetSpread,
    calculator_notes: calculatorNotes,
    disposition_next_step: best.nextStep,
    buyer_demand_evidence: best.keyAssumption,
    review_intent: best.status === "pass" ? "blocked-decision" : "needs-info-review",
    requested_next_step: best.nextStep,
    submit_uncertainties: best.blocker || retail?.keyAssumption.includes("must be verified")
      ? [best.blocker ? `Clear blocker: ${best.blocker}` : "", "Verify sold land comps / PPA support."].filter(Boolean).join("\n")
      : "Verify comps, buyer demand, access, utilities, and county constraints before making a firm offer.",
    submission_summary: [
      `${best.label} is the current calculator-leading exit for this imported land lead.`,
      best.maxOffer !== null ? `Suggested max offer starts around ${best.maxOffer.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.` : "",
      best.requiredPpa !== null ? `Comps need to support about ${best.requiredPpa.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/acre for this to work.` : "",
      best.blocker ? `Current blocker: ${best.blocker}.` : "",
    ].filter(Boolean).join(" "),
    notes: [
      "Automatic underwriting summary:",
      calculatorNotes,
      "",
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
