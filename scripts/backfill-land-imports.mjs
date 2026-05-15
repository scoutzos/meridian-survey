#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gpjqyygnpysregifgxkr.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find(arg => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : null;

if (!SERVICE_ROLE) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  console.error("Usage: SUPABASE_SERVICE_ROLE_KEY=... npm run backfill:land-imports");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const DEFAULT_ASSUMPTIONS = {
  closingCost: 3000,
  brokerCommissionPct: 0.06,
  assignmentFee: 10000,
  targetSpread: 20000,
  neighborPremiumPct: 0.1,
  retailDiscountPct: 0.55,
  wholesaleDiscountPct: 0.42,
  improvementPct: 0.03,
  subdivideImprovementPerLot: 12000,
  minimumChildLots: 2,
};

function normalizeSourceFieldKey(header) {
  return header
    .replace(/%/g, " pct ")
    .replace(/>/g, " over ")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function parseSourceNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(text)) return true;
  if (["n", "no", "false", "0"].includes(text)) return false;
  return null;
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function inferCategory(header, fieldKey) {
  const text = `${header} ${fieldKey}`.toLowerCase();
  if (/(phone|email|contact)/.test(text)) return "contact";
  if (/(owner|mail|selleriq)/.test(text)) return "owner";
  if (/(city|state|zip|county|latitude|longitude|fips|school)/.test(text)) return "location";
  if (/(value|price|estimate|ppa|comp|market)/.test(text)) return "valuation";
  if (/(tax|delinquent)/.test(text)) return "tax";
  if (/(deed|legal|sale|previous)/.test(text)) return "legal";
  if (/(mortgage|lender|interest)/.test(text)) return "mortgage";
  if (/(zoning|subdivision|lot|block|land_use|frontage|locked|tag|structure|farmland|entitlement|hoa)/.test(text)) return "development";
  if (/(wetland|flood)/.test(text)) return "environment";
  if (/(slope|elevation|topography)/.test(text)) return "topography";
  if (/(link|url|map|earth)/.test(text)) return "links";
  if (/(dnc|litigator|do_not_mail)/.test(text)) return "compliance";
  if (/(age|gender|ethnic|religion|education|occupation|language|marital)/.test(text)) return "demographics";
  if (/(apn|parcel|acreage|address)/.test(text)) return "parcel";
  return "source";
}

function inferType(header, fieldKey, value) {
  const text = `${header} ${fieldKey}`.toLowerCase();
  if (/(link|url|map|earth)/.test(text)) return "url";
  if (/(date|since)/.test(text)) return "date";
  if (/^(y|n|yes|no|true|false)$/i.test(String(value ?? "").trim())) return "boolean";
  if (/(phone|zip|apn|fips|book|page)/.test(text)) return "text";
  if (parseSourceNumber(value) !== null) return "number";
  return "text";
}

function buildSourceFieldValues(rawData) {
  return Object.entries(rawData ?? {}).map(([header, value], index) => {
    const fieldKey = normalizeSourceFieldKey(header);
    const category = inferCategory(header, fieldKey);
    const dataType = inferType(header, fieldKey, value);
    const text = value === null || value === undefined ? "" : String(value);
    const blank = !text.trim();
    return {
      source_header: header,
      field_key: fieldKey,
      category,
      data_type: dataType,
      value_text: blank ? null : text,
      value_number: !blank && dataType === "number" ? parseSourceNumber(value) : null,
      value_boolean: !blank && dataType === "boolean" ? parseBoolean(value) : null,
      value_date: !blank && dataType === "date" ? parseDate(value) : null,
      value_json: value ?? null,
      searchable: dataType === "text" || dataType === "url",
      filterable: dataType === "number" || dataType === "boolean" || dataType === "date",
      calculator_ready: ["parcel", "valuation", "development", "environment", "topography"].includes(category),
      source_order: index,
    };
  });
}

function num(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value / 100) * 100);
}

function ppa(value, acres) {
  if (!value || !acres) return null;
  return Math.round(value / acres);
}

function statusFromSpread(spread, assumptions) {
  if (spread === null) return "weak";
  if (spread >= assumptions.targetSpread * 1.5) return "strong";
  if (spread >= assumptions.targetSpread) return "possible";
  if (spread > 0) return "weak";
  return "pass";
}

function rankStatus(status) {
  return status === "strong" ? 4 : status === "possible" ? 3 : status === "weak" ? 2 : 1;
}

function physicalBlocker(lead) {
  if (lead.is_land_locked) return "Landlocked";
  if ((lead.wetlands_percent ?? 0) > 25) return "Wetlands over 25%";
  if ((lead.flood_zone_percent ?? 0) > 25) return "Flood zone over 25%";
  if (lead.bad_topography) return "Bad topography";
  return null;
}

function result(args) {
  return { ...args, rank: rankStatus(args.status) };
}

function calculateLandUnderwriting(lead, assumptions = DEFAULT_ASSUMPTIONS) {
  const acres = num(lead.calculated_acreage) ?? num(lead.acreage);
  const liValue = num(lead.market_value) ?? num(lead.raw_data?.["Market Value Estimate"]) ?? num(lead.total_parcel_value);
  const liPpa = num(lead.market_value_estimate_ppa) ?? ppa(liValue, acres);
  const assessed = num(lead.assessed_value) ?? num(lead.total_parcel_value) ?? num(lead.land_value);
  const ask = num(lead.asking_price) ?? null;
  const blocker = physicalBlocker(lead);
  const compConfidence = num(lead.market_value_estimate_confidence);
  const compCount = num(lead.market_value_estimate_comp_count);
  const confidenceNote = compCount
    ? `${Math.round(compCount)} Land Insights comps${compConfidence ? ` at ${Math.round(compConfidence)} confidence` : ""}`
    : "Land Insights comp support must be verified";

  const retailResaleValue = liValue;
  const retailCosts = assumptions.closingCost + (retailResaleValue ? retailResaleValue * assumptions.brokerCommissionPct : 0) + (retailResaleValue ? retailResaleValue * assumptions.improvementPct : 0);
  const retailMaxOffer = retailResaleValue ? roundMoney((retailResaleValue * assumptions.retailDiscountPct) - assumptions.closingCost) : null;
  const retailSpread = retailResaleValue && retailMaxOffer !== null ? retailResaleValue - retailMaxOffer - retailCosts : null;

  const neighborValue = liValue ? liValue * (1 + assumptions.neighborPremiumPct) : null;
  const neighborMaxOffer = neighborValue ? roundMoney((neighborValue * 0.58) - assumptions.closingCost) : null;
  const neighborSpread = neighborValue && neighborMaxOffer !== null ? neighborValue - neighborMaxOffer - retailCosts : null;

  const wholesaleMaxOffer = liValue ? roundMoney((liValue * assumptions.wholesaleDiscountPct) - assumptions.closingCost) : null;
  const wholesaleSpread = liValue && wholesaleMaxOffer !== null ? liValue - wholesaleMaxOffer - assumptions.closingCost : null;

  const assignmentBuyerPrice = liValue ? liValue * 0.7 : null;
  const assignmentMaxOffer = assignmentBuyerPrice ? roundMoney(assignmentBuyerPrice - assumptions.assignmentFee - assumptions.closingCost) : null;
  const assignmentSpread = assignmentBuyerPrice && assignmentMaxOffer !== null ? assignmentBuyerPrice - assignmentMaxOffer - assumptions.closingCost : null;

  const minLotSize = num(lead.min_lot_size_acres);
  const potentialLots = acres && minLotSize ? Math.floor(acres / minLotSize) : lead.tag_subdivide && acres ? Math.max(assumptions.minimumChildLots, Math.floor(acres / 0.25)) : null;
  const subdivideViable = !!lead.tag_subdivide || !!lead.tag_entitlement || (potentialLots ?? 0) >= assumptions.minimumChildLots;
  const childLotValue = liPpa && acres && potentialLots ? (liPpa * acres * 1.25) : null;
  const subdivideCosts = potentialLots ? assumptions.closingCost + (potentialLots * assumptions.subdivideImprovementPerLot) : null;
  const subdivideMaxOffer = childLotValue && subdivideCosts !== null ? roundMoney(childLotValue * 0.55 - subdivideCosts) : null;
  const subdivideSpread = childLotValue && subdivideMaxOffer !== null && subdivideCosts !== null ? childLotValue - subdivideMaxOffer - subdivideCosts : null;

  const results = [
    result({
      exitType: "retail-resale",
      label: "Retail resale",
      status: blocker ? "pass" : statusFromSpread(retailSpread, assumptions),
      maxOffer: retailMaxOffer,
      requiredPpa: ppa((retailMaxOffer ?? 0) + retailCosts + assumptions.targetSpread, acres),
      requiredResaleValue: retailMaxOffer !== null ? roundMoney(retailMaxOffer + retailCosts + assumptions.targetSpread) : null,
      projectedSpread: roundMoney(retailSpread),
      landInsightsPpa: liPpa,
      landInsightsValue: liValue,
      keyAssumption: `${confidenceNote}; resale at current Land Insights estimate.`,
      blocker,
      nextStep: blocker ? `Confirm or clear blocker: ${blocker}.` : `Verify sold land comps support at least ${ppa((retailMaxOffer ?? 0) + retailCosts + assumptions.targetSpread, acres)?.toLocaleString() ?? "the target"} per acre.`,
    }),
    result({
      exitType: "neighbor-sale",
      label: "Neighbor sale",
      status: blocker ? "pass" : statusFromSpread(neighborSpread, assumptions),
      maxOffer: neighborMaxOffer,
      requiredPpa: ppa((neighborMaxOffer ?? 0) + retailCosts + assumptions.targetSpread, acres),
      requiredResaleValue: neighborMaxOffer !== null ? roundMoney(neighborMaxOffer + retailCosts + assumptions.targetSpread) : null,
      projectedSpread: roundMoney(neighborSpread),
      landInsightsPpa: liPpa,
      landInsightsValue: liValue,
      keyAssumption: "Adjacent owners may pay a modest premium for control.",
      blocker,
      nextStep: blocker ? `Clear ${blocker} before neighbor outreach.` : "Check adjacent owners and verify whether assemblage/control creates premium value.",
    }),
    result({
      exitType: "land-flip",
      label: "Land flip",
      status: blocker ? "pass" : statusFromSpread(wholesaleSpread, assumptions),
      maxOffer: wholesaleMaxOffer,
      requiredPpa: ppa((wholesaleMaxOffer ?? 0) + assumptions.closingCost + assumptions.targetSpread, acres),
      requiredResaleValue: wholesaleMaxOffer !== null ? roundMoney(wholesaleMaxOffer + assumptions.closingCost + assumptions.targetSpread) : null,
      projectedSpread: roundMoney(wholesaleSpread),
      landInsightsPpa: liPpa,
      landInsightsValue: liValue,
      keyAssumption: "Fast resale with conservative acquisition basis.",
      blocker,
      nextStep: blocker ? `Do not flip until ${blocker} is resolved.` : "Pull 3 fast-resale land comps and confirm demand at the required PPA.",
    }),
    result({
      exitType: "assignment",
      label: "Assignment",
      status: blocker ? "pass" : statusFromSpread(assignmentSpread, assumptions),
      maxOffer: assignmentMaxOffer,
      requiredPpa: ppa((assignmentMaxOffer ?? 0) + assumptions.closingCost + assumptions.assignmentFee, acres),
      requiredResaleValue: assignmentBuyerPrice ? roundMoney(assignmentBuyerPrice) : null,
      projectedSpread: roundMoney(assignmentSpread),
      landInsightsPpa: liPpa,
      landInsightsValue: liValue,
      keyAssumption: `Buyer can absorb a ${assumptions.assignmentFee.toLocaleString()} assignment fee.`,
      blocker,
      nextStep: blocker ? `Buyer demand is secondary until ${blocker} is cleared.` : "Check buyer list or local investor demand before seller negotiation.",
    }),
    result({
      exitType: "subdivide",
      label: "Subdivide",
      status: blocker ? "pass" : !subdivideViable ? "weak" : statusFromSpread(subdivideSpread, assumptions),
      maxOffer: subdivideMaxOffer,
      requiredPpa: ppa((subdivideMaxOffer ?? 0) + (subdivideCosts ?? 0) + assumptions.targetSpread, acres),
      requiredResaleValue: subdivideMaxOffer !== null && subdivideCosts !== null ? roundMoney(subdivideMaxOffer + subdivideCosts + assumptions.targetSpread) : null,
      projectedSpread: roundMoney(subdivideSpread),
      landInsightsPpa: liPpa,
      landInsightsValue: liValue,
      keyAssumption: potentialLots ? `${potentialLots} potential child lots; rough site cost ${((subdivideCosts ?? 0) - assumptions.closingCost).toLocaleString()}.` : "Subdivision requires zoning/min-lot-size proof.",
      blocker: blocker ?? (!subdivideViable ? "Subdivision not proven" : null),
      nextStep: blocker ? `Clear ${blocker} before subdivision review.` : "Verify zoning, min lot size, and child-lot comps before building a subdivide packet.",
    }),
  ];

  const pass = result({
    exitType: "pass",
    label: "Pass",
    status: blocker || results.every(item => item.status === "pass") ? "possible" : "weak",
    maxOffer: null,
    requiredPpa: null,
    requiredResaleValue: null,
    projectedSpread: null,
    landInsightsPpa: liPpa,
    landInsightsValue: liValue,
    keyAssumption: blocker ? `Property has a current blocker: ${blocker}.` : "Use only if seller will not meet max-offer range or comps fail.",
    blocker,
    nextStep: blocker ? `Pass or pause until ${blocker} is disproven.` : "Pass if seller ask is above every max offer or comp support fails.",
  });

  const allResults = [...results, pass];

  return {
    results: allResults,
    assumptions,
    inputSnapshot: {
      acreage: acres,
      asking_price: ask,
      assessed_value: assessed,
      land_insights_value: liValue,
      land_insights_ppa: liPpa,
      comp_count: compCount,
      confidence: compConfidence,
      road_frontage_ft: lead.road_frontage_ft,
      wetlands_percent: lead.wetlands_percent,
      flood_zone_percent: lead.flood_zone_percent,
      land_locked: lead.is_land_locked,
      zoning: lead.zoning,
      land_use: lead.land_use,
      tag_subdivide: lead.tag_subdivide,
    },
  };
}

async function fetchImportedLeads() {
  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const remaining = LIMIT ? LIMIT - rows.length : pageSize;
    if (remaining <= 0) break;
    const size = Math.min(pageSize, remaining);
    const { data, error } = await supabase
      .from("meridian_imported_land_leads")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + size - 1);

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }

  return rows;
}

function fieldRowsForLead(lead) {
  return buildSourceFieldValues(lead.raw_data ?? {}).map(field => ({
    lead_id: lead.id,
    ...field,
  }));
}

function underwritingRowsForLead(lead) {
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
    assumptions: summary.assumptions,
    input_snapshot: summary.inputSnapshot,
    calculated_at: new Date().toISOString(),
  }));
}

async function upsertInChunks(table, rows, options, chunkSize) {
  let count = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, options);
    if (error) throw error;
    count += chunk.length;
    process.stdout.write(".");
  }
  return count;
}

const leads = await fetchImportedLeads();
const fieldRows = leads.flatMap(fieldRowsForLead);
const underwritingRows = leads.flatMap(underwritingRowsForLead);

console.log(`Found ${leads.length} imported land leads.`);
console.log(`Prepared ${fieldRows.length} source field rows.`);
console.log(`Prepared ${underwritingRows.length} underwriting result rows.`);

if (DRY_RUN) {
  console.log("Dry run complete. No database changes were made.");
  process.exit(0);
}

const fieldCount = await upsertInChunks(
  "meridian_imported_land_lead_field_values",
  fieldRows,
  { onConflict: "lead_id,field_key,source_order" },
  500,
);
console.log(`\nUpserted ${fieldCount} source field rows.`);

const underwritingCount = await upsertInChunks(
  "meridian_land_underwriting_results",
  underwritingRows,
  { onConflict: "lead_id,exit_type" },
  300,
);
console.log(`\nUpserted ${underwritingCount} underwriting result rows.`);
console.log("Backfill complete.");
