export type BuildScenarioKey = "conservative" | "base" | "optimistic";

export type BuildReadinessStatus = "open" | "in-review" | "verified" | "blocked" | "not-applicable";

export interface BuildLineItem {
  key: string;
  label: string;
  amount: number | null;
  notes?: string | null;
}

export interface BuildStatusCheck {
  key: string;
  label: string;
  status: BuildReadinessStatus;
  notes?: string | null;
}

export interface BuildCommunityResearch {
  subdivision?: string | null;
  section?: string | null;
  developer_builder?: string | null;
  hoa_required?: boolean | null;
  hoa_fee?: number | null;
  architectural_requirements?: string | null;
  required_materials?: string | null;
  minimum_square_feet?: number | null;
  amenities?: string | null;
  year_started?: number | null;
  notes?: string | null;
}

export interface BuildCompResearch {
  target_arv?: number | null;
  average_price_per_sqft?: number | null;
  median_sale_price?: number | null;
  sold_comp_count?: number | null;
  sold_comp_notes?: string | null;
  land_comp_notes?: string | null;
}

export interface BuildSpecs {
  home_size_sqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  garage_spaces?: number | null;
  quality_level?: string | null;
  gc_strategy?: string | null;
  timeline_months?: number | null;
}

export interface BuildBudgetSections {
  pre_construction: BuildLineItem[];
  construction: BuildLineItem[];
  carrying: BuildLineItem[];
  selling_prep: BuildLineItem[];
  additional: BuildLineItem[];
}

export interface BuildTeardown {
  existing_home_sqft?: number | null;
  condition?: string | null;
  line_items: BuildLineItem[];
}

export interface BuildFinancing {
  member_count?: number | null;
  group_cash?: number | null;
  investor_capital?: number | null;
  credit_cards?: number | null;
  construction_loan?: number | null;
  hard_money?: number | null;
  investor_rate_pct?: number | null;
  investor_duration_months?: number | null;
  lender_rate_pct?: number | null;
  lender_points_pct?: number | null;
  lender_duration_months?: number | null;
  credit_card_rate_pct?: number | null;
  notes?: string | null;
}

export interface BuildSellScenarioInput {
  sale_price?: number | null;
  agent_commission_pct?: number | null;
  buyer_concessions_pct?: number | null;
  seller_closing_pct?: number | null;
  timeline_months?: number | null;
}

export interface BuildRentalScenarioInput {
  monthly_rent?: number | null;
  vacancy_pct?: number | null;
  property_management_pct?: number | null;
  insurance_taxes_annual?: number | null;
  maintenance_hoa_annual?: number | null;
  debt_service_monthly?: number | null;
}

export interface BuildWholesaleExitInput {
  contract_price?: number | null;
  earnest_money_at_risk?: number | null;
  assignment_fee?: number | null;
}

export interface BuildExitStrategies {
  build_sell: Record<BuildScenarioKey, BuildSellScenarioInput>;
  rental: Record<BuildScenarioKey, BuildRentalScenarioInput>;
  wholesale: BuildWholesaleExitInput;
}

export interface BuildAnalysisInput {
  community: BuildCommunityResearch;
  comps: BuildCompResearch;
  specs: BuildSpecs;
  status_checks: BuildStatusCheck[];
  teardown: BuildTeardown;
  budget: BuildBudgetSections;
  financing: BuildFinancing;
  exits: BuildExitStrategies;
}

export interface BuildSellScenarioSummary {
  salePrice: number | null;
  sellingCosts: number;
  netProceeds: number | null;
  netProfit: number | null;
  roi: number | null;
  profitPerMember: number | null;
  timelineMonths: number | null;
}

export interface BuildRentalScenarioSummary {
  monthlyRent: number | null;
  annualGrossRent: number | null;
  vacancy: number;
  propertyManagement: number;
  expenses: number;
  noi: number | null;
  capRate: number | null;
  monthlyCashFlow: number | null;
}

export interface BuildAnalysisSummary {
  acquisitionPrice: number;
  teardownTotal: number;
  budgetTotals: Record<keyof BuildBudgetSections, number>;
  constructionGrandTotal: number;
  totalProjectCost: number;
  targetArv: number | null;
  totalFinancingCost: number;
  cashRequiredFromGroup: number;
  cashRequiredPerMember: number | null;
  breakEvenSalePrice: number | null;
  baseNetProfit: number | null;
  baseRoi: number | null;
  baseProfitPerMember: number | null;
  recommendation: "Strong Review" | "Review With Caution" | "Needs More Info" | "Likely Pass";
  missingInfo: string[];
  riskFlags: string[];
  buildSell: Record<BuildScenarioKey, BuildSellScenarioSummary>;
  rental: Record<BuildScenarioKey, BuildRentalScenarioSummary>;
  wholesale: {
    netProfit: number | null;
    profitPerMember: number | null;
  };
}

export type BuildDealSeed = {
  asking_price?: number | null;
  arv?: number | null;
  target_resale_price?: number | null;
  repair_estimate?: number | null;
  acreage?: number | null;
  zoning?: string | null;
  address?: string | null;
};

const STATUS_CHECKS: Array<Omit<BuildStatusCheck, "status" | "notes">> = [
  { key: "community_identified", label: "Community / subdivision identified" },
  { key: "new_build_comps", label: "New-build sold comps researched" },
  { key: "zoning_verified", label: "Zoning and setbacks verified" },
  { key: "flood_checked", label: "Flood / wetlands / buffers checked" },
  { key: "utilities_verified", label: "Water, sewer, gas, and power verified" },
  { key: "construction_budget", label: "Construction budget built" },
  { key: "financing_identified", label: "Financing source identified" },
  { key: "due_diligence_complete", label: "Due diligence blockers cleared" },
  { key: "group_vote", label: "Group vote ready" },
];

const TEARDOWN_ITEMS: Array<Omit<BuildLineItem, "amount" | "notes">> = [
  { key: "demo_permit", label: "Demo permit" },
  { key: "demo_cost", label: "Demolition contractor" },
  { key: "asbestos_lead", label: "Asbestos / lead testing or remediation" },
  { key: "debris_hauling", label: "Debris hauling" },
  { key: "utility_disconnect", label: "Utility disconnect / cap" },
];

const PRE_CONSTRUCTION_ITEMS: Array<Omit<BuildLineItem, "amount" | "notes">> = [
  { key: "closing_costs", label: "Closing costs" },
  { key: "architectural_plans", label: "Architectural plans" },
  { key: "engineer_stamp", label: "Engineer stamp" },
  { key: "survey", label: "Survey / topo / boundary" },
  { key: "arborist_tree_removal", label: "Arborist / tree removal" },
  { key: "hoa_review", label: "HOA architectural review" },
  { key: "permits_impact_fees", label: "Permits / impact fees" },
  { key: "water_sewer_taps", label: "Water / sewer tap fees" },
];

const CONSTRUCTION_ITEMS: Array<Omit<BuildLineItem, "amount" | "notes">> = [
  { key: "site_clearing_grading", label: "Site clearing / grading" },
  { key: "foundation", label: "Foundation" },
  { key: "termite", label: "Termite treatment" },
  { key: "framing_lumber_labor", label: "Framing lumber / labor" },
  { key: "roofing", label: "Roofing" },
  { key: "windows", label: "Windows" },
  { key: "exterior_doors", label: "Exterior doors" },
  { key: "siding", label: "Siding / exterior finish" },
  { key: "garage_door", label: "Garage door" },
  { key: "hvac", label: "HVAC" },
  { key: "electrical", label: "Electrical" },
  { key: "plumbing", label: "Plumbing" },
  { key: "insulation", label: "Insulation" },
  { key: "drywall", label: "Drywall" },
  { key: "paint", label: "Interior / exterior paint" },
  { key: "lvp_flooring", label: "LVP flooring" },
  { key: "tile", label: "Tile" },
  { key: "kitchen_cabinets", label: "Kitchen cabinets" },
  { key: "countertops", label: "Countertops" },
  { key: "appliances", label: "Appliances" },
  { key: "backsplash", label: "Backsplash" },
  { key: "bath_vanities", label: "Bath vanities" },
  { key: "bath_tile_hardware", label: "Bath tile / hardware" },
  { key: "trim", label: "Trim" },
  { key: "interior_doors", label: "Interior doors" },
  { key: "closet_shelving", label: "Closet shelving" },
  { key: "fireplace", label: "Fireplace" },
  { key: "stair_rail", label: "Staircase railing" },
  { key: "deck_patio", label: "Deck / patio" },
  { key: "driveway", label: "Driveway" },
  { key: "landscaping_sod", label: "Landscaping / sod" },
  { key: "gutters", label: "Gutters" },
  { key: "waterproofing_drainage", label: "Waterproofing / drainage" },
  { key: "garage_interior", label: "Garage interior" },
  { key: "dumpster_debris", label: "Dumpster / debris" },
  { key: "mailbox_hardware", label: "Mailbox / hardware" },
  { key: "cleanup", label: "Cleanup" },
  { key: "final_inspections_co", label: "Final inspections / CO" },
];

const CARRYING_ITEMS: Array<Omit<BuildLineItem, "amount" | "notes">> = [
  { key: "builders_risk", label: "Builder's risk insurance" },
  { key: "property_taxes", label: "Property taxes" },
  { key: "hoa", label: "HOA dues" },
  { key: "temp_utilities", label: "Temporary utilities" },
  { key: "post_completion_utilities", label: "Utilities after completion" },
];

const SELLING_PREP_ITEMS: Array<Omit<BuildLineItem, "amount" | "notes">> = [
  { key: "staging", label: "Staging" },
  { key: "photography_drone", label: "Photography / drone" },
  { key: "as_built_survey", label: "As-built survey" },
  { key: "warranty_reserve", label: "Warranty reserve" },
];

const ADDITIONAL_ITEMS: Array<Omit<BuildLineItem, "amount" | "notes">> = [
  { key: "llc_formation", label: "LLC formation / operating agreement" },
  { key: "gc_flat_fee", label: "GC flat fee" },
  { key: "liability_insurance", label: "Liability insurance" },
  { key: "porta_potty", label: "Porta-potty" },
  { key: "business_license", label: "Business license" },
  { key: "reinspections", label: "Reinspections" },
  { key: "accounting", label: "CPA / accountant" },
  { key: "earnest_money", label: "Earnest money" },
];

function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    if (["true", "yes", "y"].includes(clean)) return true;
    if (["false", "no", "n"].includes(clean)) return false;
  }
  return null;
}

function pctToDecimal(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.abs(value) > 1 ? value / 100 : value;
}

function total(items: BuildLineItem[]): number {
  return items.reduce((sum, item) => sum + (amount(item.amount) ?? 0), 0);
}

function normalizeLineItems(value: unknown, defaults: Array<Omit<BuildLineItem, "amount" | "notes">>): BuildLineItem[] {
  const incoming = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
  const used = new Set<number>();
  const merged = defaults.map(def => {
    const index = incoming.findIndex((item, idx) => !used.has(idx) && (item.key === def.key || item.label === def.label));
    if (index >= 0) used.add(index);
    const found = index >= 0 ? incoming[index] : {};
    return {
      key: text(found.key) || def.key,
      label: text(found.label) || def.label,
      amount: amount(found.amount),
      notes: text(found.notes),
    };
  });
  incoming.forEach((item, idx) => {
    if (used.has(idx)) return;
    const label = text(item.label);
    if (!label) return;
    merged.push({
      key: text(item.key) || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      label,
      amount: amount(item.amount),
      notes: text(item.notes),
    });
  });
  return merged;
}

function normalizeStatusChecks(value: unknown): BuildStatusCheck[] {
  const incoming = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
  const validStatuses: BuildReadinessStatus[] = ["open", "in-review", "verified", "blocked", "not-applicable"];
  return STATUS_CHECKS.map(def => {
    const found = incoming.find(item => item.key === def.key || item.label === def.label);
    const status = validStatuses.includes(found?.status as BuildReadinessStatus) ? found?.status as BuildReadinessStatus : "open";
    return { ...def, status, notes: text(found?.notes) };
  });
}

function scenario<T>(value: unknown, key: BuildScenarioKey, defaults: Record<BuildScenarioKey, T>): T {
  if (!value || typeof value !== "object") return defaults[key];
  const found = (value as Record<string, unknown>)[key];
  return found && typeof found === "object" ? { ...defaults[key], ...found as object } as T : defaults[key];
}

function normalizeSellScenario(value: unknown, key: BuildScenarioKey): BuildSellScenarioInput {
  const defaults = {
    conservative: { sale_price: null, agent_commission_pct: 5.5, buyer_concessions_pct: 2, seller_closing_pct: 1, timeline_months: 10 },
    base: { sale_price: null, agent_commission_pct: 5.5, buyer_concessions_pct: 2, seller_closing_pct: 1, timeline_months: 8 },
    optimistic: { sale_price: null, agent_commission_pct: 5.5, buyer_concessions_pct: 1, seller_closing_pct: 1, timeline_months: 7 },
  } satisfies Record<BuildScenarioKey, BuildSellScenarioInput>;
  const row = scenario(value, key, defaults);
  return {
    sale_price: amount(row.sale_price),
    agent_commission_pct: amount(row.agent_commission_pct) ?? defaults[key].agent_commission_pct,
    buyer_concessions_pct: amount(row.buyer_concessions_pct) ?? defaults[key].buyer_concessions_pct,
    seller_closing_pct: amount(row.seller_closing_pct) ?? defaults[key].seller_closing_pct,
    timeline_months: amount(row.timeline_months) ?? defaults[key].timeline_months,
  };
}

function normalizeRentalScenario(value: unknown, key: BuildScenarioKey): BuildRentalScenarioInput {
  const defaults = {
    conservative: { monthly_rent: null, vacancy_pct: 8, property_management_pct: 8, insurance_taxes_annual: null, maintenance_hoa_annual: null, debt_service_monthly: null },
    base: { monthly_rent: null, vacancy_pct: 5, property_management_pct: 8, insurance_taxes_annual: null, maintenance_hoa_annual: null, debt_service_monthly: null },
    optimistic: { monthly_rent: null, vacancy_pct: 4, property_management_pct: 7, insurance_taxes_annual: null, maintenance_hoa_annual: null, debt_service_monthly: null },
  } satisfies Record<BuildScenarioKey, BuildRentalScenarioInput>;
  const row = scenario(value, key, defaults);
  return {
    monthly_rent: amount(row.monthly_rent),
    vacancy_pct: amount(row.vacancy_pct) ?? defaults[key].vacancy_pct,
    property_management_pct: amount(row.property_management_pct) ?? defaults[key].property_management_pct,
    insurance_taxes_annual: amount(row.insurance_taxes_annual),
    maintenance_hoa_annual: amount(row.maintenance_hoa_annual),
    debt_service_monthly: amount(row.debt_service_monthly),
  };
}

export function normalizeBuildAnalysis(value?: unknown, seed?: BuildDealSeed): BuildAnalysisInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const community = input.community && typeof input.community === "object" ? input.community as Record<string, unknown> : {};
  const comps = input.comps && typeof input.comps === "object" ? input.comps as Record<string, unknown> : {};
  const specs = input.specs && typeof input.specs === "object" ? input.specs as Record<string, unknown> : {};
  const teardown = input.teardown && typeof input.teardown === "object" ? input.teardown as Record<string, unknown> : {};
  const budget = input.budget && typeof input.budget === "object" ? input.budget as Record<string, unknown> : {};
  const financing = input.financing && typeof input.financing === "object" ? input.financing as Record<string, unknown> : {};
  const exits = input.exits && typeof input.exits === "object" ? input.exits as Record<string, unknown> : {};
  const buildSell = exits.build_sell && typeof exits.build_sell === "object" ? exits.build_sell : {};
  const rental = exits.rental && typeof exits.rental === "object" ? exits.rental : {};
  const wholesale = exits.wholesale && typeof exits.wholesale === "object" ? exits.wholesale as Record<string, unknown> : {};

  return {
    community: {
      subdivision: text(community.subdivision),
      section: text(community.section),
      developer_builder: text(community.developer_builder),
      hoa_required: bool(community.hoa_required),
      hoa_fee: amount(community.hoa_fee),
      architectural_requirements: text(community.architectural_requirements),
      required_materials: text(community.required_materials),
      minimum_square_feet: amount(community.minimum_square_feet),
      amenities: text(community.amenities),
      year_started: amount(community.year_started),
      notes: text(community.notes),
    },
    comps: {
      target_arv: amount(comps.target_arv) ?? amount(seed?.target_resale_price) ?? amount(seed?.arv),
      average_price_per_sqft: amount(comps.average_price_per_sqft),
      median_sale_price: amount(comps.median_sale_price),
      sold_comp_count: amount(comps.sold_comp_count),
      sold_comp_notes: text(comps.sold_comp_notes),
      land_comp_notes: text(comps.land_comp_notes),
    },
    specs: {
      home_size_sqft: amount(specs.home_size_sqft),
      bedrooms: amount(specs.bedrooms),
      bathrooms: amount(specs.bathrooms),
      garage_spaces: amount(specs.garage_spaces),
      quality_level: text(specs.quality_level),
      gc_strategy: text(specs.gc_strategy) || "Hired GC / builder bid pending",
      timeline_months: amount(specs.timeline_months),
    },
    status_checks: normalizeStatusChecks(input.status_checks),
    teardown: {
      existing_home_sqft: amount(teardown.existing_home_sqft),
      condition: text(teardown.condition),
      line_items: normalizeLineItems(teardown.line_items, TEARDOWN_ITEMS),
    },
    budget: {
      pre_construction: normalizeLineItems(budget.pre_construction, PRE_CONSTRUCTION_ITEMS),
      construction: normalizeLineItems(budget.construction, CONSTRUCTION_ITEMS),
      carrying: normalizeLineItems(budget.carrying, CARRYING_ITEMS),
      selling_prep: normalizeLineItems(budget.selling_prep, SELLING_PREP_ITEMS),
      additional: normalizeLineItems(budget.additional, ADDITIONAL_ITEMS),
    },
    financing: {
      member_count: amount(financing.member_count) ?? 6,
      group_cash: amount(financing.group_cash),
      investor_capital: amount(financing.investor_capital),
      credit_cards: amount(financing.credit_cards),
      construction_loan: amount(financing.construction_loan),
      hard_money: amount(financing.hard_money),
      investor_rate_pct: amount(financing.investor_rate_pct),
      investor_duration_months: amount(financing.investor_duration_months),
      lender_rate_pct: amount(financing.lender_rate_pct),
      lender_points_pct: amount(financing.lender_points_pct),
      lender_duration_months: amount(financing.lender_duration_months),
      credit_card_rate_pct: amount(financing.credit_card_rate_pct),
      notes: text(financing.notes),
    },
    exits: {
      build_sell: {
        conservative: normalizeSellScenario(buildSell, "conservative"),
        base: normalizeSellScenario(buildSell, "base"),
        optimistic: normalizeSellScenario(buildSell, "optimistic"),
      },
      rental: {
        conservative: normalizeRentalScenario(rental, "conservative"),
        base: normalizeRentalScenario(rental, "base"),
        optimistic: normalizeRentalScenario(rental, "optimistic"),
      },
      wholesale: {
        contract_price: amount(wholesale.contract_price),
        earnest_money_at_risk: amount(wholesale.earnest_money_at_risk),
        assignment_fee: amount(wholesale.assignment_fee),
      },
    },
  };
}

export function createDefaultBuildAnalysis(seed?: BuildDealSeed): BuildAnalysisInput {
  return normalizeBuildAnalysis(undefined, seed);
}

export function calculateBuildAnalysis(value: BuildAnalysisInput | unknown, seed?: BuildDealSeed): BuildAnalysisSummary {
  const input = normalizeBuildAnalysis(value, seed);
  const acquisitionPrice = amount(seed?.asking_price) ?? 0;
  const teardownTotal = total(input.teardown.line_items);
  const budgetTotals = {
    pre_construction: total(input.budget.pre_construction),
    construction: total(input.budget.construction),
    carrying: total(input.budget.carrying),
    selling_prep: total(input.budget.selling_prep),
    additional: total(input.budget.additional),
  };
  const constructionGrandTotal = Object.values(budgetTotals).reduce((sum, value) => sum + value, 0);
  const totalProjectCost = acquisitionPrice + teardownTotal + constructionGrandTotal;
  const baseSale = amount(input.exits.build_sell.base.sale_price);
  const targetArv = amount(input.comps.target_arv) ?? baseSale ?? amount(seed?.target_resale_price) ?? amount(seed?.arv);
  const memberCount = Math.max(1, Math.round(amount(input.financing.member_count) ?? 6));
  const investorCapital = amount(input.financing.investor_capital) ?? 0;
  const creditCards = amount(input.financing.credit_cards) ?? 0;
  const constructionLoan = amount(input.financing.construction_loan) ?? 0;
  const hardMoney = amount(input.financing.hard_money) ?? 0;
  const investorReturn = investorCapital * pctToDecimal(input.financing.investor_rate_pct) * ((amount(input.financing.investor_duration_months) ?? input.specs.timeline_months ?? 0) / 12);
  const lenderDebt = constructionLoan + hardMoney;
  const lenderInterest = lenderDebt * pctToDecimal(input.financing.lender_rate_pct) * ((amount(input.financing.lender_duration_months) ?? input.specs.timeline_months ?? 0) / 12);
  const lenderPoints = lenderDebt * pctToDecimal(input.financing.lender_points_pct);
  const cardInterest = creditCards * pctToDecimal(input.financing.credit_card_rate_pct) * ((amount(input.specs.timeline_months) ?? 0) / 12);
  const totalFinancingCost = investorReturn + lenderInterest + lenderPoints + cardInterest;
  const externalFunding = investorCapital + creditCards + constructionLoan + hardMoney;
  const cashRequiredFromGroup = Math.max(0, totalProjectCost + totalFinancingCost - externalFunding);
  const cashRequiredPerMember = cashRequiredFromGroup / memberCount;

  const buildSell = (["conservative", "base", "optimistic"] as BuildScenarioKey[]).reduce((acc, key) => {
    const row = input.exits.build_sell[key];
    const salePrice = amount(row.sale_price) ?? (key === "base" ? targetArv : null);
    const sellPct = pctToDecimal(row.agent_commission_pct) + pctToDecimal(row.buyer_concessions_pct) + pctToDecimal(row.seller_closing_pct);
    const sellingCosts = salePrice ? salePrice * sellPct : 0;
    const netProceeds = salePrice ? salePrice - sellingCosts : null;
    const netProfit = netProceeds !== null ? netProceeds - totalProjectCost - totalFinancingCost : null;
    acc[key] = {
      salePrice,
      sellingCosts,
      netProceeds,
      netProfit,
      roi: netProfit !== null && totalProjectCost > 0 ? netProfit / totalProjectCost : null,
      profitPerMember: netProfit !== null ? netProfit / memberCount : null,
      timelineMonths: amount(row.timeline_months),
    };
    return acc;
  }, {} as Record<BuildScenarioKey, BuildSellScenarioSummary>);

  const baseSellPct = pctToDecimal(input.exits.build_sell.base.agent_commission_pct)
    + pctToDecimal(input.exits.build_sell.base.buyer_concessions_pct)
    + pctToDecimal(input.exits.build_sell.base.seller_closing_pct);
  const breakEvenSalePrice = baseSellPct < 1 ? (totalProjectCost + totalFinancingCost) / (1 - baseSellPct) : null;

  const rental = (["conservative", "base", "optimistic"] as BuildScenarioKey[]).reduce((acc, key) => {
    const row = input.exits.rental[key];
    const monthlyRent = amount(row.monthly_rent);
    const annualGrossRent = monthlyRent !== null ? monthlyRent * 12 : null;
    const vacancy = annualGrossRent ? annualGrossRent * pctToDecimal(row.vacancy_pct) : 0;
    const propertyManagement = annualGrossRent ? annualGrossRent * pctToDecimal(row.property_management_pct) : 0;
    const expenses = vacancy + propertyManagement + (amount(row.insurance_taxes_annual) ?? 0) + (amount(row.maintenance_hoa_annual) ?? 0);
    const noi = annualGrossRent !== null ? annualGrossRent - expenses : null;
    const debtService = (amount(row.debt_service_monthly) ?? 0) * 12;
    acc[key] = {
      monthlyRent,
      annualGrossRent,
      vacancy,
      propertyManagement,
      expenses,
      noi,
      capRate: noi !== null && totalProjectCost > 0 ? noi / totalProjectCost : null,
      monthlyCashFlow: noi !== null ? (noi - debtService) / 12 : null,
    };
    return acc;
  }, {} as Record<BuildScenarioKey, BuildRentalScenarioSummary>);

  const wholesaleProfit = input.exits.wholesale.assignment_fee !== null && input.exits.wholesale.assignment_fee !== undefined
    ? (amount(input.exits.wholesale.assignment_fee) ?? 0) - (amount(input.exits.wholesale.earnest_money_at_risk) ?? 0)
    : null;

  const missingInfo: string[] = [];
  if (!acquisitionPrice) missingInfo.push("Acquisition / listing price");
  if (!targetArv) missingInfo.push("Target ARV from new-build sold comps");
  if (!input.comps.sold_comp_count || input.comps.sold_comp_count < 3) missingInfo.push("At least 3 new-build sold comps");
  if (!input.specs.home_size_sqft) missingInfo.push("Build size / specs");
  if (!budgetTotals.construction) missingInfo.push("Construction budget");
  if (!input.financing.construction_loan && !input.financing.hard_money && !input.financing.group_cash && !input.financing.investor_capital) missingInfo.push("Financing source");
  if (!seed?.zoning && !input.status_checks.find(item => item.key === "zoning_verified" && item.status === "verified")) missingInfo.push("Zoning / setbacks verification");

  const riskFlags: string[] = [];
  if (buildSell.base.netProfit !== null && buildSell.base.netProfit < 0) riskFlags.push("Base build-and-sell scenario is negative.");
  if (buildSell.base.roi !== null && buildSell.base.roi < 0.1) riskFlags.push("Base ROI is under 10%.");
  if (input.status_checks.some(item => item.status === "blocked")) riskFlags.push("One or more build readiness checks are blocked.");
  if (targetArv && breakEvenSalePrice && breakEvenSalePrice > targetArv) riskFlags.push("Break-even sale price is above target ARV.");

  let recommendation: BuildAnalysisSummary["recommendation"] = "Needs More Info";
  if (targetArv && totalProjectCost > 0 && missingInfo.length <= 3) {
    if ((buildSell.base.roi ?? -1) >= 0.18 && (buildSell.base.netProfit ?? 0) > 0 && riskFlags.length <= 1) recommendation = "Strong Review";
    else if ((buildSell.base.netProfit ?? 0) > 0) recommendation = "Review With Caution";
    else recommendation = "Likely Pass";
  }

  return {
    acquisitionPrice,
    teardownTotal,
    budgetTotals,
    constructionGrandTotal,
    totalProjectCost,
    targetArv,
    totalFinancingCost,
    cashRequiredFromGroup,
    cashRequiredPerMember,
    breakEvenSalePrice,
    baseNetProfit: buildSell.base.netProfit,
    baseRoi: buildSell.base.roi,
    baseProfitPerMember: buildSell.base.profitPerMember,
    recommendation,
    missingInfo,
    riskFlags,
    buildSell,
    rental,
    wholesale: {
      netProfit: wholesaleProfit,
      profitPerMember: wholesaleProfit !== null ? wholesaleProfit / memberCount : null,
    },
  };
}

export function hasBuildAnalysisInput(value: BuildAnalysisInput | null | undefined): boolean {
  if (!value) return false;
  const analysis = normalizeBuildAnalysis(value);
  return Boolean(
    analysis.comps.target_arv
    || analysis.comps.sold_comp_count
    || analysis.specs.home_size_sqft
    || analysis.teardown.line_items.some(item => item.amount)
    || (Object.values(analysis.budget) as BuildLineItem[][]).some(items => items.some(item => item.amount))
    || analysis.financing.group_cash
    || analysis.financing.construction_loan
    || analysis.financing.hard_money
    || analysis.exits.build_sell.base.sale_price
    || analysis.exits.rental.base.monthly_rent
    || analysis.exits.wholesale.assignment_fee,
  );
}
