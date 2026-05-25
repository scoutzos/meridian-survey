"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import OperatingHeader from "@/components/OperatingHeader";
import BuildDealAnalysisPanel from "@/components/BuildDealAnalysisPanel";
import ConversationPanel from "@/components/ConversationPanel";
import DealAiAnalysisPanel from "@/components/DealAiAnalysisPanel";
import LandUnderwritingMatrix from "@/components/LandUnderwritingMatrix";
import LandUnderwritingPanel from "@/components/LandUnderwritingPanel";
import ParsedListingFacts from "@/components/ParsedListingFacts";
import { createActionItem } from "@/lib/action-items";
import { checkLeadSmsCompliance, renderMessageForRecipient } from "@/lib/bulk-sms";
import { calculateBuildAnalysis, normalizeBuildAnalysis, type BuildAnalysisInput } from "@/lib/build-underwriting";
import type { DealAiAnalysisResult, DealAiPortalContext } from "@/lib/deal-ai";
import {
  calculateDealAnalysis,
  createDeal,
  createDealActivity,
  type Deal,
  type DealInput,
} from "@/lib/deals";
import {
  createLandCompRecord,
  createImportedLandLeadActivity,
  fetchLandCompRecords,
  fetchLandDueDiligenceItems,
  fetchImportedLandLeads,
  fetchImportedLandLeadActivities,
  fetchPotentialLandCompRecords,
  getCountyResearchSources,
  inferLandLeadSourceFromUrl,
  importedLeadContactIdentityKey,
  leadToDealDraft,
  linkLandCompToLead,
  listingTextHints,
  listingUrlHints,
  runAutomatedLandResearch,
  saveLandDueDiligenceItem,
  summarizeLandComps,
  updateImportedLandLeadFromManualResearch,
  updateImportedLandLeadStatus,
  type ImportedLandLead,
  type ImportedLandLeadActivity,
  type LandCompConfidence,
  type LandCompRecord,
  type LandCompType,
  type AutomatedLandResearchResult,
  type LandDueDiligenceCategory,
  type LandDueDiligenceItem,
  type LandDueDiligenceStatus,
  type ManualResearchLeadPatch,
} from "@/lib/land-leads";
import {
  fetchCommunicationEvents,
  type CommunicationEvent,
} from "@/lib/communications";
import { fetchActiveMemberNames } from "@/lib/members";
import { createNotification } from "@/lib/operations";
import { labelForStatus } from "@/lib/status-map";

type Tab = "overview" | "conversation" | "properties" | "decision" | "research";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "conversation", label: "Conversation" },
  { value: "properties", label: "Properties" },
  { value: "decision", label: "Build Decision" },
  { value: "research", label: "Research" },
];

const EMPTY_COMP_DRAFT = {
  compType: "sold" as LandCompType,
  address: "",
  parcelId: "",
  price: "",
  acreage: "",
  saleOrListDate: "",
  distanceMiles: "",
  sourceSystem: "",
  sourceUrl: "",
  listingText: "",
  similarityNotes: "",
  confidence: "needs-review" as LandCompConfidence,
};

const EMPTY_FACT_DRAFT = {
  values: {} as Record<string, string>,
  sourceName: "",
  sourceUrl: "",
  notes: "",
  verifyChecklist: true,
};

type VerifiedFactInputKind = "text" | "number" | "money" | "boolean" | "percent" | "url";

type VerifiedFactField = {
  key: keyof ManualResearchLeadPatch;
  label: string;
  value: string;
  kind?: VerifiedFactInputKind;
  placeholder?: string;
};

type VerifiedFactItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  category?: LandDueDiligenceCategory;
  fields: VerifiedFactField[];
};

type VerifiedFactGroup = {
  title: string;
  items: VerifiedFactItem[];
};

type FactDraft = typeof EMPTY_FACT_DRAFT;

function parseMoneyValue(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  const multiplier = /m$/i.test(cleaned) ? 1000000 : /k$/i.test(cleaned) ? 1000 : 1;
  const numeric = Number(cleaned.replace(/[mk]$/i, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
}

function optionalTextInput(value: string): string | null {
  const text = value.trim();
  return text || null;
}

function factDraftValue(value: string | number | boolean | null | undefined): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return "";
}

function factField(
  key: keyof ManualResearchLeadPatch,
  label: string,
  value: string | number | boolean | null | undefined,
  kind: VerifiedFactInputKind = "text",
  placeholder?: string,
): VerifiedFactField {
  return { key, label, value: factDraftValue(value), kind, placeholder };
}

function parseCompListingText(text: string, sourceUrl: string) {
  const hints = listingUrlHints(sourceUrl);
  const textHints = listingTextHints(text);
  const rawLines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const detailStartIndex = rawLines.findIndex((line, index) =>
    /^Back to search$/i.test(line)
    && rawLines.slice(index + 1, index + 90).some(row => /^\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?$/i.test(row) && !row.includes("--"))
    && rawLines.slice(index + 1, index + 120).some(row => /^\d{1,6}\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(row)),
  );
  const lines = detailStartIndex >= 0 ? rawLines.slice(detailStartIndex) : rawLines;
  const priceHistoryIndex = lines.findIndex(line => /^price history$/i.test(line));
  const carouselIndex = lines.findIndex(line => /^(nearby homes|similar homes|homes for you)$/i.test(line));
  const mainEnd = [priceHistoryIndex, carouselIndex].filter(index => index >= 0).sort((a, b) => a - b)[0] ?? lines.length;
  const mainLines = lines.slice(0, mainEnd);
  const mainText = mainLines.join(" ");
  const priceLineIndex = mainLines.findIndex(line => /^\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?$/i.test(line) && !line.includes("--"));
  const priceLine = priceLineIndex >= 0 ? mainLines[priceLineIndex] : mainLines.find(line => /\$\s?[\d,]+(?:\.\d+)?\s?[kKmM]?\b/.test(line) && !line.includes("--"));
  const fullAddressPattern = /^\d{1,6}\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i;
  const streetAddressPattern = /^\d{1,6}\s+.+\s(?:Rd|Road|Dr|Drive|Cir|Circle|St|Street|Ave|Avenue|Ln|Lane|Ct|Court|Way|Trl|Trail|Pkwy|Hwy|Highway|Ter|Terrace)\b(?:\s+[NSEW]{1,2})?$/i;
  const lineIsAddress = (line: string) =>
    !/image of|interested in|travel times|nearby|more$/i.test(line)
    && (fullAddressPattern.test(line) || streetAddressPattern.test(line));
  const nearbyAddress = priceLineIndex >= 0 ? mainLines.slice(priceLineIndex + 1, priceLineIndex + 7).find(lineIsAddress) : null;
  const addressLine = nearbyAddress || mainLines.find(line => fullAddressPattern.test(line) && !/image of|interested in/i.test(line)) || "";
  const acresFromSplitLines = mainLines.find((line, index) => /^acres?$/i.test(line) && /^[\d.]+$/.test(mainLines[index - 1] || ""))
    ? Number(mainLines[(mainLines.findIndex((line, index) => /^acres?$/i.test(line) && /^[\d.]+$/.test(mainLines[index - 1] || ""))) - 1])
    : null;
  const acresMatch = mainText.match(/(?:Size:\s*)?([\d.]+)\s+Acres?\b/i)
    || mainText.match(/([\d.]+)\s+acres?\s+lot/i);
  const parcelMatch = mainText.match(/Parcel number:\s*([A-Za-z0-9-]+)/i);
  const listedDateMatch = mainText.match(/Date on market:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const saleDateMatch = mainText.match(/(?:sold|closed)\s+(?:on\s+)?([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const statusText = textHints.listingStatus || mainLines[0] || "";
  const status: LandCompType = /^active$/i.test(statusText) || /\bActive\b/i.test(mainText)
    ? "active"
    : /pending|under contract/i.test(mainText)
      ? "pending"
      : /sold|closed/i.test(mainText)
    ? "sold"
    : "manual-note";
  const parsedDate = status === "sold" ? saleDateMatch?.[1] : textHints.listingDate || listedDateMatch?.[1] || saleDateMatch?.[1];
  return {
    address: addressLine || [textHints.propertyAddress || hints.propertyAddress, textHints.city || hints.city, textHints.state || hints.state, textHints.zip || hints.zip].filter(Boolean).join(", "),
    parcelId: parcelMatch?.[1] || textHints.parcelId || "",
    county: textHints.county || hints.county || "",
    city: textHints.city || hints.city || "",
    state: textHints.state || hints.state || "",
    zip: textHints.zip || hints.zip || "",
    price: priceLine ? parseMoneyValue(priceLine) : textHints.askingPrice ?? null,
    acreage: acresFromSplitLines || (acresMatch?.[1] ? Number(acresMatch[1]) : null) || textHints.acreage || null,
    saleOrListDate: parsedDate ? new Date(parsedDate).toISOString().slice(0, 10) : "",
    compType: status,
  };
}

function ownerKey(lead: ImportedLandLead): string {
  return importedLeadContactIdentityKey(lead);
}

function describePhoneType(rawType: string | null | undefined): "Mobile" | "Landline" | "VOIP" | "Unknown" {
  if (!rawType) return "Unknown";
  const t = rawType.toLowerCase();
  if (t.includes("mobile") || t.includes("cell") || t.includes("wireless")) return "Mobile";
  if (t.includes("landline") || t.includes("land line") || t.includes("fixed")) return "Landline";
  if (t.includes("voip") || t.includes("voice over ip")) return "VOIP";
  return "Unknown";
}

interface OwnerPhones {
  number: string;
  type: ReturnType<typeof describePhoneType>;
  slot: number;
}

function collectPhones(lead: ImportedLandLead): OwnerPhones[] {
  return [
    { number: lead.phone, type: describePhoneType(lead.phone_1_type), slot: 1 },
    { number: lead.phone_2, type: describePhoneType(lead.phone_2_type), slot: 2 },
    { number: lead.phone_3, type: describePhoneType(lead.phone_3_type), slot: 3 },
    { number: lead.phone_4, type: describePhoneType(lead.phone_4_type), slot: 4 },
    { number: lead.phone_5, type: describePhoneType(lead.phone_5_type), slot: 5 },
    { number: lead.phone_6, type: describePhoneType(lead.phone_6_type), slot: 6 },
  ]
    .filter((p): p is OwnerPhones => !!p.number)
    .map(p => ({ ...p, number: p.number as string }));
}

const SMS_TEMPLATES = [
  { label: "Intro", body: "Hi {{first_name}}, this is Meridian. I was reaching out about your land in {{county}}. Would you consider selling?" },
  { label: "Follow-up", body: "Hi {{first_name}}, following up on the land you own in {{county}}. Are you open to an offer?" },
  { label: "Next step", body: "Thanks. I'm reviewing the property details now and will follow up with next steps." },
];

type DecisionGateTone = "ready" | "review" | "blocked";

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function mergeText(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  return parts
    .flatMap(part => String(part || "").split(/\n{2,}/g))
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n");
}

function compactAiValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > 900 ? `${value.slice(0, 900)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  try {
    const text = JSON.stringify(value);
    return text.length > 900 ? `${text.slice(0, 900)}...` : value;
  } catch {
    return String(value).slice(0, 900);
  }
}

function aiRawFactSnapshot(rawData: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const raw = rawData || {};
  const priority = /^(listing|parsed|price|public tax|tax|zestimate|rent|source|mls|hoa|utilities|water|sewer|flood|schools|nearby|similar|description|what's special|year|built|bed|bath|sqft|lot|acres|zoning|subdivision|region|walk|bike)/i;
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([key, value]) => value !== null && value !== undefined && String(value).trim() && priority.test(key))
      .slice(0, 90)
      .map(([key, value]) => [key, compactAiValue(value)]),
  );
}

type BuildDraftResult = {
  analysis: BuildAnalysisInput;
  changed: boolean;
  note: string;
};

type HomeMarketSignal = {
  address: string;
  price: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  status: string;
  source: string;
};

function createAiAssistedBuildDraft(deal: DealInput, lead: ImportedLandLead, compRecords: LandCompRecord[]): BuildDraftResult {
  const analysis = cloneBuildAnalysis(normalizeBuildAnalysis(deal.build_analysis, deal));
  const before = JSON.stringify(analysis);
  const signals = collectHomeMarketSignals(lead.raw_data, lead, compRecords);
  const localSignals = signals.filter(signal => isLocalSignal(signal, lead));
  const preferredSignals = (localSignals.length >= 3 ? localSignals : signals).filter(signal => signal.price && signal.price >= 120_000);
  const priceSignals = preferredSignals.map(signal => signal.price).filter((value): value is number => Boolean(value));
  const sqftSignals = preferredSignals.map(signal => signal.sqft).filter((value): value is number => Boolean(value));
  const bedSignals = preferredSignals.map(signal => signal.beds).filter((value): value is number => Boolean(value));
  const bathSignals = preferredSignals.map(signal => signal.baths).filter((value): value is number => Boolean(value));
  const estimatedArv = median(priceSignals);
  const estimatedSqft = median(sqftSignals) ?? (estimatedArv ? clamp(Math.round(estimatedArv / 185 / 50) * 50, 1400, 2600) : 1800);
  const estimatedBeds = Math.round(median(bedSignals) ?? 3);
  const estimatedBaths = Math.round((median(bathSignals) ?? 2) * 2) / 2;
  const costPerSf = estimatedArv && estimatedArv > 450_000 ? 170 : estimatedArv && estimatedArv < 325_000 ? 145 : 155;
  const hardConstruction = roundCurrency(estimatedSqft * costPerSf, 500);
  const sitePremium = lead.flood_zone_type?.toLowerCase().includes("ae") ? 15_000 : 0;
  const preConstruction = 23_000 + sitePremium;
  const carrying = 7_500;
  const sellingPrep = 6_000;
  const additional = Math.round(hardConstruction * 0.11);
  const totalProjectBeforeFinance = (deal.asking_price || 0) + hardConstruction + preConstruction + carrying + sellingPrep + additional;
  const loanAmount = roundCurrency(totalProjectBeforeFinance * 0.7, 500);
  const groupCash = Math.max(0, totalProjectBeforeFinance - loanAmount);
  const assumptionLines = preferredSignals.slice(0, 6).map(signal => (
    `${signal.address || "Candidate"} - ${signal.price ? formatDraftMoney(signal.price) : "price ?"}${signal.sqft ? `, ${signal.sqft.toLocaleString()} sf` : ""}${signal.beds ? `, ${signal.beds} bd` : ""}${signal.baths ? `/${signal.baths} ba` : ""} (${signal.status || signal.source})`
  ));

  if (!analysis.community.subdivision && lead.subdivision) analysis.community.subdivision = lead.subdivision;
  if (analysis.community.hoa_required === null && lead.in_hoa !== null && lead.in_hoa !== undefined) analysis.community.hoa_required = Boolean(lead.in_hoa);
  if (!analysis.community.hoa_fee && parseMoneyLike(lead.raw_data?.["Listing HOA"] || lead.raw_data?.["HOA Fee"])) {
    analysis.community.hoa_fee = parseMoneyLike(lead.raw_data?.["Listing HOA"] || lead.raw_data?.["HOA Fee"]);
  }
  if (!analysis.comps.target_arv && estimatedArv) analysis.comps.target_arv = estimatedArv;
  if (!analysis.comps.median_sale_price && estimatedArv) analysis.comps.median_sale_price = estimatedArv;
  if (!analysis.comps.average_price_per_sqft && estimatedArv && estimatedSqft) analysis.comps.average_price_per_sqft = Math.round(estimatedArv / estimatedSqft);
  if (!analysis.comps.sold_comp_notes) {
    analysis.comps.sold_comp_notes = assumptionLines.length
      ? `AI draft market signals from parsed listing data. These are NOT verified sold new-build comps until MLS/county sale records confirm closed sale date, year built, sqft, bed/bath, builder, and school district.\n${assumptionLines.map(line => `- ${line}`).join("\n")}`
      : "AI could not find finished-home market signals in the parsed listing data. Pull sold new-build comps from MLS/FMLS/GAMLS before vote.";
  }

  if (!analysis.specs.home_size_sqft) analysis.specs.home_size_sqft = estimatedSqft;
  if (!analysis.specs.bedrooms) analysis.specs.bedrooms = estimatedBeds;
  if (!analysis.specs.bathrooms) analysis.specs.bathrooms = estimatedBaths;
  if (!analysis.specs.garage_spaces) analysis.specs.garage_spaces = 2;
  if (!analysis.specs.timeline_months) analysis.specs.timeline_months = 8;
  if (!analysis.specs.quality_level) analysis.specs.quality_level = "Entry/mid new-build finish - AI draft";
  if (!analysis.specs.gc_strategy) analysis.specs.gc_strategy = "Hired GC / builder bid pending";

  fillLineItem(analysis.budget.pre_construction, "closing_costs", Math.max(2_000, roundCurrency((deal.asking_price || 0) * 0.035, 100)), "AI draft: buyer closing/transaction costs.");
  fillLineItem(analysis.budget.pre_construction, "architectural_plans", 6_000, "AI draft: plan set allowance.");
  fillLineItem(analysis.budget.pre_construction, "engineer_stamp", 2_500, "AI draft: structural/civil review allowance.");
  fillLineItem(analysis.budget.pre_construction, "survey", 2_500, "AI draft: boundary/topo survey allowance.");
  fillLineItem(analysis.budget.pre_construction, "permits_impact_fees", 6_000, "AI draft: permit and review allowance.");
  fillLineItem(analysis.budget.pre_construction, "water_sewer_taps", lead.raw_data?.["Listing Utilities For Property"] ? 4_000 + sitePremium : null, "AI draft: utility tap/path allowance; verify sewer/septic.");

  fillConstructionBudget(analysis, hardConstruction);
  fillLineItem(analysis.budget.carrying, "builders_risk", 2_500, "AI draft.");
  fillLineItem(analysis.budget.carrying, "property_taxes", Math.max(lead.property_tax || 0, 1_000), "AI draft.");
  fillLineItem(analysis.budget.carrying, "temp_utilities", 1_500, "AI draft.");
  fillLineItem(analysis.budget.carrying, "post_completion_utilities", 1_500, "AI draft.");
  fillLineItem(analysis.budget.selling_prep, "staging", 2_500, "AI draft.");
  fillLineItem(analysis.budget.selling_prep, "photography_drone", 500, "AI draft.");
  fillLineItem(analysis.budget.selling_prep, "warranty_reserve", 3_000, "AI draft.");
  fillLineItem(analysis.budget.additional, "gc_flat_fee", roundCurrency(hardConstruction * 0.1, 500), "AI draft: GC overhead/profit allowance.");
  fillLineItem(analysis.budget.additional, "liability_insurance", 1_200, "AI draft.");
  fillLineItem(analysis.budget.additional, "porta_potty", 1_200, "AI draft.");
  fillLineItem(analysis.budget.additional, "reinspections", 1_000, "AI draft.");

  if (!analysis.financing.member_count) analysis.financing.member_count = 6;
  if (!analysis.financing.construction_loan && !analysis.financing.hard_money && !analysis.financing.investor_capital) analysis.financing.construction_loan = loanAmount;
  if (!analysis.financing.group_cash) analysis.financing.group_cash = roundCurrency(groupCash, 500);
  if (!analysis.financing.lender_rate_pct) analysis.financing.lender_rate_pct = 10.5;
  if (!analysis.financing.lender_points_pct) analysis.financing.lender_points_pct = 2;
  if (!analysis.financing.lender_duration_months) analysis.financing.lender_duration_months = analysis.specs.timeline_months || 8;
  if (!analysis.financing.notes) {
    analysis.financing.notes = "AI draft financing assumption: 70% construction loan / 30% group cash. Replace with lender quote, rate, points, draw schedule, and required member cash.";
  }

  if (analysis.comps.target_arv) {
    analysis.exits.build_sell.conservative.sale_price ||= roundCurrency(analysis.comps.target_arv * 0.92, 500);
    analysis.exits.build_sell.base.sale_price ||= analysis.comps.target_arv;
    analysis.exits.build_sell.optimistic.sale_price ||= roundCurrency(analysis.comps.target_arv * 1.05, 500);
  }

  analysis.status_checks = analysis.status_checks.map(check => {
    if (check.key === "community_identified" && lead.subdivision) return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || "AI draft from property record subdivision/listing facts." };
    if (check.key === "new_build_comps") return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || "AI draft uses candidate market signals; verify 3 sold new-build comps." };
    if (check.key === "zoning_verified" && lead.zoning) return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || `AI draft saw zoning ${lead.zoning}; verify setbacks/buildability with county.` };
    if (check.key === "flood_checked" && lead.flood_zone_type) return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || `AI draft saw flood signal ${lead.flood_zone_type}; verify map/build envelope.` };
    if (check.key === "utilities_verified") return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || "AI draft from listing utility text; verify taps/sewer/septic." };
    if (check.key === "construction_budget") return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || `AI draft budget at ${formatDraftMoney(hardConstruction)} hard cost (${formatDraftMoney(costPerSf)}/sf).` };
    if (check.key === "financing_identified") return { ...check, status: check.status === "open" ? "in-review" : check.status, notes: check.notes || "AI draft financing assumption; replace with lender terms." };
    return check;
  });

  const changed = JSON.stringify(analysis) !== before;
  const note = `AI filled a draft build packet using parsed portal data: ${estimatedArv ? `target ARV ${formatDraftMoney(estimatedArv)}` : "target ARV still needs a comp source"}, ${estimatedSqft.toLocaleString()} sf ${estimatedBeds}/${estimatedBaths} spec, ${formatDraftMoney(hardConstruction)} hard construction budget, and ${formatDraftMoney(loanAmount)} draft construction loan. Treat as assumptions until verified sold new-build comps, builder bids, and lender terms are attached.`;
  return { analysis, changed, note };
}

function cloneBuildAnalysis(value: BuildAnalysisInput): BuildAnalysisInput {
  return JSON.parse(JSON.stringify(value)) as BuildAnalysisInput;
}

function collectHomeMarketSignals(rawData: Record<string, unknown> | null | undefined, lead: ImportedLandLead, compRecords: LandCompRecord[]): HomeMarketSignal[] {
  const signals: HomeMarketSignal[] = [];
  compRecords.forEach(comp => {
    const text = [comp.address, comp.listing_text, comp.similarity_notes, comp.adjustment_notes, JSON.stringify(comp.listing_details || {})].filter(Boolean).join(" ");
    if (comp.price && comp.price >= 120_000 && /bd|bed|bath|sqft|new|built|home/i.test(text) && !/land|lot\/land|acres lot|unimproved/i.test(text)) {
      signals.push({
        address: comp.address || "Saved comp",
        price: comp.price,
        sqft: parseSqft(text),
        beds: parseBeds(text),
        baths: parseBaths(text),
        status: comp.comp_type,
        source: comp.source_system || "Saved comp",
      });
    }
  });
  Object.entries(rawData || {}).forEach(([key, value]) => {
    if (!/nearby homes|similar homes|homes for you|sold homes|comps|comparison/i.test(key)) return;
    extractSignalsFromUnknown(value, key).forEach(signal => {
      if (isFinishedHomeSignal(signal)) signals.push(signal);
    });
  });
  return uniqueSignals(signals).filter(signal => isLocalSignal(signal, lead) || signals.length < 6).slice(0, 12);
}

function extractSignalsFromUnknown(value: unknown, source: string): HomeMarketSignal[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(item => extractSignalsFromUnknown(item, source)).slice(0, 24);
  const row = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const text = row ? Object.values(row).map(item => typeof item === "string" || typeof item === "number" ? String(item) : "").filter(Boolean).join(" ") : String(value);
  const address = row ? String(row.address || row.Address || row.property || row.Property || "").trim() : parseAddress(text);
  const price = parseMoneyLike(row?.price ?? row?.Price ?? row?.value ?? row?.Value ?? text);
  const sqft = parseSqft(row?.sqft ?? row?.square_feet ?? row?.details ?? text);
  const beds = parseBeds(row?.beds ?? row?.bedrooms ?? row?.details ?? text);
  const baths = parseBaths(row?.baths ?? row?.bathrooms ?? row?.details ?? text);
  const status = String(row?.status || row?.Status || row?.details || row?.Details || text.match(/\b(Sold|Off Market|Active|For Sale|Pending)\b/i)?.[1] || "").slice(0, 80);
  return [{ address, price, sqft, beds, baths, status, source }];
}

function isFinishedHomeSignal(signal: HomeMarketSignal): boolean {
  const text = `${signal.address} ${signal.status} ${signal.source}`;
  return Boolean(signal.price && signal.price >= 120_000 && (signal.sqft || signal.beds || signal.baths) && !/land|lot\/land|acres lot|unimproved|vacant/i.test(text));
}

function isLocalSignal(signal: HomeMarketSignal, lead: ImportedLandLead): boolean {
  const text = signal.address.toLowerCase();
  return Boolean(
    (lead.city && text.includes(lead.city.toLowerCase()))
    || (lead.zip && text.includes(String(lead.zip)))
    || (lead.property_address && signal.address && sameStreetName(signal.address, lead.property_address))
  );
}

function sameStreetName(a: string, b: string): boolean {
  const clean = (value: string) => value.toLowerCase().replace(/^\d+\s+/, "").replace(/\b(dr|drive|rd|road|ct|court|ln|lane|st|street|ave|avenue|way|trl|trail)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const left = clean(a);
  const right = clean(b);
  return Boolean(left && right && (left.includes(right.split(" ")[0]) || right.includes(left.split(" ")[0])));
}

function uniqueSignals(signals: HomeMarketSignal[]): HomeMarketSignal[] {
  const seen = new Set<string>();
  return signals.filter(signal => {
    const key = `${signal.address.toLowerCase()}-${signal.price || ""}`;
    if (!signal.address || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fillConstructionBudget(analysis: BuildAnalysisInput, total: number) {
  const allocations: Array<[string, number]> = [
    ["site_clearing_grading", 0.05],
    ["foundation", 0.09],
    ["framing_lumber_labor", 0.16],
    ["roofing", 0.05],
    ["windows", 0.04],
    ["siding", 0.05],
    ["hvac", 0.06],
    ["electrical", 0.06],
    ["plumbing", 0.06],
    ["insulation", 0.02],
    ["drywall", 0.05],
    ["paint", 0.03],
    ["lvp_flooring", 0.03],
    ["tile", 0.02],
    ["kitchen_cabinets", 0.04],
    ["countertops", 0.02],
    ["appliances", 0.02],
    ["bath_vanities", 0.02],
    ["bath_tile_hardware", 0.02],
    ["trim", 0.02],
    ["interior_doors", 0.015],
    ["driveway", 0.03],
    ["landscaping_sod", 0.02],
    ["gutters", 0.01],
    ["cleanup", 0.01],
    ["final_inspections_co", 0.005],
  ];
  allocations.forEach(([key, pct]) => fillLineItem(analysis.budget.construction, key, roundCurrency(total * pct, 100), "AI draft construction allowance; replace with builder bid."));
}

function fillLineItem(items: BuildAnalysisInput["budget"]["construction"], key: string, amount: number | null, notes: string) {
  if (!amount) return;
  const item = items.find(row => row.key === key);
  if (item && !item.amount) {
    item.amount = amount;
    item.notes = item.notes || notes;
  }
}

function parseMoneyLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value || "");
  const match = text.match(/\$?\s*([0-9][0-9,]*(?:\.\d+)?)(K|k)?/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return match[2] ? parsed * 1000 : parsed;
}

function parseSqft(value: unknown): number | null {
  const text = String(value || "");
  const match = text.match(/([0-9][0-9,.]*)\s*(?:k\s*)?sqft|([0-9][0-9,.]*)\s*sf/i);
  if (!match) return null;
  const raw = (match[1] || match[2] || "").replace(/,/g, "");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return /\bk\s*sqft/i.test(match[0]) ? Math.round(parsed * 1000) : parsed;
}

function parseBeds(value: unknown): number | null {
  const text = String(value || "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:bd|bed|beds|bedrooms)/i);
  return match ? Number(match[1]) : typeof value === "number" ? value : null;
}

function parseBaths(value: unknown): number | null {
  const text = String(value || "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|baths|bathrooms)/i);
  return match ? Number(match[1]) : typeof value === "number" ? value : null;
}

function parseAddress(text: string): string {
  return text.match(/\d{2,6}\s+[^,$\n]+,\s*[^,$\n]+,\s*[A-Z]{2}\s*\d{5}/)?.[0] || "";
}

function median(values: number[]): number | null {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number, nearest = 100): number {
  return Math.round(value / nearest) * nearest;
}

function formatDraftMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export default function LeadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = params?.id;
  const requestedTab = searchParams.get("tab") as Tab | null;
  const requestedPropertyId = searchParams.get("property");
  const initialTab = requestedTab || "overview";

  const [user, setUser] = useState<string | null>(null);
  const [lead, setLead] = useState<ImportedLandLead | null>(null);
  const [siblingProperties, setSiblingProperties] = useState<ImportedLandLead[]>([]);
  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [activities, setActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [researchItems, setResearchItems] = useState<LandDueDiligenceItem[]>([]);
  const [compRecords, setCompRecords] = useState<LandCompRecord[]>([]);
  const [potentialCompRecords, setPotentialCompRecords] = useState<LandCompRecord[]>([]);
  const [compDraft, setCompDraft] = useState(EMPTY_COMP_DRAFT);
  const [expandedCompId, setExpandedCompId] = useState<string | null>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [factDraft, setFactDraft] = useState<FactDraft>(EMPTY_FACT_DRAFT);
  const [savingResearch, setSavingResearch] = useState(false);
  const [autoResearchRunning, setAutoResearchRunning] = useState(false);
  const [autoResearchResult, setAutoResearchResult] = useState<AutomatedLandResearchResult | null>(null);
  const [decisionEvidence, setDecisionEvidence] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decisionAnalysis, setDecisionAnalysis] = useState<DealAiAnalysisResult | null>(null);
  const [decisionBuildDraft, setDecisionBuildDraft] = useState<BuildAnalysisInput | null>(null);
  const [decisionAiRunning, setDecisionAiRunning] = useState(false);
  const [decisionAiError, setDecisionAiError] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [createdDecisionDeal, setCreatedDecisionDeal] = useState<Deal | null>(null);

  useEffect(() => {
    if (requestedTab && TABS.some(t => t.value === requestedTab)) setTab(requestedTab);
    if (requestedTab === "properties" && leadId) setExpandedPropertyId(requestedPropertyId || leadId);
  }, [leadId, requestedPropertyId, requestedTab]);

  useEffect(() => {
    const u = typeof window !== "undefined" ? localStorage.getItem("meridian_user") : null;
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  const loadAll = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const allLeads = await fetchImportedLandLeads(2000);
    const me = allLeads.find(l => l.id === leadId) ?? null;
    setLead(me);
    if (me) {
      const key = ownerKey(me);
      setSiblingProperties(allLeads.filter(l => l.id !== me.id && ownerKey(l) === key));
      const [comms, acts] = await Promise.all([
        fetchCommunicationEvents({ leadId: me.id, limit: 100 }),
        fetchImportedLandLeadActivities(me.id, 80),
      ]);
      const [ddItems, comps] = await Promise.all([
        fetchLandDueDiligenceItems(me),
        fetchLandCompRecords(me.id),
      ]);
      const potentialComps = await fetchPotentialLandCompRecords(me, comps);
      setCommunications(comms);
      setActivities(acts);
      setResearchItems(ddItems);
      setCompRecords(comps);
      setPotentialCompRecords(potentialComps);
      if (requestedTab === "properties") setExpandedPropertyId(requestedPropertyId || me.id);
      else setExpandedPropertyId(current => current || me.id);
    }
    setLoading(false);
  }, [leadId, requestedPropertyId, requestedTab]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setDecisionEvidence("");
    setDecisionNotes("");
    setDecisionAnalysis(null);
    setDecisionBuildDraft(null);
    setDecisionAiError("");
    setCreatedDecisionDeal(null);
  }, [leadId]);

  const compliance = useMemo(() => lead ? checkLeadSmsCompliance(lead) : null, [lead]);
  const phones = useMemo(() => lead ? collectPhones(lead) : [], [lead]);
  const allProperties = useMemo(() => lead ? [lead, ...siblingProperties] : [], [lead, siblingProperties]);
  const sortedConvActivities = useMemo(() => activities.map(a => ({
    id: a.id,
    title: labelForStatus(a.activity_type),
    date: a.created_at,
    body: a.summary,
    meta: a.next_follow_up_date ? `Follow up ${a.next_follow_up_date}` : null,
  })), [activities]);

  const recentConversation = useMemo(() => {
    const items = [
      ...communications.map(event => ({
        id: `comm-${event.id}`,
        kind: event.direction === "inbound" ? "inbound" : "outbound",
        date: event.provider_created_at || event.created_at,
        body: event.body || event.status || event.provider_event_type,
      })),
      ...activities.map(a => ({
        id: `act-${a.id}`,
        kind: "activity",
        date: a.created_at,
        body: `${labelForStatus(a.activity_type)}: ${a.summary}`,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    return items.slice(0, 3);
  }, [communications, activities]);

  const motivationSignals = useMemo(() => {
    if (!lead) return [] as Array<{ label: string; tone: "warn" | "good" | "muted" }>;
    const signals: Array<{ label: string; tone: "warn" | "good" | "muted" }> = [];
    if (lead.tax_delinquent) signals.push({ label: `Tax delinquent${lead.tax_delinquent_years ? ` · ${lead.tax_delinquent_years}y` : ""}`, tone: "warn" });
    if (lead.owner_out_of_state) signals.push({ label: "Out-of-state owner", tone: "warn" });
    if (lead.seller_iq) signals.push({ label: `SellerIQ: ${lead.seller_iq}`, tone: "good" });
    if (lead.tag_subdivide) signals.push({ label: "Subdividable", tone: "good" });
    if (lead.tag_entitlement) signals.push({ label: "Entitlement potential", tone: "good" });
    if (lead.status === "interested") signals.push({ label: "Interested", tone: "good" });
    return signals;
  }, [lead]);
  const researchSources = useMemo(() => lead ? getCountyResearchSources(lead) : [], [lead]);
  const compSummary = useMemo(() => summarizeLandComps(compRecords), [compRecords]);
  const researchCompleteCount = useMemo(() => researchItems.filter(item => ["verified", "blocked", "not-applicable"].includes(item.status)).length, [researchItems]);
  const researchStatusByCategory = useMemo(() => {
    const rank: Record<LandDueDiligenceStatus, number> = {
      blocked: 5,
      verified: 4,
      "in-progress": 3,
      "not-applicable": 2,
      todo: 1,
    };
    return researchItems.reduce<Partial<Record<LandDueDiligenceCategory, LandDueDiligenceStatus>>>((acc, item) => {
      const current = acc[item.category];
      if (!current || rank[item.status] > rank[current]) acc[item.category] = item.status;
      return acc;
    }, {});
  }, [researchItems]);
  const verifiedFactGroups = useMemo<VerifiedFactGroup[]>(() => {
    if (!lead) return [];
    return [
      {
        title: "Parcel Identity",
        items: [
          { id: "situs-address", label: "Situs address", value: lead.property_address || "—", category: "gis", fields: [factField("property_address", "Situs address", lead.property_address, "text", "Property street address")] },
          { id: "parcel-id", label: "Parcel ID", value: lead.parcel_id || "—", category: "gis", fields: [factField("parcel_id", "Parcel ID", lead.parcel_id, "text", "Parcel/APN")] },
          { id: "county", label: "County", value: lead.county || "—", category: "gis", fields: [factField("county", "County", lead.county, "text", "County")] },
          { id: "city-state-zip", label: "City / State / ZIP", value: joinValues([lead.city, lead.state, lead.zip], ", "), category: "gis", fields: [
            factField("city", "City", lead.city, "text", "City"),
            factField("state", "State", lead.state, "text", "GA"),
            factField("zip", "ZIP", lead.zip, "text", "ZIP"),
          ] },
          { id: "coordinates", label: "Coordinates", value: lead.latitude && lead.longitude ? `${lead.latitude.toFixed(5)}, ${lead.longitude.toFixed(5)}` : "—", category: "gis", fields: [
            factField("latitude", "Latitude", lead.latitude, "number", "Latitude"),
            factField("longitude", "Longitude", lead.longitude, "number", "Longitude"),
          ] },
          { id: "owner", label: "Owner", value: lead.owner_name || "—", category: "ownership", fields: [factField("owner_name", "Owner", lead.owner_name, "text", "Owner name")] },
          { id: "mailing", label: "Mailing", value: lead.mailing_address || "—", category: "ownership", fields: [factField("mailing_address", "Mailing address", lead.mailing_address, "text", "Mailing address")] },
        ],
      },
      {
        title: "Land And Use",
        items: [
          { id: "acreage", label: "Acreage", value: lead.acreage ? `${numberValue(lead.acreage)} ac` : "—", category: "gis", fields: [factField("acreage", "Acreage", lead.acreage, "number", "Acres")] },
          { id: "calculated-acreage", label: "Calculated acreage", value: lead.calculated_acreage ? `${numberValue(lead.calculated_acreage)} ac` : "—", category: "gis", fields: [factField("calculated_acreage", "Calculated acreage", lead.calculated_acreage, "number", "Calculated acres")] },
          { id: "zoning", label: "Zoning", value: lead.zoning || "—", category: "zoning", fields: [factField("zoning", "Zoning", lead.zoning, "text", "Zoning code")] },
          { id: "land-use", label: "Land use", value: lead.land_use || "—", category: "zoning", fields: [factField("land_use", "Land use", lead.land_use, "text", "Land use")] },
          { id: "subdivision", label: "Subdivision", value: lead.subdivision || "—", category: "zoning", fields: [factField("subdivision", "Subdivision", lead.subdivision, "text", "Subdivision")] },
          { id: "hoa", label: "HOA", value: lead.hoa_status !== null && lead.hoa_status !== undefined && String(lead.hoa_status).trim() ? textValue(lead.hoa_status) : yesNo(lead.in_hoa), category: "zoning", fields: [factField("hoa_status", "HOA", typeof lead.hoa_status === "boolean" ? yesNo(lead.hoa_status) : lead.hoa_status, "text", "HOA status or fee")] },
          { id: "minimum-lot-size", label: "Minimum lot size", value: lead.min_lot_size_acres ? `${numberValue(lead.min_lot_size_acres)} ac` : "—", category: "zoning", fields: [factField("min_lot_size_acres", "Minimum lot size", lead.min_lot_size_acres, "number", "Minimum acres")] },
        ],
      },
      {
        title: "Value And Tax",
        items: [
          { id: "asking-price", label: "Asking price", value: money(lead.asking_price), category: "comps", fields: [factField("asking_price", "Asking price", lead.asking_price, "money", "Asking price")] },
          { id: "market-value", label: "Market value", value: money(lead.market_value), category: "comps", fields: [factField("market_value", "Market value", lead.market_value, "money", "Market value")] },
          { id: "assessed-value", label: "Assessed value", value: money(lead.assessed_value), category: "tax", fields: [factField("assessed_value", "Assessed value", lead.assessed_value, "money", "Assessed value")] },
          { id: "property-tax", label: "Property tax", value: money(lead.property_tax), category: "tax", fields: [factField("property_tax", "Property tax", lead.property_tax, "money", "Annual tax amount")] },
          { id: "tax-delinquent", label: "Tax delinquent", value: lead.tax_delinquent ? `Yes${lead.tax_delinquent_years ? ` · ${lead.tax_delinquent_years}y` : ""}` : yesNo(lead.tax_delinquent), category: "tax", fields: [
            factField("tax_delinquent", "Tax delinquent", lead.tax_delinquent, "boolean"),
            factField("tax_delinquent_years", "Tax years", lead.tax_delinquent_years, "number", "Years delinquent"),
          ] },
          { id: "median-comp-ppa", label: "Median comp PPA", value: compSummary.medianPpa ? `${money(compSummary.medianPpa)}/ac` : "—", category: "comps", fields: [] },
        ],
      },
      {
        title: "Risks And Access",
        items: [
          { id: "road-frontage", label: "Road frontage", value: lead.road_frontage_ft ? `${numberValue(lead.road_frontage_ft)} ft` : "—", category: "access", fields: [factField("road_frontage_ft", "Road frontage", lead.road_frontage_ft, "number", "Feet")] },
          { id: "landlocked", label: "Landlocked", value: yesNo(lead.is_land_locked), category: "access", fields: [factField("is_land_locked", "Landlocked", lead.is_land_locked, "boolean")] },
          { id: "flood", label: "Flood", value: joinValues([percentValue(lead.flood_zone_percent), lead.flood_zone_type]), category: "flood", fields: [
            factField("flood_zone_percent", "Flood %", lead.flood_zone_percent, "percent", "Flood percent"),
            factField("flood_zone_type", "Flood type", lead.flood_zone_type, "text", "Zone type"),
          ] },
          { id: "wetlands", label: "Wetlands", value: percentValue(lead.wetlands_percent), category: "wetlands", fields: [factField("wetlands_percent", "Wetlands %", lead.wetlands_percent, "percent", "Wetlands percent")] },
          { id: "parcel-link", label: "Parcel/GIS link", value: lead.parcel_link ? <a href={lead.parcel_link} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open source</a> : "—", category: "gis", fields: [factField("parcel_link", "Parcel/GIS link", lead.parcel_link, "url", "County GIS URL")] },
          { id: "comping-link", label: "Comping link", value: lead.comping_link ? <a href={lead.comping_link} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open comps</a> : "—", category: "comps", fields: [factField("comping_link", "Comping link", lead.comping_link, "url", "Comp source URL")] },
        ],
      },
    ];
  }, [lead, compSummary.medianPpa]);
  const buildPreviewDeal = useMemo(() => lead ? leadToDealDraft(lead) : null, [lead]);
  useEffect(() => {
    if (!buildPreviewDeal) {
      setDecisionBuildDraft(null);
      return;
    }
    setDecisionBuildDraft(normalizeBuildAnalysis(buildPreviewDeal.build_analysis, buildPreviewDeal));
  }, [buildPreviewDeal]);
  const decisionDeal = useMemo<DealInput | null>(() => {
    if (!lead || !buildPreviewDeal) return null;
    const base = buildPreviewDeal as DealInput;
    return {
      ...base,
      build_analysis: decisionBuildDraft || base.build_analysis,
      status: base.status || "lead",
      urgency: base.urgency || "routine",
      source: base.source || "Property record",
      campaign_source: base.campaign_source || lead.campaign_source || lead.source_system || "Property record",
      buyer_demand_evidence: mergeText(base.buyer_demand_evidence, decisionEvidence),
      notes: mergeText(base.notes, decisionNotes),
      links: Array.from(new Set([...(base.links || []), lead.property_url, lead.parcel_link, lead.comping_link].filter((value): value is string => !!value))),
    };
  }, [buildPreviewDeal, decisionBuildDraft, decisionEvidence, decisionNotes, lead]);
  const decisionPortalContext = useMemo<DealAiPortalContext | null>(() => {
    if (!lead) return null;
    return {
      property_record: {
        id: lead.id,
        address: lead.property_address,
        parcel_id: lead.parcel_id,
        county: lead.county,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        acreage: lead.acreage,
        asking_price: lead.asking_price,
        zoning: lead.zoning,
        subdivision: lead.subdivision,
        hoa_status: lead.hoa_status || (lead.in_hoa === true ? "Yes" : lead.in_hoa === false ? "No" : null),
        utilities: String(lead.raw_data?.["Listing Utilities For Property"] || lead.raw_data?.["Utilities"] || lead.raw_data?.["Listing Utilities"] || ""),
        flood_zone: joinValues([percentValue(lead.flood_zone_percent), lead.flood_zone_type]),
        wetlands: percentValue(lead.wetlands_percent),
        topography: lead.topography || null,
        property_url: lead.property_url,
        parcel_link: lead.parcel_link,
        comping_link: lead.comping_link,
      },
      parsed_listing_facts: aiRawFactSnapshot(lead.raw_data),
      research_items: researchItems.map(item => ({
        id: item.id,
        category: item.category,
        title: item.title,
        status: item.status,
        result_summary: item.result_summary,
        evidence_value: item.evidence_value,
        source_name: item.source_name,
        source_url: item.source_url,
        notes: item.notes,
      })),
      comp_records: compRecords.map(comp => ({
        id: comp.id,
        comp_type: comp.comp_type,
        address: comp.address,
        parcel_id: comp.parcel_id,
        county: comp.county,
        city: comp.city,
        state: comp.state,
        zip: comp.zip,
        price: comp.price,
        acreage: comp.acreage,
        price_per_acre: comp.price_per_acre,
        sale_or_list_date: comp.sale_or_list_date,
        distance_miles: comp.distance_miles,
        similarity_score: comp.similarity_score,
        source_system: comp.source_system,
        source_url: comp.source_url,
        listing_text: comp.listing_text ? `${comp.listing_text.slice(0, 1600)}${comp.listing_text.length > 1600 ? "..." : ""}` : null,
        listing_details: comp.listing_details || null,
        raw_data: comp.raw_data || null,
        similarity_notes: comp.similarity_notes,
        adjustment_notes: comp.adjustment_notes,
        include_in_valuation: comp.include_in_valuation,
        confidence: comp.confidence,
      })),
      member_notes: [decisionEvidence, decisionNotes].filter(Boolean),
      generated_at: new Date().toISOString(),
    };
  }, [compRecords, decisionEvidence, decisionNotes, lead, researchItems]);
  const decisionCalculator = useMemo(() => decisionDeal ? calculateDealAnalysis(decisionDeal) : null, [decisionDeal]);
  const decisionBuild = useMemo(() => decisionDeal ? calculateBuildAnalysis(decisionDeal.build_analysis, decisionDeal) : null, [decisionDeal]);
  const decisionGates = useMemo(() => {
    if (!lead || !decisionDeal || !decisionBuild || !decisionCalculator) return [];
    const blockers = researchItems.filter(item => item.status === "blocked");
    const verifiedCategories = new Set(researchItems.filter(item => item.status === "verified").map(item => item.category));
    const identityReady = Boolean((lead.property_address || lead.parcel_id) && lead.acreage && lead.asking_price);
    const physicalBlockers = [
      lead.is_land_locked ? "Landlocked" : null,
      (lead.flood_zone_percent ?? 0) > 25 ? "Flood exposure over 25%" : null,
      (lead.wetlands_percent ?? 0) > 25 ? "Wetlands over 25%" : null,
      lead.bad_topography ? "Bad topography" : null,
    ].filter(Boolean) as string[];
    const utilityEvidence = Boolean(
      lead.raw_data?.["Utilities"]
      || lead.raw_data?.["Listing Utilities"]
      || lead.raw_data?.["Listing Utilities For Property"]
      || lead.raw_data?.["Listing Water"]
      || lead.raw_data?.["Listing Sewer"],
    );
    const buildabilityReady = physicalBlockers.length === 0
      && (Boolean(lead.zoning) || verifiedCategories.has("zoning"))
      && (utilityEvidence || verifiedCategories.has("utilities") || verifiedCategories.has("access"));
    const compReady = decisionBuild.missingInfo.every(item => !item.toLowerCase().includes("comp"));
    const budgetReady = decisionBuild.missingInfo.every(item => !["build size / specs", "construction budget"].includes(item.toLowerCase()));
    const financingReady = !decisionBuild.missingInfo.some(item => item.toLowerCase().includes("financing"));
    const exitReady = Boolean(decisionDeal.target_resale_price || decisionDeal.arv) && decisionBuild.breakEvenSalePrice !== null;
    const voteReady = blockers.length === 0
      && decisionBuild.missingInfo.length === 0
      && decisionCalculator.missingInfo.length === 0
      && decisionBuild.riskFlags.length <= 1;

    return [
      {
        title: "Property identity",
        status: identityReady ? "ready" as const : "review" as const,
        detail: identityReady ? "Address/APN, acreage, and price are available." : "Needs address/APN, acreage, and asking price before a clean review.",
        next: identityReady ? "Use as source of truth." : "Verify parcel, acreage, and asking price.",
      },
      {
        title: "Buildability",
        status: physicalBlockers.length ? "blocked" as const : buildabilityReady ? "ready" as const : "review" as const,
        detail: physicalBlockers.length ? physicalBlockers.join(" · ") : buildabilityReady ? "No major physical blocker flagged." : "Zoning, utilities, access, flood, and wetlands still need proof.",
        next: physicalBlockers.length ? "Clear blocker before offer authority." : "Attach zoning, utility/access, and flood/wetlands evidence.",
      },
      {
        title: "Sold new-build comps",
        status: compReady ? "ready" as const : "review" as const,
        detail: compReady ? "Comp count requirement is satisfied in build analysis." : "Needs at least 3 sold new-build comps supporting ARV.",
        next: "Use sold new construction, recent, similar sqft/bed/bath, same school/community when possible.",
      },
      {
        title: "Build budget",
        status: budgetReady ? "ready" as const : "review" as const,
        detail: budgetReady ? "Build size and construction budget are present." : "Construction budget and build specs are not complete.",
        next: "Fill hard costs, soft costs, permits, utility taps, contingency, and specs.",
      },
      {
        title: "Financing",
        status: financingReady ? "ready" as const : "review" as const,
        detail: financingReady ? "Financing source is present." : "Cash, construction loan, hard money, or investor capital still needs to be documented.",
        next: "Confirm cash required, per-member contribution, lender terms, rate, points, and timeline.",
      },
      {
        title: "Exit and vote",
        status: voteReady ? "ready" as const : exitReady ? "review" as const : "blocked" as const,
        detail: voteReady ? "Ready to package for member decision." : exitReady ? "Exit math exists, but missing items or risks remain." : "Break-even and ARV support are not ready.",
        next: voteReady ? "Submit for review." : "Resolve missing items before presenting as a buy.",
      },
    ];
  }, [decisionBuild, decisionCalculator, decisionDeal, lead, researchItems]);

  const nextActionText = useMemo(() => {
    if (!lead) return "";
    if (compliance?.severity === "compliance") return `Do not contact — ${compliance.blockLabel}.`;
    const lastEvent = communications[0];
    if (lastEvent?.direction === "inbound") return `Reply to ${lead.owner_name || "seller"} — last message: "${(lastEvent.body || "").slice(0, 60)}"`;
    if (lead.status === "interested") return `Build a deal packet for ${lead.owner_name || "this seller"}.`;
    if (!lead.outreach_count) return `Send first text — no outreach yet.`;
    if (lead.last_sms_direction === "outbound" && lead.last_sms_at) {
      const days = Math.floor((Date.now() - new Date(lead.last_sms_at).getTime()) / 86400000);
      if (days > 3) return `Follow up — no reply in ${days} days.`;
    }
    return `Continue the conversation.`;
  }, [lead, communications, compliance]);

  const sendSms = async () => {
    if (!lead || !compliance?.allowed) {
      if (compliance && !compliance.allowed) setMessage(`Cannot send: ${compliance.blockLabel}.`);
      return;
    }
    const body = smsDraft.trim();
    if (!body) { setMessage("Write a message before sending."); return; }
    const rendered = renderMessageForRecipient(body, lead, allProperties.length);
    setSmsSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/sakari/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: compliance.phone!.number,
          message: rendered,
          actor: user,
          leadId: lead.id,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setMessage(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      setMessage("SMS sent.");
      await loadAll();
    } finally {
      setSmsSending(false);
    }
  };

  const logDisposition = async (type: ImportedLandLeadActivity["activity_type"], summary: string, nextStatus?: ImportedLandLead["status"]) => {
    if (!lead || !user) return;
    setMessage("");
    const { error } = await createImportedLandLeadActivity({
      leadId: lead.id,
      actor: user,
      activityType: type,
      summary,
    });
    if (error) { setMessage(error); return; }
    if (nextStatus) await updateImportedLandLeadStatus(lead.id, nextStatus, lead.deal_id);
    await loadAll();
  };

  const saveNote = async () => {
    if (!lead || !user) return;
    const body = noteDraft.trim();
    if (!body) { setMessage("Write a note before saving."); return; }
    const { error } = await createImportedLandLeadActivity({
      leadId: lead.id,
      actor: user,
      activityType: "note",
      summary: body,
    });
    if (error) { setMessage(error); return; }
    setNoteDraft("");
    setMessage("Note saved.");
    await loadAll();
  };

  const updateResearchStatus = async (item: LandDueDiligenceItem, status: LandDueDiligenceStatus) => {
    if (!lead) return;
    setSavingResearch(true);
    setMessage("");
    try {
      const { item: saved, error } = await saveLandDueDiligenceItem(lead, item, { status }, user);
      if (error) { setMessage(error); return; }
      if (saved) {
        setResearchItems(rows => rows.map(row => row.id === item.id ? saved : row).sort((a, b) => a.sort_order - b.sort_order));
      }
    } finally {
      setSavingResearch(false);
    }
  };

  const startFactEdit = (item: VerifiedFactItem) => {
    if (!item.fields.length) return;
    const defaultSource = item.category ? researchSources.find(source => source.category === item.category) : null;
    const sourceUrlFromField = item.fields.find(field => field.kind === "url")?.value || "";
    setEditingFactId(item.id);
    setFactDraft({
      values: Object.fromEntries(item.fields.map(field => [field.key, field.value])),
      sourceName: defaultSource?.source_name || "",
      sourceUrl: sourceUrlFromField || defaultSource?.source_url || "",
      notes: "",
      verifyChecklist: true,
    });
  };

  const updateFactDraftValue = (key: keyof ManualResearchLeadPatch, value: string) => {
    setFactDraft(prev => ({ ...prev, values: { ...prev.values, [key]: value } }));
  };

  const cancelFactEdit = () => {
    setEditingFactId(null);
    setFactDraft(EMPTY_FACT_DRAFT);
  };

  const saveFactUpdate = async (item: VerifiedFactItem) => {
    if (!lead || !user || !item.fields.length) return;
    const patch = Object.fromEntries(item.fields.map(field => [field.key, factDraft.values[field.key] ?? ""])) as ManualResearchLeadPatch;
    const evidenceValue = item.fields
      .map(field => `${field.label}: ${(factDraft.values[field.key] || "").trim() || "—"}`)
      .join(" · ");
    setSavingResearch(true);
    setMessage("");
    try {
      const { lead: updatedLead, changedFields, error } = await updateImportedLandLeadFromManualResearch(lead, {
        actor: user,
        sourceName: factDraft.sourceName,
        sourceUrl: factDraft.sourceUrl,
        notes: factDraft.notes,
        patch,
      });
      if (error) { setMessage(error); return; }

      if (factDraft.verifyChecklist && item.category) {
        const checklistItem = researchItems.find(row => row.category === item.category);
        if (checklistItem) {
          const { error: checklistError } = await saveLandDueDiligenceItem(lead, checklistItem, {
            status: "verified",
            result_summary: `${item.label} updated from verified source.`,
            evidence_value: evidenceValue,
            source_name: optionalTextInput(factDraft.sourceName),
            source_url: optionalTextInput(factDraft.sourceUrl),
            notes: optionalTextInput(factDraft.notes),
          }, user);
          if (checklistError) { setMessage(checklistError); return; }
        }
      }

      if (!changedFields.length) {
        setMessage(factDraft.verifyChecklist ? `${item.label} marked verified.` : "No property values changed.");
      } else {
        setMessage(`Updated ${changedFields.join(", ")}.`);
      }
      if (updatedLead) setLead(updatedLead);
      cancelFactEdit();
      await loadAll();
    } finally {
      setSavingResearch(false);
    }
  };

  const addCompRecord = async () => {
    if (!lead || !user) return;
    if (!compDraft.address.trim() && !compDraft.parcelId.trim() && !compDraft.sourceUrl.trim()) {
      setMessage("Add a comp address, parcel ID, or source link first.");
      return;
    }
    setSavingResearch(true);
    setMessage("");
    try {
      const parsed = listingTextHints(compDraft.listingText);
      const { comp, error } = await createLandCompRecord({
        leadId: lead.id,
        compType: compDraft.compType,
        address: compDraft.address,
        parcelId: compDraft.parcelId,
        county: parsed.county || lead.county,
        city: parsed.city,
        state: parsed.state || lead.state || "GA",
        zip: parsed.zip,
        price: compDraft.price ? Number(compDraft.price) : null,
        acreage: compDraft.acreage ? Number(compDraft.acreage) : null,
        saleOrListDate: compDraft.saleOrListDate || null,
        distanceMiles: compDraft.distanceMiles ? Number(compDraft.distanceMiles) : null,
        sourceSystem: compDraft.sourceSystem,
        sourceUrl: compDraft.sourceUrl,
        listingText: compDraft.listingText,
        listingDetails: parsed.listingDetails,
        similarityNotes: compDraft.similarityNotes,
        confidence: compDraft.confidence,
        actor: user,
      });
      if (error) { setMessage(error); return; }
      if (comp) setCompRecords(rows => [comp, ...rows]);
      if (comp) setPotentialCompRecords(rows => rows.filter(row => row.comp_property_id !== comp.comp_property_id));
      setCompDraft(EMPTY_COMP_DRAFT);
      setMessage("Comp saved to this property record.");
    } finally {
      setSavingResearch(false);
    }
  };

  const updateCompSourceUrl = (sourceUrl: string) => {
    const hints = listingUrlHints(sourceUrl);
    setCompDraft(prev => ({
      ...prev,
      sourceUrl,
      sourceSystem: inferLandLeadSourceFromUrl(sourceUrl),
      address: prev.address || [hints.propertyAddress, hints.city, hints.state, hints.zip].filter(Boolean).join(", "),
    }));
  };

  const updateCompListingText = (listingText: string) => {
    const parsed = parseCompListingText(listingText, compDraft.sourceUrl);
    setCompDraft(prev => ({
      ...prev,
      listingText,
      compType: parsed.compType === "manual-note" ? prev.compType : parsed.compType,
      address: prev.address || parsed.address,
      parcelId: prev.parcelId || parsed.parcelId,
      price: prev.price || (parsed.price ? String(parsed.price) : ""),
      acreage: prev.acreage || (parsed.acreage ? String(parsed.acreage) : ""),
      saleOrListDate: prev.saleOrListDate || parsed.saleOrListDate,
      similarityNotes: prev.similarityNotes || "Parsed from pasted listing text.",
    }));
  };

  const handleUsePotentialComp = async (comp: LandCompRecord) => {
    if (!lead || !user) return;
    setSavingResearch(true);
    setMessage("");
    try {
      const { comp: linked, error } = await linkLandCompToLead({
        leadId: lead.id,
        comp,
        actor: user,
        confidence: "needs-review",
        includeInValuation: true,
      });
      if (error) { setMessage(error); return; }
      if (linked) {
        setCompRecords(rows => [linked, ...rows]);
        setPotentialCompRecords(rows => rows.filter(row => row.comp_property_id !== linked.comp_property_id));
        setExpandedCompId(linked.id);
      }
      setMessage("Potential comp linked to this property.");
    } finally {
      setSavingResearch(false);
    }
  };

  const runAutoResearch = async () => {
    if (!lead) return;
    setAutoResearchRunning(true);
    setMessage("");
    try {
      const { result, items, lead: updatedLead, error } = await runAutomatedLandResearch(lead, researchItems, user);
      if (result) setAutoResearchResult(result);
      setResearchItems(items);
      if (updatedLead) setLead(updatedLead);
      if (error) {
        setMessage(error);
        return;
      }
      const blocked = result?.findings.filter(finding => finding.status === "blocked").length ?? 0;
      const reviewed = result?.findings.length ?? 0;
      setMessage(`Auto research finished. ${reviewed} findings saved${blocked ? `, ${blocked} blocker${blocked === 1 ? "" : "s"} flagged` : ""}.`);
    } finally {
      setAutoResearchRunning(false);
    }
  };

  const runDecisionAiAnalysis = async () => {
    if (!decisionDeal || !lead) return;
    setDecisionAiRunning(true);
    setDecisionAiError("");
    setMessage("");
    try {
      const draft = createAiAssistedBuildDraft(decisionDeal, lead, compRecords);
      const dealForAnalysis = draft.changed ? { ...decisionDeal, build_analysis: draft.analysis } : decisionDeal;
      if (draft.changed) {
        setDecisionBuildDraft(draft.analysis);
        setDecisionNotes(prev => mergeText(prev, draft.note));
        setMessage("AI filled the draft ARV, build specs, construction budget, and financing assumptions. Running the analysis against that draft now...");
      }
      const response = await fetch("/api/deals/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal: dealForAnalysis,
          portal_context: decisionPortalContext,
          context: [
            "This analysis is running inside the property record Build Decision tab.",
            "Use the attached portal_context as source-of-truth evidence before using freeform notes.",
            "Fill a draft build underwriting packet from available portal evidence and clearly mark draft assumptions versus verified facts.",
            "Automatically evaluate property record facts, parsed Zillow/FMLS facts, research checklist, saved comps, build budget, financing, and exit strategy.",
            "Follow Meridian's land-to-build decision framework: property identity, buildability, sold new-build comps, build budget, financing, exit strategy, offer guidance, and vote readiness.",
            "Separate sold new-build comps from land comps and active listings. Active listings are not ARV proof.",
            "Calculate max land offer with residual math: supported ARV minus build costs, soft costs, financing, selling costs, target profit, and contingency.",
            "Point green-light statements to evidence_sources. If evidence is missing, create next_actions instead of approving.",
            "Do not invent verified comps or external facts. If using candidate market signals, label them as preliminary and specify the exact sold-new-build comp search still needed.",
            "Give a Buy / Negotiate / Research More / Pass style recommendation through the existing recommendation fields.",
            draft.changed ? `Client-side AI draft assumptions already applied before this request: ${draft.note}` : "",
          ].join("\n"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        const statusMessage = response.status ? `AI analysis request failed (${response.status}).` : "AI analysis request failed.";
        throw new Error(data.error || response.statusText || statusMessage);
      }
      setDecisionAnalysis(data as DealAiAnalysisResult);
      setMessage(mergeText(
        draft.changed ? "AI filled draft ARV/spec/budget/financing assumptions. Review and replace with verified comps, bids, and lender terms." : "",
        data.note ? String(data.note) : "AI build decision analysis is ready on this property record.",
      ));
    } catch (error) {
      const text = error instanceof Error ? error.message : "AI analysis failed.";
      setDecisionAiError(text);
      setMessage(text);
    } finally {
      setDecisionAiRunning(false);
    }
  };

  const applyDecisionAiSuggestions = () => {
    if (!decisionAnalysis) return;
    const suggestions = decisionAnalysis.field_suggestions;
    setDecisionEvidence(prev => mergeText(prev, suggestions.buyer_demand_evidence));
    setDecisionNotes(prev => mergeText(prev, suggestions.calculator_notes, suggestions.build_analysis_notes));
    setMessage("AI suggestions added to the build decision notes. Review before saving or submitting.");
  };

  const notifyDecisionReviewWork = async (deal: Deal): Promise<string[]> => {
    const members = await fetchActiveMemberNames();
    const body = [
      `${deal.analysis?.recommendation ?? "Needs Review"} from property Build Decision framework.`,
      deal.address || deal.parcel_id || "Location pending",
      decisionAnalysis?.executive_summary || "",
    ].filter(Boolean).join(" ");
    const results = await Promise.all(members.flatMap(member => [
      createNotification({
        title: `Build decision ready: ${deal.title}`,
        body,
        priority: deal.urgency === "hot" ? "urgent" : "high",
        assigned_to: member,
        href: `/opportunity?deal=${deal.id}`,
        source_table: "meridian_deals",
        source_id: deal.id,
        notification_type: "deal_vote",
        dedupe: true,
      }, user || "Member"),
      createActionItem({
        title: `Review build decision: ${deal.title}`,
        description: body,
        assigned_to: member,
        due_date: addDays(deal.urgency === "hot" ? 1 : 2),
        task_type: "deal-follow-up",
        priority: deal.urgency === "hot" ? "urgent" : "high",
        source_table: "meridian_deals",
        source_id: deal.id,
      }, user || "Member"),
    ]));
    return results.map(result => result.error).filter((error): error is string => !!error);
  };

  const saveDecisionDeal = async (submitForReview: boolean) => {
    if (!lead || !user || !decisionDeal || !decisionCalculator || !decisionBuild) return;
    setDecisionSaving(true);
    setMessage("");
    try {
      const suggestions = decisionAnalysis?.field_suggestions;
      const now = new Date().toISOString();
      const missing = Array.from(new Set([...decisionCalculator.missingInfo, ...decisionBuild.missingInfo]));
      const payload: DealInput = {
        ...decisionDeal,
        status: submitForReview ? "under-review" : "lead",
        submitted_by: user,
        assigned_to: user,
        review_intent: "needs-info-review",
        submission_summary: suggestions?.submission_summary || decisionAnalysis?.executive_summary || decisionCalculator.summary,
        requested_next_step: suggestions?.requested_next_step || "Complete the land-to-build framework and verify sold new-build comps before member vote.",
        submit_uncertainties: suggestions?.submit_uncertainties || (missing.length ? missing.map(item => `- ${item}`).join("\n") : "No missing framework items flagged."),
        first_submitted_at: submitForReview ? now : null,
        last_submitted_at: submitForReview ? now : null,
        review_round: submitForReview ? 1 : 0,
        last_review_notification_at: submitForReview ? now : null,
        calculator_notes: mergeText(
          decisionDeal.calculator_notes,
          decisionAnalysis?.pricing_guidance,
          suggestions?.calculator_notes,
          suggestions?.build_analysis_notes,
        ),
        notes: mergeText(
          decisionDeal.notes,
          decisionAnalysis?.executive_summary ? `AI summary: ${decisionAnalysis.executive_summary}` : "",
          `Source property record: ${lead.id}`,
        ),
        buyer_demand_evidence: suggestions?.buyer_demand_evidence || decisionDeal.buyer_demand_evidence,
        exit_strategy: suggestions?.exit_strategy || decisionDeal.exit_strategy,
        target_buyer_type: suggestions?.target_buyer_type || decisionDeal.target_buyer_type,
      };
      const { data, error } = await createDeal(payload, user);
      if (error && !data) throw new Error(error);
      if (!data) throw new Error("Deal save failed.");

      await createDealActivity({
        deal_id: data.id,
        actor: user,
        activity_type: submitForReview ? "submitted-review" : "note",
        summary: submitForReview ? "Submitted from property Build Decision tab." : "Saved draft from property Build Decision tab.",
        field_changes: {
          source_lead_id: lead.id,
          ai_recommendation: decisionAnalysis?.recommendation ?? null,
          ai_confidence: decisionAnalysis?.confidence ?? null,
        },
      });
      await updateImportedLandLeadStatus(lead.id, submitForReview ? "converted" : "interested", data.id);
      await createImportedLandLeadActivity({
        leadId: lead.id,
        actor: user,
        activityType: submitForReview ? "converted" : "interested",
        summary: submitForReview ? `Submitted build decision packet: ${data.title}` : `Saved build decision draft: ${data.title}`,
      });

      const workErrors = submitForReview ? await notifyDecisionReviewWork(data) : [];
      setCreatedDecisionDeal(data);
      if (workErrors.length || error) {
        setMessage(`Deal saved, but one follow-up step needs attention: ${workErrors[0] || error}`);
      } else {
        setMessage(submitForReview ? "Build decision submitted for member review." : "Build decision draft saved.");
      }
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deal save failed.");
    } finally {
      setDecisionSaving(false);
    }
  };

  const openPropertyRecord = (propertyId: string) => {
    if (propertyId === lead?.id) {
      setTab("properties");
      setExpandedPropertyId(propertyId);
      return;
    }
    router.push(`/lead/${propertyId}?tab=properties&property=${propertyId}`);
  };

  if (!user) return null;
  if (loading) return (
    <div style={{ padding: 80, textAlign: "center", color: "var(--muted)" }}>Loading lead…</div>
  );
  if (!lead) return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <h2 style={sectionTitle}>Lead not found</h2>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>This lead may have been deleted or you don&apos;t have access.</p>
      <button onClick={() => router.push("/va")} style={{ ...secondaryButton, marginTop: 16 }}>Back to VA workdesk</button>
    </div>
  );

  const stage = lead.status === "interested" ? "Interested" : lead.status === "converted" ? "Converted" : lead.status === "passed" ? "Passed" : lead.outreach_count && lead.outreach_count > 0 ? "Contacted" : "New";
  const headerStats = [
    { label: "Properties", value: String(allProperties.length), detail: allProperties.length === 1 ? "Single parcel" : "Multi-property owner", tone: allProperties.length > 1 ? "hot" as const : "default" as const },
    { label: "Outreach", value: String(lead.outreach_count ?? 0), detail: "Texts + calls logged", tone: "default" as const },
    { label: "Status", value: stage, detail: `Stage on this lead`, tone: lead.status === "interested" ? "hot" as const : "default" as const },
    { label: "Compliance", value: compliance?.allowed ? "Clean" : "Blocked", detail: compliance?.allowed ? "OK to text" : compliance?.blockLabel || "Cannot text", tone: compliance?.allowed ? "good" as const : "hot" as const },
  ];

  return (
    <div className="lead-root" style={{ maxWidth: 1480, margin: "0 auto", padding: "82px 20px 100px" }}>
      <OperatingHeader
        eyebrow="Lead"
        title={lead.owner_name || "Owner unknown"}
        subtitle={[
          lead.property_address,
          lead.county,
          lead.campaign_source || lead.source_system,
        ].filter(Boolean).join(" · ")}
        user={user}
        mode="va"
        actions={
          <>
            <button onClick={() => router.push("/va?tab=outreach")} style={secondaryButton}>Back to Contact Queue</button>
            <button onClick={() => router.push(`/va?tab=packet&lead=${lead.id}`)} style={secondaryButton}>Build Packet</button>
            <button onClick={() => setTab("decision")} style={primaryButton}>Analyze Property</button>
            {lead.deal_id && <button onClick={() => router.push(`/opportunity?deal=${lead.deal_id}`)} style={secondaryButton}>Open Deal File</button>}
            {lead.status !== "interested" && (
              <button onClick={() => logDisposition("interested", "Marked interested from Lead Page", "interested")} style={secondaryButton}>
                Mark Interested
              </button>
            )}
          </>
        }
        stats={headerStats}
      />

      {compliance && !compliance.allowed && (
        <section style={complianceBanner(compliance.severity)}>
          <strong style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
            {compliance.severity === "compliance" ? "⛔ Compliance block" : "⚠ Cannot text"}
          </strong>
          <span>{compliance.blockLabel} — outgoing SMS is disabled for this lead.</span>
        </section>
      )}

      {message && (
        <div style={{ ...panel, padding: 12, marginBottom: 16, borderColor: message.toLowerCase().includes("fail") ? "var(--obsidian)" : "var(--brass)" }}>
          <p style={{ fontSize: 13, color: "var(--ink)" }}>{message}</p>
        </div>
      )}

      <div style={{ ...panel, padding: 8, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            style={tab === t.value ? tabActive : tabButton}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={panel}>
            <p style={eyebrowSmall}>Next action</p>
            <h2 style={{ ...sectionTitle, fontSize: 24, marginTop: 4 }}>{nextActionText}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button onClick={() => setTab("conversation")} disabled={!compliance?.allowed} style={{ ...primaryButton, opacity: compliance?.allowed ? 1 : 0.55 }}>
                {compliance?.allowed ? "Message Seller →" : "SMS disabled"}
              </button>
              <button onClick={() => setTab("conversation")} style={secondaryButton}>Open Conversation</button>
              <button onClick={() => setTab("properties")} style={secondaryButton}>Open Properties</button>
              <button onClick={() => setTab("decision")} style={secondaryButton}>Analyze Property</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 16 }} className="lead-overview-grid">
            <div style={{ display: "grid", gap: 16 }}>
              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Recent conversation</p>
                    <h3 style={{ ...sectionTitle, fontSize: 18 }}>3 most recent</h3>
                  </div>
                  <button onClick={() => setTab("conversation")} style={inlineLinkButton}>Open thread →</button>
                </header>
                {recentConversation.length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>No messages or activity yet.</p>
                )}
                <div style={{ display: "grid", gap: 8 }}>
                  {recentConversation.map(item => (
                    <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid var(--fog)", paddingBottom: 8 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: item.kind === "inbound" ? "var(--brass)" : item.kind === "outbound" ? "var(--obsidian)" : "var(--muted)",
                        minWidth: 60,
                      }}>{item.kind}</span>
                      <p style={{ fontSize: 13, color: "var(--ink)", flex: 1, lineHeight: 1.45 }}>{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Properties</p>
                    <h3 style={{ ...sectionTitle, fontSize: 18 }}>{allProperties.length} on this lead</h3>
                  </div>
                  <button onClick={() => setTab("properties")} style={inlineLinkButton}>Open all →</button>
                </header>
                <div style={{ display: "grid", gap: 8 }}>
                  {allProperties.map(prop => (
                    <div key={prop.id} style={{ ...subPanel, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{prop.property_address || prop.parcel_id || "No address"}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                          {prop.acreage ? `${prop.acreage} ac` : "Acres ?"} · {prop.county || "County ?"} · {labelForStatus(prop.status)}
                        </p>
                      </div>
                      <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                        <LandUnderwritingPanel lead={prop} compact />
                      </div>
                      <button onClick={() => openPropertyRecord(prop.id)} style={{ ...secondaryButton, padding: "8px 10px", fontSize: 10, minHeight: 32 }}>
                        Open Record →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <section style={panel}>
                <p style={eyebrowSmall}>Highlights</p>
                <dl style={{ display: "grid", gap: 6, marginTop: 8, fontSize: 13 }}>
                  <Detail label="Phones" value={phones.length ? phones.map(p => `${p.number} (${p.type})`).join(", ") : "None"} />
                  <Detail label="Email" value={lead.email || "—"} />
                  <Detail label="Mailing" value={lead.mailing_address || "—"} />
                  <Detail label="Source" value={lead.source_system || lead.campaign_source || "—"} />
                  <Detail label="First touch" value={lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"} />
                  <Detail label="Last text" value={lead.last_sms_at ? new Date(lead.last_sms_at).toLocaleDateString() : "—"} />
                </dl>
              </section>

              {motivationSignals.length > 0 && (
                <section style={panel}>
                  <p style={eyebrowSmall}>Motivation signals</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {motivationSignals.map(s => (
                      <span key={s.label} style={s.tone === "warn" ? warnChip : s.tone === "good" ? goodChip : mutedChip}>{s.label}</span>
                    ))}
                  </div>
                </section>
              )}

              {buildPreviewDeal && (
                <section style={panel}>
                  <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                    <div>
                      <p style={eyebrowSmall}>Build breakdown preview</p>
                      <h3 style={{ ...sectionTitle, fontSize: 18 }}>Land build analysis</h3>
                    </div>
                    <button onClick={() => setTab("decision")} style={inlineLinkButton}>Analyze →</button>
                  </header>
                  <BuildDealAnalysisPanel value={buildPreviewDeal.build_analysis} deal={buildPreviewDeal} compact />
                </section>
              )}

              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <p style={eyebrowSmall}>Recent activity</p>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>top 5</span>
                </header>
                {activities.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No logged activity yet.</p>}
                <div style={{ display: "grid", gap: 6 }}>
                  {activities.slice(0, 5).map(a => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--ink)" }}>
                      <span style={{ flex: 1 }}>{labelForStatus(a.activity_type)}: {a.summary}</span>
                      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section style={panel}>
                <p style={eyebrowSmall}>Quick note</p>
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Add a note about this lead…"
                  style={textareaStyle}
                />
                <button onClick={saveNote} disabled={!noteDraft.trim()} style={{ ...secondaryButton, marginTop: 8, opacity: noteDraft.trim() ? 1 : 0.55 }}>
                  Save Note
                </button>
              </section>
            </aside>
          </div>
        </section>
      )}

      {tab === "conversation" && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }} className="lead-conv-grid">
          <div style={panel}>
            <ConversationPanel
              eyebrow="Thread"
              title={`Conversation history with ${lead.owner_name || "this seller"}`}
              subject={compliance?.phone?.number || phones[0]?.number || "No phone"}
              communications={communications}
              activities={sortedConvActivities}
              emptyText="No messages yet — send the first text from the right pane."
              maxHeight={520}
            />
          </div>

          <aside style={panel}>
            <p style={eyebrowSmall}>Message seller</p>
            <div style={{ marginTop: 8 }}>
              {compliance && !compliance.allowed && (
                <div style={complianceBanner(compliance.severity)}>
                  <strong style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                    {compliance.severity === "compliance" ? "⛔ Compliance block" : "⚠ Cannot text"}
                  </strong>
                  {compliance.blockLabel}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {SMS_TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setSmsDraft(t.body)}
                    disabled={!compliance?.allowed}
                    style={{ ...secondaryButton, padding: "6px 9px", fontSize: 10, minHeight: 28, opacity: compliance?.allowed ? 1 : 0.55 }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                value={smsDraft}
                onChange={e => setSmsDraft(e.target.value)}
                disabled={!compliance?.allowed}
                placeholder={compliance?.allowed ? "Type your reply…" : "SMS disabled for this lead."}
                rows={5}
                style={textareaStyle}
              />
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                Merge tokens supported: {`{{first_name}} {{county}} {{property_count}}`}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{smsDraft.trim().length} chars</span>
                <button
                  onClick={sendSms}
                  disabled={smsSending || !smsDraft.trim() || !compliance?.allowed}
                  style={{ ...primaryButton, opacity: smsSending || !smsDraft.trim() || !compliance?.allowed ? 0.55 : 1 }}
                >
                  {smsSending ? "Sending…" : "Send SMS"}
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 12 }}>
              <p style={eyebrowSmall}>Quick disposition</p>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <button onClick={() => logDisposition("called", "No answer · Quick disposition")} style={secondaryButton}>No Answer</button>
                <button onClick={() => logDisposition("left-voicemail", "Left voicemail · Quick disposition")} style={secondaryButton}>Voicemail</button>
                <button onClick={() => logDisposition("wrong-number", "Wrong number · Quick disposition", "passed")} style={secondaryButton}>Wrong Number</button>
                <button onClick={() => logDisposition("interested", "Marked interested from conversation pane", "interested")} style={primaryButton}>Mark Interested</button>
                <button onClick={() => logDisposition("not-interested", "Not interested · pass", "passed")} style={secondaryButton}>Pass</button>
              </div>
            </div>
          </aside>
        </section>
      )}

      {tab === "properties" && (
        <section style={{ display: "grid", gap: 12 }}>
          {allProperties.map(prop => {
            const expanded = expandedPropertyId === prop.id;
            const propPhones = collectPhones(prop);
            const propCoordinates = typeof prop.latitude === "number" && typeof prop.longitude === "number"
              ? `${prop.latitude.toFixed(5)}, ${prop.longitude.toFixed(5)}`
              : "—";
            const propRiskFlags = [
              prop.tax_delinquent ? "Tax delinquent" : null,
              prop.is_land_locked ? "Landlocked" : null,
              prop.flood_zone_percent && prop.flood_zone_percent > 0 ? `Flood ${percentValue(prop.flood_zone_percent)}` : null,
              prop.wetlands_percent && prop.wetlands_percent > 0 ? `Wetlands ${percentValue(prop.wetlands_percent)}` : null,
              prop.bad_topography ? "Bad topography" : null,
              prop.tag_odd_shape ? "Odd shape" : null,
              prop.tag_structure ? "Structure" : null,
              prop.tag_farmland ? "Farmland" : null,
              prop.tag_subdivide ? "Subdivide" : null,
              prop.tag_entitlement ? "Entitlement" : null,
            ].filter(Boolean) as string[];
            const propRawEntries = Object.entries(prop.raw_data || {})
              .filter(([, value]) => value !== null && value !== undefined && String(value).trim());
            return (
              <div key={prop.id} style={{ ...panel, padding: 0, overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedPropertyId(expanded ? null : prop.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 18px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: "var(--obsidian)", fontSize: 15 }}>{expanded ? "▼" : "▶"} {prop.property_address || prop.parcel_id || "No address"}</strong>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                      {prop.acreage ? `${prop.acreage} ac` : "Acres ?"} · {prop.county || "County ?"} · Zoned {prop.zoning || "?"} · {labelForStatus(prop.status)}
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
                    {propRiskFlags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {propRiskFlags.map(flag => <span key={flag} style={flag.includes("Tax") || flag.includes("Landlocked") ? warnChip : mutedChip}>{flag}</span>)}
                      </div>
                    )}
                    <PropertyDataSection title="Snapshot" items={[
                      ["Parcel ID", prop.parcel_id || "—"],
                      ["Alt APN", prop.parcel_alt_apn || "—"],
                      ["Source", joinValues([prop.campaign_source, prop.source_system])],
                      ["Status", labelForStatus(prop.status)],
                      ["Duplicate", joinValues([prop.duplicate_status, prop.duplicate_of ? `of ${prop.duplicate_of}` : null])],
                      ["Created", dateValue(prop.created_at)],
                      ["Updated", dateValue(prop.updated_at)],
                      ["Assigned", prop.assigned_to || "—"],
                      ["Follow up", prop.next_follow_up_date || "—"],
                    ]} />
                    <PropertyDataSection title="Location & Legal" items={[
                      ["Situs address", prop.property_address || "—"],
                      ["City / State / ZIP", joinValues([prop.city, prop.state, prop.zip], ", ")],
                      ["County", prop.county || "—"],
                      ["FIPS", prop.fips || "—"],
                      ["Coordinates", propCoordinates],
                      ["Acreage", prop.acreage ? `${numberValue(prop.acreage)} ac` : "—"],
                      ["Calculated acreage", prop.calculated_acreage ? `${numberValue(prop.calculated_acreage)} ac` : "—"],
                      ["Parcel Sq Ft", numberValue(prop.parcel_sq_ft)],
                      ["Legal description", prop.legal_description || "—"],
                      ["Subdivision / Lot / Block", joinValues([prop.subdivision, prop.lot ? `Lot ${prop.lot}` : null, prop.block ? `Block ${prop.block}` : null])],
                    ]} />
                    <PropertyDataSection title="Owner & Contact" items={[
                      ["Primary owner", prop.owner_name || "—"],
                      ["Owner first names", prop.owner_first_names || "—"],
                      ["Owner 1", prop.owner_1_full_name || joinValues([prop.owner_1_first_name, prop.owner_1_middle_name, prop.owner_1_last_name, prop.owner_1_suffix], " ")],
                      ["Owner 2", prop.owner_2_full_name || joinValues([prop.owner_2_first_name, prop.owner_2_middle_name, prop.owner_2_last_name, prop.owner_2_suffix], " ")],
                      ["Owner type", prop.owner_type || "—"],
                      ["Owner occupied", yesNo(prop.owner_occupied)],
                      ["Owner location", prop.owner_out_of_state ? "Out-of-state" : prop.owner_out_of_county ? "Out-of-county" : prop.owner_out_of_zip ? "Out-of-ZIP" : "Local / unflagged"],
                      ["Phones", propPhones.length ? propPhones.map(phone => `${phone.number}${phone.type ? ` (${phone.type})` : ""}`).join(" · ") : "—"],
                      ["Email", prop.email || "—"],
                      ["Mailing", joinValues([prop.mailing_address || prop.mail_address, joinValues([prop.mail_city, prop.mail_state, prop.mail_zip], ", ")], " ")],
                    ]} />
                    <PropertyDataSection title="Value, Tax & Transfer" items={[
                      ["Asking price", money(prop.asking_price)],
                      ["Market value", money(prop.market_value)],
                      ["Assessed value", money(prop.assessed_value)],
                      ["Land value", money(prop.land_value || prop.market_land_value)],
                      ["Improvement value", money(prop.improvement_value || prop.market_improvement_value)],
                      ["Improvement %", percentValue(prop.improvement_percentage)],
                      ["Total parcel value", money(prop.total_parcel_value)],
                      ["Property tax", money(prop.property_tax)],
                      ["Tax year", textValue(prop.tax_year)],
                      ["Tax delinquent", prop.tax_delinquent ? `Yes${prop.tax_delinquent_years ? ` · ${prop.tax_delinquent_years}y` : ""}` : yesNo(prop.tax_delinquent)],
                      ["Delinquent since", prop.taxed_delinquent_since || textValue(prop.tax_delinquent_starting_year)],
                      ["Last sale", joinValues([dateValue(prop.last_sale_date), prop.last_sale_price ? money(prop.last_sale_price) : null])],
                      ["Deed", joinValues([prop.deed_type, prop.deed_book ? `Book ${prop.deed_book}` : null, prop.deed_page ? `Page ${prop.deed_page}` : null])],
                      ["Previous owners", prop.previous_owners || joinValues([prop.previous_owner_1, prop.previous_owner_2])],
                    ]} />
                    <PropertyDataSection title="Land & Development" items={[
                      ["Zoning", prop.zoning || "—"],
                      ["Land use", prop.land_use || "—"],
                      ["Road frontage", numberValue(prop.road_frontage_ft, " ft")],
                      ["Landlocked", yesNo(prop.is_land_locked)],
                      ["Min lot size", numberValue(prop.min_lot_size_acres, " ac")],
                      ["HOA", prop.hoa_status || yesNo(prop.in_hoa)],
                      ["Mineral rights", prop.mineral_rights_status || "—"],
                      ["School district", prop.school_district || "—"],
                      ["Structure", joinValues([prop.tag_structure ? "Flagged" : null, prop.structure_count ? `${prop.structure_count} structures` : null, prop.structure_sq_ft ? `${numberValue(prop.structure_sq_ft)} sf` : null, prop.structure_year_built ? `Built ${prop.structure_year_built}` : null])],
                      ["Rooms / Units / Stories", joinValues([prop.structure_rooms ? `${prop.structure_rooms} rooms` : null, prop.structure_units ? `${prop.structure_units} units` : null, prop.structure_stories ? `${prop.structure_stories} stories` : null])],
                    ]} />
                    <PropertyDataSection title="Risk & Terrain" items={[
                      ["Flood zone", joinValues([percentValue(prop.flood_zone_percent), prop.flood_zone_type])],
                      ["Wetlands", percentValue(prop.wetlands_percent)],
                      ["Topography", prop.topography || (prop.bad_topography ? "Bad topography flag" : "—")],
                      ["Elevation min / avg / max", joinValues([numberValue(prop.min_elevation), numberValue(prop.avg_elevation), numberValue(prop.max_elevation)], " / ")],
                      ["Slope min / avg / max", joinValues([numberValue(prop.min_slope), numberValue(prop.avg_slope), numberValue(prop.max_slope)], " / ")],
                      ["Slope 0-0.5%", percentValue(prop.slope_0_0_5_pct)],
                      ["Slope 0.5-2.5%", percentValue(prop.slope_0_5_2_5_pct)],
                      ["Slope 2.5-5%", percentValue(prop.slope_2_5_5_pct)],
                      ["Slope 5-7.5%", percentValue(prop.slope_5_7_5_pct)],
                      ["Slope 7.5-10%", percentValue(prop.slope_7_5_10_pct)],
                      ["Slope 10-15%", percentValue(prop.slope_10_15_pct)],
                      ["Slope 15-20%", percentValue(prop.slope_15_20_pct)],
                      ["Slope 20-25%", percentValue(prop.slope_20_25_pct)],
                      ["Slope 25-30%", percentValue(prop.slope_25_30_pct)],
                      ["Slope 30-40%", percentValue(prop.slope_30_40_pct)],
                      ["Slope 40-50%", percentValue(prop.slope_40_50_pct)],
                      ["Slope over 50%", percentValue(prop.slope_over_50_pct)],
                    ]} />
                    <PropertyDataSection title="Market & Exit Signals" items={[
                      ["Market PPA", money(prop.market_value_estimate_ppa)],
                      ["Comp count", textValue(prop.market_value_estimate_comp_count)],
                      ["Confidence", prop.market_value_estimate_confidence || "—"],
                      ["Gini index", textValue(prop.market_value_estimate_gini_index)],
                      ["Odd shape", yesNo(prop.tag_odd_shape)],
                      ["Farmland", yesNo(prop.tag_farmland)],
                      ["Subdivide", yesNo(prop.tag_subdivide)],
                      ["Entitlement", yesNo(prop.tag_entitlement)],
                      ["Lead score", textValue(prop.lead_score)],
                      ["Score reasons", prop.score_reasons?.join(" · ") || "—"],
                    ]} />
                    <PropertyDataSection title="Mortgage & Compliance" items={[
                      ["Mortgage", prop.mortgage_amount ? money(prop.mortgage_amount) : "—"],
                      ["Mortgage lender", prop.mortgage_lender || "—"],
                      ["Mortgage type", joinValues([prop.mortgage_type, prop.mortgage_loan_type])],
                      ["Mortgage length", prop.mortgage_length ? `${numberValue(prop.mortgage_length)} months` : "—"],
                      ["Mortgage interest", percentValue(prop.mortgage_interest)],
                      ["Do not mail", yesNo(prop.do_not_mail)],
                      ["DNC", yesNo(prop.dnc)],
                      ["State DNC", yesNo(prop.state_dnc)],
                      ["Litigator", yesNo(prop.litigator)],
                      ["SMS opt status", prop.sms_opt_status || "—"],
                    ]} />
                    <PropertyDataSection title="Enrichment" items={[
                      ["Seller IQ", prop.seller_iq || "—"],
                      ["Age", textValue(prop.age)],
                      ["Gender", prop.gender || "—"],
                      ["Ethnicity", prop.ethnic_group || "—"],
                      ["Religion", prop.religion || "—"],
                      ["Education", prop.education_level || "—"],
                      ["Occupation", prop.occupation || "—"],
                      ["Language", prop.language || "—"],
                      ["Marital status", prop.marital_status || "—"],
                    ]} />
                    <PropertyDataSection title="Workflow & Outreach" items={[
                      ["Outreach count", textValue(prop.outreach_count)],
                      ["Last activity", joinValues([prop.last_activity_type, dateValue(prop.last_activity_at)])],
                      ["Last SMS", joinValues([prop.last_sms_direction, dateValue(prop.last_sms_at)])],
                      ["Last SMS body", prop.last_sms_body || "—"],
                      ["Sakari contact", prop.sakari_contact_id || "—"],
                      ["Sakari conversation", prop.sakari_conversation_id || "—"],
                      ["Uploaded by", prop.uploaded_by || "—"],
                      ["Batch", prop.batch_id || "—"],
                    ]} />
                    <PropertyDataSection title="Links" items={[
                      ["Property URL", prop.property_url ? <a href={prop.property_url} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open property URL</a> : "—"],
                      ["Parcel link", prop.parcel_link ? <a href={prop.parcel_link} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open parcel link</a> : "—"],
                      ["Comping link", prop.comping_link ? <a href={prop.comping_link} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open comping link</a> : "—"],
                      ["Google map", prop.google_map_url ? <a href={prop.google_map_url} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open map</a> : "—"],
                      ["Google Earth", prop.google_earth_url ? <a href={prop.google_earth_url} target="_blank" rel="noreferrer" style={inlineLinkButton}>Open Earth</a> : "—"],
                    ]} columns={2} />
                    <ParsedListingFacts rawData={prop.raw_data} sourceUrl={prop.property_url} title="Parsed Listing Facts" />
                    {propRawEntries.length > 0 && (
                      <details style={subPanel}>
                        <summary style={{ color: "var(--obsidian)", cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                          Source Raw Fields ({propRawEntries.length})
                        </summary>
                        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 12, maxHeight: 360, overflow: "auto" }}>
                          {propRawEntries.map(([key, value]) => (
                            <Detail key={key} label={key} value={String(value)} />
                          ))}
                        </dl>
                      </details>
                    )}
                    <div style={subPanel}>
                      <p style={{ ...eyebrowSmall, marginBottom: 8 }}>Calculator Summary</p>
                      <LandUnderwritingPanel lead={prop} />
                    </div>
                    <div style={subPanel}>
                      <p style={{ ...eyebrowSmall, marginBottom: 8 }}>Exit Matrix</p>
                      <LandUnderwritingMatrix lead={prop} />
                    </div>
                    {prop.notes && (
                      <div style={subPanel}>
                        <p style={{ ...eyebrowSmall, marginBottom: 4 }}>Notes</p>
                        <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{prop.notes}</p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => openPropertyRecord(prop.id)} style={primaryButton}>Open Record →</button>
                      <button
                        onClick={() => {
                          if (prop.id === lead.id) setTab("decision");
                          else router.push(`/lead/${prop.id}?tab=decision`);
                        }}
                        style={secondaryButton}
                      >
                        Analyze Property
                      </button>
                      {prop.deal_id && <button onClick={() => router.push(`/opportunity?deal=${prop.deal_id}`)} style={secondaryButton}>Open Deal File</button>}
                      {prop.status !== "passed" && (
                        <button onClick={async () => {
                          await updateImportedLandLeadStatus(prop.id, "passed", prop.deal_id);
                          await loadAll();
                        }} style={secondaryButton}>Pass</button>
                      )}
                      {prop.property_url && <a href={prop.property_url} target="_blank" rel="noreferrer" style={secondaryButton}>External record</a>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {tab === "decision" && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="lead-decision-grid">
          <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
            <section style={panel}>
              <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <p style={eyebrowSmall}>Land-to-build framework</p>
                  <h3 style={{ ...sectionTitle, fontSize: 22 }}>Build decision for {lead.property_address || lead.parcel_id || "this property"}</h3>
                  <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                    This is the permanent decision workspace for the parcel: verify the gates, run AI, then save or submit the member packet from here.
                  </p>
                </div>
                {decisionBuild && <span style={decisionBuild.recommendation === "Likely Pass" ? warnChip : decisionBuild.recommendation === "Needs More Info" ? mutedChip : goodChip}>{decisionBuild.recommendation}</span>}
              </header>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {decisionGates.map(gate => <DecisionGateCard key={gate.title} gate={gate} />)}
              </div>
            </section>

            {decisionDeal && (
              <BuildDealAnalysisPanel
                value={decisionDeal.build_analysis}
                deal={decisionDeal}
                editable
                onChange={next => {
                  setDecisionBuildDraft(next);
                  setDecisionAnalysis(null);
                  setDecisionAiError("");
                }}
              />
            )}

            <DealAiAnalysisPanel
              result={decisionAnalysis}
              loading={decisionAiRunning}
              error={decisionAiError}
              onAnalyze={runDecisionAiAnalysis}
              onApply={applyDecisionAiSuggestions}
              canApply={Boolean(decisionAnalysis)}
            />
          </div>

          <aside style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
            <section style={panel}>
              <p style={eyebrowSmall}>Decision controls</p>
              <h3 style={{ ...sectionTitle, fontSize: 20 }}>Run analysis here</h3>
              <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                Add comps or build notes, then run AI without leaving the property record.
              </p>
              <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                <span style={{ ...eyebrowSmall, marginBottom: 0 }}>Sold new-build comps / buyer demand</span>
                <textarea
                  value={decisionEvidence}
                  onChange={event => {
                    setDecisionEvidence(event.target.value);
                    setDecisionAnalysis(null);
                    setDecisionAiError("");
                  }}
                  rows={4}
                  placeholder="Paste sold new-build comp notes, MLS numbers, sale prices, sqft, school district, or buyer demand evidence."
                  style={textareaStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
                <span style={{ ...eyebrowSmall, marginBottom: 0 }}>Decision notes</span>
                <textarea
                  value={decisionNotes}
                  onChange={event => {
                    setDecisionNotes(event.target.value);
                    setDecisionAnalysis(null);
                    setDecisionAiError("");
                  }}
                  rows={3}
                  placeholder="Offer terms, contingencies, build assumptions, lender notes, or member concerns."
                  style={textareaStyle}
                />
              </label>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button onClick={runDecisionAiAnalysis} disabled={decisionAiRunning || !decisionDeal} style={{ ...primaryButton, opacity: decisionAiRunning || !decisionDeal ? 0.55 : 1 }}>
                  {decisionAiRunning ? "Analyzing..." : "Run AI + Fill Draft"}
                </button>
                <button onClick={() => saveDecisionDeal(false)} disabled={decisionSaving || !decisionDeal} style={{ ...secondaryButton, opacity: decisionSaving || !decisionDeal ? 0.55 : 1 }}>
                  {decisionSaving ? "Saving..." : "Save Draft"}
                </button>
                <button onClick={() => saveDecisionDeal(true)} disabled={decisionSaving || !decisionDeal} style={{ ...primaryButton, opacity: decisionSaving || !decisionDeal ? 0.55 : 1 }}>
                  {decisionSaving ? "Submitting..." : "Submit For Review"}
                </button>
              </div>
              {createdDecisionDeal && (
                <div style={{ ...subPanel, marginTop: 12 }}>
                  <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{createdDecisionDeal.title}</strong>
                  <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{labelForStatus(createdDecisionDeal.status)} · {createdDecisionDeal.analysis.recommendation}</p>
                  <button onClick={() => router.push(`/opportunity?deal=${createdDecisionDeal.id}`)} style={{ ...secondaryButton, marginTop: 8 }}>Open Deal File</button>
                </div>
              )}
            </section>

            <section style={panel}>
              <p style={eyebrowSmall}>Framework math</p>
              <div style={{ display: "grid", gap: 9, marginTop: 8 }}>
                <Detail label="Ask" value={money(decisionDeal?.asking_price)} />
                <Detail label="Target ARV" value={money(decisionBuild?.targetArv)} />
                <Detail label="Break-even sale" value={money(decisionBuild?.breakEvenSalePrice)} />
                <Detail label="Base profit" value={money(decisionBuild?.baseNetProfit)} />
                <Detail label="Base ROI" value={decisionBuild?.baseRoi !== null && decisionBuild?.baseRoi !== undefined ? `${(decisionBuild.baseRoi * 100).toFixed(1)}%` : "—"} />
                <Detail label="Cash required" value={money(decisionBuild?.cashRequiredFromGroup)} />
                <Detail label="Missing items" value={decisionBuild?.missingInfo.length ? decisionBuild.missingInfo.join(" · ") : "None flagged"} />
              </div>
            </section>
          </aside>
        </section>
      )}

      {tab === "research" && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16 }} className="lead-research-grid">
          <div style={{ display: "grid", gap: 16 }}>
            <section style={panel}>
              <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={eyebrowSmall}>Verified property facts</p>
                  <h3 style={{ ...sectionTitle, fontSize: 20 }}>Current record values</h3>
                </div>
                <span style={researchCompleteCount === researchItems.length && researchItems.length ? goodChip : warnChip}>
                  {researchCompleteCount} of {researchItems.length} checks resolved
                </span>
              </header>
              <VerifiedFactBoard
                groups={verifiedFactGroups}
                statusByCategory={researchStatusByCategory}
                editingFactId={editingFactId}
                factDraft={factDraft}
                saving={savingResearch}
                onStartEdit={startFactEdit}
                onCancelEdit={cancelFactEdit}
                onDraftValueChange={updateFactDraftValue}
                onDraftMetaChange={patch => setFactDraft(prev => ({ ...prev, ...patch }))}
                onSave={saveFactUpdate}
              />
            </section>

            <details style={panel}>
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <p style={eyebrowSmall}>Evidence log</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>Checklist and saved source results</h3>
                    <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                      Open this only when you need to review source history or manually change a checklist status.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={mutedChip}>{researchCompleteCount} of {researchItems.length} saved</span>
                    <span style={compSummary.trusted ? goodChip : warnChip}>
                      {compSummary.trusted ? "Comp support ready" : "Needs 3 sold comps"}
                    </span>
                    <button onClick={runAutoResearch} disabled={autoResearchRunning} style={{ ...primaryButton, opacity: autoResearchRunning ? 0.55 : 1 }}>
                      {autoResearchRunning ? "Running..." : "Run Auto Research"}
                    </button>
                  </div>
                </header>
              </summary>
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {autoResearchResult && (
                <div style={{ ...subPanel, marginBottom: 12 }}>
                  <p style={eyebrowSmall}>Last automatic research run</p>
                  <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <Detail label="Geocoder" value={autoResearchResult.location.geocoder || "—"} />
                    <Detail label="Matched address" value={autoResearchResult.location.matched_address || "—"} />
                    <Detail label="Coordinates" value={autoResearchResult.location.latitude && autoResearchResult.location.longitude ? `${autoResearchResult.location.latitude.toFixed(5)}, ${autoResearchResult.location.longitude.toFixed(5)}` : "Missing"} />
                    <Detail label="Warnings" value={String(autoResearchResult.warnings.length)} />
                  </dl>
                  {autoResearchResult.warnings.length > 0 && (
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                      {autoResearchResult.warnings.slice(0, 2).join(" ")}
                    </p>
                  )}
                </div>
              )}
              <div style={{ display: "grid", gap: 8 }}>
                {researchItems.map(item => (
                  <div key={item.id} style={{ ...subPanel, display: "grid", gap: 8, borderColor: item.status === "verified" ? "rgba(20,17,13,0.18)" : item.status === "blocked" ? "var(--brass)" : "var(--fog)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 260px" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 5 }}>
                          <span style={researchStatusChipStyle(item.status)}>{labelForStatus(item.status)}</span>
                          <span style={{ ...eyebrowSmall, marginBottom: 0 }}>{labelForStatus(item.category)}</span>
                        </div>
                        <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{item.title}</strong>
                        {(item.evidence_value || item.result_summary) && (
                          <div style={{ background: "rgba(255,255,255,0.62)", border: "1px solid var(--fog)", borderRadius: 6, marginTop: 8, padding: "8px 9px" }}>
                            <p style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 3, textTransform: "uppercase" }}>Recorded result</p>
                            <p style={{ color: "var(--ink)", fontSize: 12, lineHeight: 1.45 }}>
                              {[item.evidence_value, item.result_summary].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        )}
                        {item.notes && <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 7, lineHeight: 1.45 }}>{item.notes}</p>}
                      </div>
                      <select
                        value={item.status}
                        disabled={savingResearch}
                        onChange={e => updateResearchStatus(item, e.target.value as LandDueDiligenceStatus)}
                        style={{ ...inputStyle, width: 150 }}
                      >
                        <option value="todo">To do</option>
                        <option value="in-progress">In progress</option>
                        <option value="verified">Verified</option>
                        <option value="blocked">Blocked</option>
                        <option value="not-applicable">N/A</option>
                      </select>
                    </div>
                    {item.source_url && (
                      <a href={item.source_url} target="_blank" rel="noreferrer" style={{ ...inlineLinkButton, width: "fit-content" }}>
                        Open {item.source_name || "source"} →
                      </a>
                    )}
                  </div>
                ))}
              </div>
              </div>
            </details>

            <section style={panel}>
              <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={eyebrowSmall}>Comps</p>
                  <h3 style={{ ...sectionTitle, fontSize: 20 }}>{compRecords.length} saved comps</h3>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={mutedChip}>{compSummary.soldCount} sold</span>
                  <span style={mutedChip}>{compSummary.activeCount} active</span>
                  <span style={compSummary.trusted ? goodChip : warnChip}>{compSummary.medianPpa ? `${money(compSummary.medianPpa)}/ac median` : "No PPA yet"}</span>
                </div>
              </header>

              <div style={{ ...subPanel, display: "grid", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) 120px 100px", gap: 8 }} className="lead-comp-form">
                  <select value={compDraft.compType} onChange={e => setCompDraft({ ...compDraft, compType: e.target.value as LandCompType })} style={inputStyle}>
                    <option value="sold">Sold</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                    <option value="manual-note">Note</option>
                  </select>
                  <input value={compDraft.address} onChange={e => setCompDraft({ ...compDraft, address: e.target.value })} placeholder="Comp address" style={inputStyle} />
                  <input value={compDraft.price} onChange={e => setCompDraft({ ...compDraft, price: e.target.value })} placeholder="Price" style={inputStyle} />
                  <input value={compDraft.acreage} onChange={e => setCompDraft({ ...compDraft, acreage: e.target.value })} placeholder="Acres" style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 100px minmax(0, 1fr)", gap: 8 }} className="lead-comp-form">
                  <input value={compDraft.saleOrListDate} onChange={e => setCompDraft({ ...compDraft, saleOrListDate: e.target.value })} type="date" style={inputStyle} />
                  <input value={compDraft.distanceMiles} onChange={e => setCompDraft({ ...compDraft, distanceMiles: e.target.value })} placeholder="Miles" style={inputStyle} />
                  <input value={compDraft.sourceUrl} onChange={e => updateCompSourceUrl(e.target.value)} placeholder="Comp source link" style={inputStyle} />
                </div>
                <textarea
                  value={compDraft.listingText}
                  onChange={e => updateCompListingText(e.target.value)}
                  rows={2}
                  placeholder="Paste copied listing text here to auto-fill price, acres, address, and sold/active status."
                  style={textareaStyle}
                />
                <textarea
                  value={compDraft.similarityNotes}
                  onChange={e => setCompDraft({ ...compDraft, similarityNotes: e.target.value })}
                  rows={2}
                  placeholder="Similarity notes: acreage range, county, road access, land only, usable shape..."
                  style={textareaStyle}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={compDraft.confidence} onChange={e => setCompDraft({ ...compDraft, confidence: e.target.value as LandCompConfidence })} style={{ ...inputStyle, width: 170 }}>
                    <option value="needs-review">Needs review</option>
                    <option value="low">Low confidence</option>
                    <option value="medium">Medium confidence</option>
                    <option value="high">High confidence</option>
                  </select>
                  <button onClick={addCompRecord} disabled={savingResearch} style={{ ...primaryButton, opacity: savingResearch ? 0.55 : 1 }}>
                    Save Comp
                  </button>
                </div>
              </div>

              {compRecords.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No comps saved yet. Start with sold land comps, then add active listings to check market support.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {compRecords.map(comp => {
                    const expanded = expandedCompId === comp.id;
                    return (
                      <div key={comp.id} style={subPanel}>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px 120px", gap: 10, alignItems: "center" }} className="lead-comp-row">
                          <button
                            type="button"
                            onClick={() => setExpandedCompId(expanded ? null : comp.id)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                          >
                            <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{comp.address || comp.parcel_id || comp.source_url || "Saved comp"}</strong>
                            <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>
                              {labelForStatus(comp.comp_type)} · {comp.sale_or_list_date || "Date ?"} · {comp.distance_miles != null ? `${comp.distance_miles} mi` : "Distance ?"} · {labelForStatus(comp.confidence)}
                            </p>
                            {comp.relationship_status && <p style={{ color: "var(--brass)", fontSize: 11, marginTop: 3 }}>{labelForStatus(comp.relationship_status)} comp link</p>}
                            {comp.similarity_notes && <p style={{ color: "var(--ink)", fontSize: 12, marginTop: 5 }}>{comp.similarity_notes}</p>}
                          </button>
                          <span style={{ color: "var(--obsidian)", fontWeight: 800, fontSize: 13 }}>{money(comp.price)}</span>
                          <span style={{ color: "var(--brass)", fontWeight: 800, fontSize: 13 }}>{comp.price_per_acre ? `${money(comp.price_per_acre)}/ac` : "PPA ?"}</span>
                        </div>
                        {expanded && <CompDetails comp={comp} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {potentialCompRecords.length > 0 && (
              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={eyebrowSmall}>Potential comps</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>Reusable comps that may fit</h3>
                  </div>
                  <span style={mutedChip}>{potentialCompRecords.length} suggested</span>
                </header>
                <div style={{ display: "grid", gap: 8 }}>
                  {potentialCompRecords.map(comp => (
                    <div key={comp.id} style={{ ...subPanel, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px 120px", gap: 10, alignItems: "center" }} className="lead-comp-row">
                      <div>
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{comp.address || comp.parcel_id || comp.source_url || "Potential comp"}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>
                          {labelForStatus(comp.comp_type)} · {comp.county || "County ?"} · {comp.acreage ? `${comp.acreage} ac` : "Acres ?"} · {comp.similarity_score ? `${Math.round(comp.similarity_score)} score` : "Score ?"}
                        </p>
                        {comp.match_reason && <p style={{ color: "var(--ink)", fontSize: 12, marginTop: 5 }}>{comp.match_reason}</p>}
                      </div>
                      <span style={{ color: "var(--obsidian)", fontWeight: 800, fontSize: 13 }}>{money(comp.price)}</span>
                      <button type="button" onClick={() => handleUsePotentialComp(comp)} disabled={savingResearch} style={{ ...secondaryButton, minHeight: 34, padding: "7px 9px", opacity: savingResearch ? 0.55 : 1 }}>Use Comp</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section style={panel}>
              <p style={eyebrowSmall}>Decision rule</p>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <Detail label="Sold comp trust" value={compSummary.trusted ? "Ready" : "Need 3 sold comps"} />
                <Detail label="Median PPA" value={compSummary.medianPpa ? `${money(compSummary.medianPpa)}/ac` : "Missing"} />
                <Detail label="Average PPA" value={compSummary.averagePpa ? `${money(compSummary.averagePpa)}/ac` : "Missing"} />
                <Detail label="Blockers" value={researchItems.filter(item => item.status === "blocked").map(item => labelForStatus(item.category)).join(", ") || "None marked"} />
              </div>
            </section>
          </aside>
        </section>
      )}

      <style jsx>{`
        @media (max-width: 1180px) {
          .lead-root { padding-top: 28px !important; }
          .lead-overview-grid, .lead-conv-grid, .lead-decision-grid, .lead-research-grid, .lead-fact-grid, .lead-fact-edit-grid, .lead-comp-form, .lead-comp-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function numberValue(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function percentValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function dateValue(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function textValue(value: string | number | boolean | null | undefined): string {
  if (typeof value === "boolean") return yesNo(value);
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
  if (typeof value === "string" && value.trim()) return value;
  return "—";
}

function joinValues(values: Array<string | number | boolean | null | undefined>, separator = " · "): string {
  const cleaned = values
    .map(value => textValue(value))
    .filter(value => value !== "—");
  return cleaned.join(separator) || "—";
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</dt>
      <dd style={{ color: "var(--ink)", fontSize: 13, lineHeight: 1.35, margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
    </div>
  );
}

function decisionGateChipStyle(status: DecisionGateTone): React.CSSProperties {
  if (status === "ready") return goodChip;
  if (status === "blocked") return warnChip;
  return mutedChip;
}

function DecisionGateCard({ gate }: { gate: { title: string; status: DecisionGateTone; detail: string; next: string } }) {
  const label = gate.status === "ready" ? "Ready" : gate.status === "blocked" ? "Blocked" : "Needs proof";
  return (
    <div style={{ ...subPanel, minHeight: 162, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{gate.title}</strong>
        <span style={{ ...decisionGateChipStyle(gate.status), padding: "3px 7px", fontSize: 10 }}>{label}</span>
      </div>
      <p style={{ color: "var(--ink)", fontSize: 12, lineHeight: 1.45 }}>{gate.detail}</p>
      <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.45, marginTop: "auto" }}>{gate.next}</p>
    </div>
  );
}

function PropertyDataSection({ title, items, columns = 3 }: { title: string; items: Array<[string, React.ReactNode]>; columns?: number }) {
  return (
    <div style={subPanel}>
      <p style={{ ...eyebrowSmall, marginBottom: 8 }}>{title}</p>
      <dl style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${columns === 2 ? 220 : 170}px, 1fr))`, gap: 12, fontSize: 12, color: "var(--ink)" }}>
        {items.map(([label, value]) => <Detail key={label} label={label} value={value || "—"} />)}
      </dl>
    </div>
  );
}

function factValueIsMissing(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === "" || value === "—";
}

function researchStatusChipStyle(status: LandDueDiligenceStatus | undefined, missing = false): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "3px 7px",
    fontSize: 10,
    whiteSpace: "nowrap",
  };
  if (missing) return { ...warnChip, ...base };
  if (status === "verified") return { ...goodChip, ...base };
  if (status === "blocked") return { ...warnChip, ...base, background: "rgba(176,137,84,0.2)" };
  if (status === "in-progress") return { ...mutedChip, ...base, borderColor: "var(--brass)", color: "var(--obsidian)" };
  return { ...mutedChip, ...base };
}

function VerifiedFactBoard({
  groups,
  statusByCategory,
  editingFactId,
  factDraft,
  saving,
  onStartEdit,
  onCancelEdit,
  onDraftValueChange,
  onDraftMetaChange,
  onSave,
}: {
  groups: VerifiedFactGroup[];
  statusByCategory: Partial<Record<LandDueDiligenceCategory, LandDueDiligenceStatus>>;
  editingFactId: string | null;
  factDraft: FactDraft;
  saving: boolean;
  onStartEdit: (item: VerifiedFactItem) => void;
  onCancelEdit: () => void;
  onDraftValueChange: (key: keyof ManualResearchLeadPatch, value: string) => void;
  onDraftMetaChange: (patch: Partial<Omit<FactDraft, "values">>) => void;
  onSave: (item: VerifiedFactItem) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }} className="lead-fact-grid">
      {groups.map(group => (
        <div key={group.title} style={{ ...subPanel, background: "rgba(255,255,255,0.58)" }}>
          <p style={{ ...eyebrowSmall, marginBottom: 10 }}>{group.title}</p>
          <dl style={{ display: "grid", gap: 9 }}>
            {group.items.map(item => {
              const status = item.category ? statusByCategory[item.category] : undefined;
              const missing = factValueIsMissing(item.value);
              const editing = editingFactId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(118px, 0.7fr) minmax(0, 1fr) auto auto",
                    gap: 9,
                    alignItems: "center",
                    borderBottom: "1px solid var(--fog)",
                    paddingBottom: 8,
                  }}
                >
                  <dt style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {item.label}
                  </dt>
                  <dd style={{ color: missing ? "var(--muted)" : "var(--obsidian)", fontSize: 13, fontWeight: missing ? 500 : 800, lineHeight: 1.35, margin: 0, overflowWrap: "anywhere" }}>
                    {missing ? "—" : item.value}
                  </dd>
                  <span style={researchStatusChipStyle(status, missing)}>
                    {missing ? "Missing" : status ? labelForStatus(status) : "Needs Check"}
                  </span>
                  {item.fields.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => editing ? onCancelEdit() : onStartEdit(item)}
                      style={{ ...secondaryButton, minHeight: 30, padding: "6px 8px", fontSize: 10 }}
                    >
                      {editing ? "Close" : missing ? "Add" : "Edit"}
                    </button>
                  ) : (
                    <span />
                  )}
                  {editing && (
                    <div style={{ gridColumn: "1 / -1", display: "grid", gap: 9, background: "rgba(255,255,255,0.74)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                        {item.fields.map(field => (
                          <VerifiedFactInput
                            key={field.key}
                            field={field}
                            value={factDraft.values[field.key] ?? ""}
                            onChange={value => onDraftValueChange(field.key, value)}
                          />
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 0.6fr) minmax(180px, 1fr) minmax(180px, 1fr)", gap: 8 }} className="lead-fact-edit-grid">
                        <input value={factDraft.sourceName} onChange={event => onDraftMetaChange({ sourceName: event.target.value })} placeholder="Source" style={inputStyle} />
                        <input value={factDraft.sourceUrl} onChange={event => onDraftMetaChange({ sourceUrl: event.target.value })} placeholder="Source URL" style={inputStyle} />
                        <input value={factDraft.notes} onChange={event => onDraftMetaChange({ notes: event.target.value })} placeholder="Notes" style={inputStyle} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <label style={{ display: "inline-flex", gap: 7, alignItems: "center", color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
                            <input
                              type="checkbox"
                              checked={factDraft.verifyChecklist}
                              onChange={event => onDraftMetaChange({ verifyChecklist: event.target.checked })}
                            />
                            Save evidence
                          </label>
                          {factDraft.sourceUrl && (
                            <a href={factDraft.sourceUrl} target="_blank" rel="noreferrer" style={inlineLinkButton}>
                              Open Source →
                            </a>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={onCancelEdit} disabled={saving} style={{ ...secondaryButton, minHeight: 34, padding: "7px 10px", fontSize: 10, opacity: saving ? 0.55 : 1 }}>Cancel</button>
                          <button type="button" onClick={() => onSave(item)} disabled={saving} style={{ ...primaryButton, minHeight: 34, padding: "7px 10px", fontSize: 10, opacity: saving ? 0.55 : 1 }}>
                            Save Update
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

function VerifiedFactInput({ field, value, onChange }: { field: VerifiedFactField; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.11em", textTransform: "uppercase" }}>{field.label}</span>
      {field.kind === "boolean" ? (
        <select value={value} onChange={event => onChange(event.target.value)} style={inputStyle}>
          <option value="">Unknown</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder || field.label}
          type={field.kind === "url" ? "url" : "text"}
          style={inputStyle}
        />
      )}
    </label>
  );
}

function CompDetails({ comp }: { comp: LandCompRecord }) {
  const rawEntries = Object.entries(comp.raw_data || {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .slice(0, 80);
  return (
    <div style={{ borderTop: "1px solid var(--fog)", display: "grid", gap: 10, marginTop: 12, paddingTop: 12 }}>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Detail label="Reusable ID" value={comp.comp_property_id || comp.id} />
        <Detail label="Parcel" value={comp.parcel_id || "—"} />
        <Detail label="Location" value={[comp.city, comp.county, comp.state, comp.zip].filter(Boolean).join(", ") || "—"} />
        <Detail label="Source" value={comp.source_system || "—"} />
        <Detail label="Status" value={comp.relationship_status ? labelForStatus(comp.relationship_status) : "Linked"} />
        <Detail label="Match" value={comp.match_reason || "Manually saved"} />
      </dl>
      {comp.source_url && (
        <a href={comp.source_url} target="_blank" rel="noreferrer" style={{ ...inlineLinkButton, width: "fit-content" }}>
          Open comp source →
        </a>
      )}
      <ParsedListingFacts rawData={comp.raw_data} listingText={comp.listing_text} sourceUrl={comp.source_url} title="Comp Parsed Listing Facts" />
      {rawEntries.length > 0 && (
        <div style={{ borderTop: "1px solid var(--fog)", maxHeight: 260, overflow: "auto", paddingTop: 8 }}>
          <p style={{ ...eyebrowSmall, marginBottom: 8 }}>Captured listing fields</p>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {rawEntries.map(([key, value]) => (
              <Detail key={key} label={key} value={typeof value === "object" ? JSON.stringify(value) : String(value)} />
            ))}
          </dl>
        </div>
      )}
      {comp.listing_text && (
        <details style={{ color: "var(--ink)", fontSize: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Listing text</summary>
          <p style={{ color: "var(--muted)", lineHeight: 1.45, marginTop: 8, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap" }}>{comp.listing_text}</p>
        </details>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 16px 44px rgba(20,17,13,0.06)",
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
};

const subPanel: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
};

const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  padding: "10px 13px",
  minHeight: 40,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "transparent",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const inlineLinkButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  padding: 0,
};

const tabButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.58)",
  color: "var(--ink)",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  padding: "10px 16px",
  minHeight: 40,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
};

const tabActive: React.CSSProperties = {
  ...tabButton,
  background: "var(--obsidian)",
  color: "var(--bone)",
  borderColor: "var(--obsidian)",
};

const eyebrowSmall: React.CSSProperties = {
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: "10px 11px",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  lineHeight: 1.45,
  resize: "vertical",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: "10px 11px",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  minHeight: 40,
};

const warnChip: React.CSSProperties = {
  display: "inline-flex",
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 999,
  border: "1px solid var(--brass)",
  background: "rgba(176,137,84,0.14)",
  color: "var(--obsidian)",
};

const goodChip: React.CSSProperties = {
  ...warnChip,
  borderColor: "var(--obsidian)",
  background: "rgba(20,17,13,0.06)",
  color: "var(--obsidian)",
};

const mutedChip: React.CSSProperties = {
  ...warnChip,
  borderColor: "var(--fog)",
  background: "var(--surface)",
  color: "var(--muted)",
};

function complianceBanner(severity: "compliance" | "data-quality" | "recency-dedupe" | undefined): React.CSSProperties {
  if (severity === "compliance") {
    return {
      background: "var(--obsidian)",
      color: "var(--bone)",
      border: "1px solid var(--obsidian)",
      borderRadius: 8,
      padding: "12px 14px",
      marginBottom: 16,
      fontSize: 13,
      lineHeight: 1.5,
    };
  }
  return {
    background: "rgba(176,137,84,0.14)",
    color: "var(--obsidian)",
    border: "1px solid var(--brass)",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 1.5,
  };
}
