import { createDefaultBuildAnalysis } from "./build-underwriting";
import type { CrmProperty } from "./crm";
import type { Deal, DealInput, DealPropertyType, DealUrgency } from "./deals";
import type { ImportedLandLead } from "./land-leads";

export type DealIntakeMatchSource = "va-lead" | "crm-property" | "deal";
export type DealIntakeMatchConfidence = "exact" | "strong" | "possible";

export interface DealIntakeMatch {
  id: string;
  source: DealIntakeMatchSource;
  confidence: DealIntakeMatchConfidence;
  score: number;
  label: string;
  address: string | null;
  parcel_id: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
  acreage: number | null;
  asking_price: number | null;
  market_value: number | null;
  zoning: string | null;
  land_use: string | null;
  status: string | null;
  deal_id: string | null;
  href: string | null;
  source_label: string;
  reasons: string[];
}

export interface DealIntakeInput {
  query?: string;
  property_type?: DealPropertyType;
  address?: string | null;
  parcel_id?: string | null;
  seller_name?: string | null;
  seller_phone?: string | null;
  listing_url?: string | null;
  asking_price?: number | null;
  acreage?: number | null;
  target_resale_price?: number | null;
  exit_strategy?: string | null;
  target_buyer_type?: string | null;
  buyer_demand_evidence?: string | null;
  notes?: string | null;
  urgency?: DealUrgency;
}

type ScoredMatch = DealIntakeMatch | null;

export function moneyToNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDealIntakeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeDealIntakeParcel(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeDealIntakePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeDealIntakeUrl(value: string | null | undefined): string {
  try {
    const url = new URL(value ?? "");
    url.hash = "";
    url.search = "";
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/g, "");
  } catch {
    return normalizeDealIntakeText(value);
  }
}

function confidenceFor(score: number): DealIntakeMatchConfidence {
  if (score >= 80) return "exact";
  if (score >= 55) return "strong";
  return "possible";
}

function includesEither(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length < 8 || b.length < 8) return false;
  return a.includes(b) || b.includes(a);
}

function scoreAddress(inputAddress: string, candidateAddress: string, reasons: string[]): number {
  if (!inputAddress || !candidateAddress) return 0;
  if (inputAddress === candidateAddress) {
    reasons.push("same address");
    return 85;
  }
  if (includesEither(inputAddress, candidateAddress)) {
    reasons.push("similar address");
    return 58;
  }
  return 0;
}

function scoreParcel(inputParcel: string, candidateParcel: string, reasons: string[]): number {
  if (!inputParcel || !candidateParcel) return 0;
  if (inputParcel === candidateParcel) {
    reasons.push("same parcel/APN");
    return 100;
  }
  if (includesEither(inputParcel, candidateParcel)) {
    reasons.push("similar parcel/APN");
    return 62;
  }
  return 0;
}

function scoreUrl(inputUrl: string, candidateUrl: string, reasons: string[]): number {
  if (!inputUrl || !candidateUrl) return 0;
  if (inputUrl === candidateUrl) {
    reasons.push("same listing/source link");
    return 90;
  }
  return 0;
}

function scoreQuery(input: DealIntakeInput, candidate: string, reasons: string[]): number {
  const query = normalizeDealIntakeText(input.query);
  if (!query || !candidate) return 0;
  if (query.length >= 8 && candidate.includes(query)) {
    reasons.push("matches pasted text");
    return 45;
  }
  return 0;
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function scoreLead(input: DealIntakeInput, lead: ImportedLandLead): ScoredMatch {
  const reasons: string[] = [];
  const inputAddress = normalizeDealIntakeText(input.address) || normalizeDealIntakeText(input.query);
  const inputParcel = normalizeDealIntakeParcel(input.parcel_id) || normalizeDealIntakeParcel(input.query);
  const inputPhone = normalizeDealIntakePhone(input.seller_phone);
  const inputUrl = normalizeDealIntakeUrl(input.listing_url) || normalizeDealIntakeUrl(input.query);
  const leadAddress = normalizeDealIntakeText(lead.property_address);
  const leadParcel = normalizeDealIntakeParcel(lead.parcel_id);
  const leadUrl = normalizeDealIntakeUrl(lead.property_url || lead.parcel_link || lead.google_map_url);
  const leadPhones = [normalizeDealIntakePhone(lead.phone), normalizeDealIntakePhone(lead.phone_2)].filter(phone => phone.length >= 7);
  let score = 0;

  score = Math.max(score, scoreParcel(inputParcel, leadParcel, reasons));
  score = Math.max(score, scoreUrl(inputUrl, leadUrl, reasons));
  score = Math.max(score, scoreAddress(inputAddress, leadAddress, reasons));
  score = Math.max(score, scoreQuery(input, [lead.property_address, lead.parcel_id, lead.owner_name, lead.county].map(normalizeDealIntakeText).join(" "), reasons));
  if (inputPhone && leadPhones.includes(inputPhone)) {
    reasons.push("same seller phone");
    score = Math.max(score, 70);
  }

  if (score < 30) return null;
  return {
    id: lead.id,
    source: "va-lead",
    confidence: confidenceFor(score),
    score,
    label: lead.property_address || lead.parcel_id || lead.owner_name || "VA property record",
    address: lead.property_address,
    parcel_id: lead.parcel_id,
    county: lead.county,
    city: lead.city,
    state: lead.state,
    acreage: lead.acreage,
    asking_price: lead.asking_price,
    market_value: lead.market_value ?? lead.total_parcel_value ?? null,
    zoning: lead.zoning,
    land_use: lead.land_use,
    status: lead.status,
    deal_id: lead.deal_id,
    href: lead.deal_id ? `/opportunity?deal=${lead.deal_id}` : `/lead/${lead.id}`,
    source_label: "VA property record",
    reasons: dedupeReasons(reasons),
  };
}

function scoreCrmProperty(input: DealIntakeInput, property: CrmProperty): ScoredMatch {
  const reasons: string[] = [];
  const inputAddress = normalizeDealIntakeText(input.address) || normalizeDealIntakeText(input.query);
  const inputParcel = normalizeDealIntakeParcel(input.parcel_id) || normalizeDealIntakeParcel(input.query);
  const propertyAddress = normalizeDealIntakeText(property.address);
  const propertyParcel = normalizeDealIntakeParcel(property.parcel_id);
  let score = 0;

  score = Math.max(score, scoreParcel(inputParcel, propertyParcel, reasons));
  score = Math.max(score, scoreAddress(inputAddress, propertyAddress, reasons));
  score = Math.max(score, scoreQuery(input, [property.address, property.parcel_id, property.county].map(normalizeDealIntakeText).join(" "), reasons));

  if (score < 30) return null;
  return {
    id: property.id,
    source: "crm-property",
    confidence: confidenceFor(score),
    score,
    label: property.address || property.parcel_id || "CRM property record",
    address: property.address,
    parcel_id: property.parcel_id,
    county: property.county,
    city: property.city,
    state: property.state,
    acreage: property.acreage,
    asking_price: null,
    market_value: property.market_value ?? property.assessed_value ?? null,
    zoning: property.zoning,
    land_use: property.land_use,
    status: property.property_type,
    deal_id: null,
    href: `/crm?view=records&property=${property.id}`,
    source_label: "CRM property record",
    reasons: dedupeReasons(reasons),
  };
}

function scoreDeal(input: DealIntakeInput, deal: Deal): ScoredMatch {
  const reasons: string[] = [];
  const inputAddress = normalizeDealIntakeText(input.address) || normalizeDealIntakeText(input.query);
  const inputParcel = normalizeDealIntakeParcel(input.parcel_id) || normalizeDealIntakeParcel(input.query);
  const dealAddress = normalizeDealIntakeText(deal.address);
  const dealParcel = normalizeDealIntakeParcel(deal.parcel_id);
  let score = 0;

  score = Math.max(score, scoreParcel(inputParcel, dealParcel, reasons));
  score = Math.max(score, scoreAddress(inputAddress, dealAddress, reasons));
  score = Math.max(score, scoreQuery(input, [deal.title, deal.address, deal.parcel_id].map(normalizeDealIntakeText).join(" "), reasons));

  if (score < 30) return null;
  return {
    id: deal.id,
    source: "deal",
    confidence: confidenceFor(score),
    score,
    label: deal.title || deal.address || deal.parcel_id || "Existing deal packet",
    address: deal.address ?? null,
    parcel_id: deal.parcel_id ?? null,
    county: null,
    city: null,
    state: null,
    acreage: deal.acreage ?? null,
    asking_price: deal.asking_price ?? null,
    market_value: deal.target_resale_price ?? deal.arv ?? null,
    zoning: deal.zoning ?? null,
    land_use: deal.strategy ?? null,
    status: deal.status,
    deal_id: deal.id,
    href: `/opportunity?deal=${deal.id}`,
    source_label: "Existing deal packet",
    reasons: dedupeReasons(reasons),
  };
}

export function rankDealIntakeMatches(args: {
  input: DealIntakeInput;
  leads?: ImportedLandLead[];
  crmProperties?: CrmProperty[];
  deals?: Deal[];
  limit?: number;
}): DealIntakeMatch[] {
  const matches = [
    ...(args.leads ?? []).map(lead => scoreLead(args.input, lead)),
    ...(args.crmProperties ?? []).map(property => scoreCrmProperty(args.input, property)),
    ...(args.deals ?? []).map(deal => scoreDeal(args.input, deal)),
  ].filter((match): match is DealIntakeMatch => !!match);

  const seen = new Set<string>();
  return matches
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
    .filter(match => {
      const key = `${normalizeDealIntakeParcel(match.parcel_id)}|${normalizeDealIntakeText(match.address)}|${match.source}:${match.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, args.limit ?? 8);
}

export function buildDealDraftFromIntake(input: DealIntakeInput, match?: DealIntakeMatch | null): DealInput {
  const propertyType = input.property_type || "land";
  const address = input.address?.trim() || match?.address || "";
  const parcel = input.parcel_id?.trim() || match?.parcel_id || "";
  const askingPrice = input.asking_price ?? match?.asking_price ?? null;
  const targetResale = input.target_resale_price ?? match?.market_value ?? null;
  const acreage = input.acreage ?? match?.acreage ?? null;
  const sourceLines = [
    match ? `Matched ${match.source_label}: ${match.label}` : "",
    match?.reasons.length ? `Match reasons: ${match.reasons.join(", ")}` : "",
    input.listing_url ? `Listing/source link: ${input.listing_url}` : "",
    input.notes?.trim() || "",
  ].filter(Boolean);

  return {
    title: address || parcel || input.query?.trim() || "Member submitted deal",
    source: "Member Deal Analyzer",
    property_type: propertyType,
    strategy: propertyType === "land" ? "Land / build review" : "Member submitted deal review",
    status: "lead",
    urgency: input.urgency || "routine",
    address: address || null,
    parcel_id: parcel || null,
    seller_name: input.seller_name?.trim() || null,
    seller_phone: input.seller_phone?.trim() || null,
    asking_price: askingPrice,
    arv: targetResale,
    target_resale_price: targetResale,
    acreage,
    zoning: match?.zoning || null,
    road_frontage: null,
    utilities: null,
    notes: sourceLines.join("\n"),
    links: [input.listing_url?.trim(), match?.href].filter((value): value is string => !!value),
    lead_temperature: "warm",
    campaign_source: "Member submitted deal",
    review_intent: "needs-info-review",
    submission_summary: "",
    requested_next_step: "",
    submit_uncertainties: "",
    exit_strategy: input.exit_strategy?.trim() || (propertyType === "land" ? "Analyze land for build, assignment, or builder exit" : "Analyze resale or assignment exit"),
    target_buyer_type: input.target_buyer_type?.trim() || (propertyType === "land" ? "Builder / retail new-build buyer / investor" : "Investor or retail buyer"),
    buyer_demand_evidence: input.buyer_demand_evidence?.trim() || "",
    calculator_notes: match ? `Record match: ${match.source_label} (${match.confidence}).` : "",
    build_analysis: propertyType === "land" ? createDefaultBuildAnalysis({
      asking_price: askingPrice,
      target_resale_price: targetResale,
      arv: targetResale,
      acreage,
      zoning: match?.zoning || null,
    }) : null,
  };
}
