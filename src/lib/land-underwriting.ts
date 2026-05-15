import type { ImportedLandLead } from "./land-leads";

export type LandExitType = "land-flip" | "retail-resale" | "neighbor-sale" | "assignment" | "subdivide" | "pass";
export type LandUnderwritingStatus = "strong" | "possible" | "weak" | "pass";

export interface LandUnderwritingAssumptions {
  closingCost: number;
  brokerCommissionPct: number;
  assignmentFee: number;
  targetSpread: number;
  neighborPremiumPct: number;
  retailDiscountPct: number;
  wholesaleDiscountPct: number;
  improvementPct: number;
  subdivideImprovementPerLot: number;
  minimumChildLots: number;
}

export interface LandUnderwritingResult {
  exitType: LandExitType;
  label: string;
  status: LandUnderwritingStatus;
  maxOffer: number | null;
  requiredPpa: number | null;
  requiredResaleValue: number | null;
  projectedSpread: number | null;
  landInsightsPpa: number | null;
  landInsightsValue: number | null;
  keyAssumption: string;
  blocker: string | null;
  nextStep: string;
  rank: number;
}

export interface LandUnderwritingSummary {
  best: LandUnderwritingResult;
  results: LandUnderwritingResult[];
  assumptions: LandUnderwritingAssumptions;
  inputSnapshot: Record<string, unknown>;
}

export const DEFAULT_LAND_UNDERWRITING_ASSUMPTIONS: LandUnderwritingAssumptions = {
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

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value / 100) * 100);
}

function ppa(value: number | null, acres: number | null): number | null {
  if (!value || !acres) return null;
  return Math.round(value / acres);
}

function statusFromSpread(spread: number | null, assumptions: LandUnderwritingAssumptions): LandUnderwritingStatus {
  if (spread === null) return "weak";
  if (spread >= assumptions.targetSpread * 1.5) return "strong";
  if (spread >= assumptions.targetSpread) return "possible";
  if (spread > 0) return "weak";
  return "pass";
}

function rankStatus(status: LandUnderwritingStatus): number {
  return status === "strong" ? 4 : status === "possible" ? 3 : status === "weak" ? 2 : 1;
}

function physicalBlocker(lead: ImportedLandLead): string | null {
  if (lead.is_land_locked) return "Landlocked";
  if ((lead.wetlands_percent ?? 0) > 25) return "Wetlands over 25%";
  if ((lead.flood_zone_percent ?? 0) > 25) return "Flood zone over 25%";
  if (lead.bad_topography) return "Bad topography";
  return null;
}

function result(
  args: Omit<LandUnderwritingResult, "rank">,
): LandUnderwritingResult {
  return { ...args, rank: rankStatus(args.status) };
}

export function calculateLandUnderwriting(
  lead: ImportedLandLead,
  assumptions = DEFAULT_LAND_UNDERWRITING_ASSUMPTIONS,
): LandUnderwritingSummary {
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
  const best = [...results].sort((a, b) =>
    b.rank - a.rank
    || (b.projectedSpread ?? -1) - (a.projectedSpread ?? -1)
    || (b.maxOffer ?? -1) - (a.maxOffer ?? -1),
  )[0] ?? pass;

  return {
    best,
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
