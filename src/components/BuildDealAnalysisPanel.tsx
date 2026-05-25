"use client";

import { useMemo } from "react";
import {
  calculateBuildAnalysis,
  normalizeBuildAnalysis,
  type BuildAnalysisInput,
  type BuildBudgetSections,
  type BuildDealSeed,
  type BuildLineItem,
  type BuildReadinessStatus,
  type BuildScenarioKey,
  type BuildStatusCheck,
} from "@/lib/build-underwriting";

type Props = {
  value?: BuildAnalysisInput | null;
  deal?: BuildDealSeed | null;
  onChange?: (next: BuildAnalysisInput) => void;
  editable?: boolean;
  compact?: boolean;
};

const SCENARIOS: BuildScenarioKey[] = ["conservative", "base", "optimistic"];
const SCENARIO_LABELS: Record<BuildScenarioKey, string> = {
  conservative: "Conservative",
  base: "Base",
  optimistic: "Optimistic",
};

const BUDGET_SECTIONS: Array<{ key: keyof BuildBudgetSections; label: string }> = [
  { key: "pre_construction", label: "Pre-construction" },
  { key: "construction", label: "Construction" },
  { key: "carrying", label: "Carrying / insurance" },
  { key: "selling_prep", label: "Selling prep" },
  { key: "additional", label: "Additional project costs" },
];

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `${Math.round(value * 1000) / 10}%`;
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function lineTotal(items: BuildLineItem[]): number {
  return items.reduce((sum, item) => sum + (typeof item.amount === "number" && Number.isFinite(item.amount) ? item.amount : 0), 0);
}

export default function BuildDealAnalysisPanel({ value, deal, onChange, editable = false, compact = false }: Props) {
  const analysis = useMemo(() => normalizeBuildAnalysis(value, deal ?? undefined), [value, deal]);
  const summary = useMemo(() => calculateBuildAnalysis(analysis, deal ?? undefined), [analysis, deal]);
  const canEdit = editable && !!onChange;

  function update(recipe: (next: BuildAnalysisInput) => void) {
    if (!onChange) return;
    const next = normalizeBuildAnalysis(analysis, deal ?? undefined);
    recipe(next);
    onChange(next);
  }

  function updateStatus(idx: number, patch: Partial<BuildStatusCheck>) {
    update(next => {
      next.status_checks = next.status_checks.map((item, itemIdx) => itemIdx === idx ? { ...item, ...patch } : item);
    });
  }

  function updateBudget(section: keyof BuildBudgetSections, idx: number, patch: Partial<BuildLineItem>) {
    update(next => {
      next.budget[section] = next.budget[section].map((item, itemIdx) => itemIdx === idx ? { ...item, ...patch } : item);
    });
  }

  function updateTeardown(idx: number, patch: Partial<BuildLineItem>) {
    update(next => {
      next.teardown.line_items = next.teardown.line_items.map((item, itemIdx) => itemIdx === idx ? { ...item, ...patch } : item);
    });
  }

  const topMetrics = [
    { label: "Total project cost", value: money(summary.totalProjectCost) },
    { label: "Target ARV", value: money(summary.targetArv) },
    { label: "Financing cost", value: money(summary.totalFinancingCost) },
    { label: "Base net profit", value: money(summary.baseNetProfit) },
    { label: "Base ROI", value: pct(summary.baseRoi) },
    { label: "Cash required", value: money(summary.cashRequiredFromGroup) },
    { label: "Per member", value: money(summary.cashRequiredPerMember) },
    { label: "Break-even sale", value: money(summary.breakEvenSalePrice) },
  ];

  return (
    <section style={wrap}>
      <div style={topRow}>
        <div>
          <p style={eyebrow}>Build analysis</p>
          <h3 style={title}>{summary.recommendation}</h3>
        </div>
        <span style={pill}>{summary.missingInfo.length ? `${summary.missingInfo.length} open` : "Core inputs ready"}</span>
      </div>

      <div style={metricGrid}>
        {topMetrics.map(metric => <Mini key={metric.label} label={metric.label} value={metric.value} />)}
      </div>

      {!compact && (
        <div style={alertGrid}>
          <div style={noteBox}>
            <p style={miniLabel}>Missing inputs</p>
            <p style={body}>{summary.missingInfo.length ? summary.missingInfo.join(", ") : "No major build inputs missing."}</p>
          </div>
          <div style={noteBox}>
            <p style={miniLabel}>Risk flags</p>
            <p style={body}>{summary.riskFlags.length ? summary.riskFlags.join(", ") : "No build-specific risk flags yet."}</p>
          </div>
        </div>
      )}

      <details open={!compact} style={details}>
        <summary style={summaryStyle}>Community and new-build comps</summary>
        <div style={sectionGrid}>
          <TextField disabled={!canEdit} label="Subdivision / community" value={analysis.community.subdivision} onChange={v => update(next => { next.community.subdivision = v; })} />
          <TextField disabled={!canEdit} label="Section" value={analysis.community.section} onChange={v => update(next => { next.community.section = v; })} />
          <TextField disabled={!canEdit} label="Developer / builder" value={analysis.community.developer_builder} onChange={v => update(next => { next.community.developer_builder = v; })} />
          <NumberField disabled={!canEdit} label="HOA fee" value={analysis.community.hoa_fee} onChange={v => update(next => { next.community.hoa_fee = v; })} />
          <NumberField disabled={!canEdit} label="Minimum SF" value={analysis.community.minimum_square_feet} onChange={v => update(next => { next.community.minimum_square_feet = v; })} />
          <NumberField disabled={!canEdit} label="Year started" value={analysis.community.year_started} onChange={v => update(next => { next.community.year_started = v; })} />
          <NumberField disabled={!canEdit} label="Target ARV" value={analysis.comps.target_arv} onChange={v => update(next => { next.comps.target_arv = v; next.exits.build_sell.base.sale_price = v ?? next.exits.build_sell.base.sale_price; })} />
          <NumberField disabled={!canEdit} label="Avg new-build $/SF" value={analysis.comps.average_price_per_sqft} onChange={v => update(next => { next.comps.average_price_per_sqft = v; })} />
          <NumberField disabled={!canEdit} label="Median sale price" value={analysis.comps.median_sale_price} onChange={v => update(next => { next.comps.median_sale_price = v; })} />
          <NumberField disabled={!canEdit} label="Sold new-build comps" value={analysis.comps.sold_comp_count} onChange={v => update(next => { next.comps.sold_comp_count = v; })} />
        </div>
        <div style={twoCol}>
          <TextArea disabled={!canEdit} label="Architectural requirements / materials" rows={3} value={analysis.community.architectural_requirements || analysis.community.required_materials || ""} onChange={v => update(next => { next.community.architectural_requirements = v; })} />
          <TextArea disabled={!canEdit} label="Sold comp notes" rows={3} value={analysis.comps.sold_comp_notes} onChange={v => update(next => { next.comps.sold_comp_notes = v; })} />
        </div>
      </details>

      <details open={!compact} style={details}>
        <summary style={summaryStyle}>Build specs and readiness</summary>
        <div style={sectionGrid}>
          <NumberField disabled={!canEdit} label="Home size SF" value={analysis.specs.home_size_sqft} onChange={v => update(next => { next.specs.home_size_sqft = v; })} />
          <NumberField disabled={!canEdit} label="Beds" value={analysis.specs.bedrooms} onChange={v => update(next => { next.specs.bedrooms = v; })} />
          <NumberField disabled={!canEdit} label="Baths" value={analysis.specs.bathrooms} onChange={v => update(next => { next.specs.bathrooms = v; })} />
          <NumberField disabled={!canEdit} label="Garage spaces" value={analysis.specs.garage_spaces} onChange={v => update(next => { next.specs.garage_spaces = v; })} />
          <NumberField disabled={!canEdit} label="Timeline months" value={analysis.specs.timeline_months} onChange={v => update(next => { next.specs.timeline_months = v; })} />
          <TextField disabled={!canEdit} label="Quality level" value={analysis.specs.quality_level} onChange={v => update(next => { next.specs.quality_level = v; })} />
          <TextField disabled={!canEdit} label="GC strategy" value={analysis.specs.gc_strategy} onChange={v => update(next => { next.specs.gc_strategy = v; })} />
        </div>
        <div style={checkGrid}>
          {analysis.status_checks.map((check, idx) => (
            <div key={check.key} style={checkRow}>
              <span style={checkDot(check.status)} />
              <div style={{ minWidth: 0 }}>
                <strong style={checkTitle}>{check.label}</strong>
                <select disabled={!canEdit} value={check.status} onChange={event => updateStatus(idx, { status: event.target.value as BuildReadinessStatus })} style={compactSelect}>
                  <option value="open">Open</option>
                  <option value="in-review">In review</option>
                  <option value="verified">Verified</option>
                  <option value="blocked">Blocked</option>
                  <option value="not-applicable">N/A</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details open={!compact} style={details}>
        <summary style={summaryStyle}>Teardown</summary>
        <div style={sectionGrid}>
          <NumberField disabled={!canEdit} label="Existing home SF" value={analysis.teardown.existing_home_sqft} onChange={v => update(next => { next.teardown.existing_home_sqft = v; })} />
          <TextField disabled={!canEdit} label="Condition" value={analysis.teardown.condition} onChange={v => update(next => { next.teardown.condition = v; })} />
          <Mini label="Teardown total" value={money(summary.teardownTotal)} />
        </div>
        <LineTable items={analysis.teardown.line_items} editable={canEdit} onChange={updateTeardown} />
      </details>

      <details open={!compact} style={details}>
        <summary style={summaryStyle}>Construction budget</summary>
        <div style={metricGrid}>
          {BUDGET_SECTIONS.map(section => (
            <Mini key={section.key} label={section.label} value={money(summary.budgetTotals[section.key])} />
          ))}
          <Mini label="Grand total" value={money(summary.constructionGrandTotal)} />
          <Mini label="Cost / SF" value={analysis.specs.home_size_sqft ? `${money(summary.constructionGrandTotal / analysis.specs.home_size_sqft)}/SF` : "N/A"} />
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {BUDGET_SECTIONS.map(section => (
            <details key={section.key} style={nestedDetails}>
              <summary style={nestedSummary}>{section.label} - {money(lineTotal(analysis.budget[section.key]))}</summary>
              <LineTable items={analysis.budget[section.key]} editable={canEdit} onChange={(idx, patch) => updateBudget(section.key, idx, patch)} />
            </details>
          ))}
        </div>
      </details>

      <details open={!compact} style={details}>
        <summary style={summaryStyle}>Financing</summary>
        <div style={sectionGrid}>
          <NumberField disabled={!canEdit} label="Member count" value={analysis.financing.member_count} onChange={v => update(next => { next.financing.member_count = v; })} />
          <NumberField disabled={!canEdit} label="Group cash" value={analysis.financing.group_cash} onChange={v => update(next => { next.financing.group_cash = v; })} />
          <NumberField disabled={!canEdit} label="Investor capital" value={analysis.financing.investor_capital} onChange={v => update(next => { next.financing.investor_capital = v; })} />
          <NumberField disabled={!canEdit} label="Credit cards" value={analysis.financing.credit_cards} onChange={v => update(next => { next.financing.credit_cards = v; })} />
          <NumberField disabled={!canEdit} label="Construction loan" value={analysis.financing.construction_loan} onChange={v => update(next => { next.financing.construction_loan = v; })} />
          <NumberField disabled={!canEdit} label="Hard money" value={analysis.financing.hard_money} onChange={v => update(next => { next.financing.hard_money = v; })} />
          <NumberField disabled={!canEdit} label="Investor rate %" value={analysis.financing.investor_rate_pct} onChange={v => update(next => { next.financing.investor_rate_pct = v; })} />
          <NumberField disabled={!canEdit} label="Investor months" value={analysis.financing.investor_duration_months} onChange={v => update(next => { next.financing.investor_duration_months = v; })} />
          <NumberField disabled={!canEdit} label="Lender rate %" value={analysis.financing.lender_rate_pct} onChange={v => update(next => { next.financing.lender_rate_pct = v; })} />
          <NumberField disabled={!canEdit} label="Lender points %" value={analysis.financing.lender_points_pct} onChange={v => update(next => { next.financing.lender_points_pct = v; })} />
          <NumberField disabled={!canEdit} label="Lender months" value={analysis.financing.lender_duration_months} onChange={v => update(next => { next.financing.lender_duration_months = v; })} />
          <NumberField disabled={!canEdit} label="Card rate %" value={analysis.financing.credit_card_rate_pct} onChange={v => update(next => { next.financing.credit_card_rate_pct = v; })} />
        </div>
        <TextArea disabled={!canEdit} label="Financing notes" rows={3} value={analysis.financing.notes} onChange={v => update(next => { next.financing.notes = v; })} />
      </details>

      <details open={!compact} style={details}>
        <summary style={summaryStyle}>Profit and exit strategy</summary>
        <ScenarioTable
          title="Build and sell"
          editable={canEdit}
          rows={SCENARIOS.map(key => ({
            key,
            salePrice: analysis.exits.build_sell[key].sale_price,
            commission: analysis.exits.build_sell[key].agent_commission_pct,
            concessions: analysis.exits.build_sell[key].buyer_concessions_pct,
            closing: analysis.exits.build_sell[key].seller_closing_pct,
            timeline: analysis.exits.build_sell[key].timeline_months,
            netProfit: summary.buildSell[key].netProfit,
            roi: summary.buildSell[key].roi,
            profitPerMember: summary.buildSell[key].profitPerMember,
          }))}
          onChange={(key, field, nextValue) => update(next => {
            next.exits.build_sell[key] = { ...next.exits.build_sell[key], [field]: nextValue };
            if (key === "base" && field === "sale_price") next.comps.target_arv = nextValue ?? next.comps.target_arv;
          })}
        />
        <RentalTable
          editable={canEdit}
          rows={SCENARIOS.map(key => ({
            key,
            monthlyRent: analysis.exits.rental[key].monthly_rent,
            vacancy: analysis.exits.rental[key].vacancy_pct,
            management: analysis.exits.rental[key].property_management_pct,
            insuranceTaxes: analysis.exits.rental[key].insurance_taxes_annual,
            maintenanceHoa: analysis.exits.rental[key].maintenance_hoa_annual,
            debtService: analysis.exits.rental[key].debt_service_monthly,
            noi: summary.rental[key].noi,
            capRate: summary.rental[key].capRate,
            cashFlow: summary.rental[key].monthlyCashFlow,
          }))}
          onChange={(key, field, nextValue) => update(next => {
            next.exits.rental[key] = { ...next.exits.rental[key], [field]: nextValue };
          })}
        />
        <div style={sectionGrid}>
          <NumberField disabled={!canEdit} label="Wholesale contract price" value={analysis.exits.wholesale.contract_price} onChange={v => update(next => { next.exits.wholesale.contract_price = v; })} />
          <NumberField disabled={!canEdit} label="Earnest money at risk" value={analysis.exits.wholesale.earnest_money_at_risk} onChange={v => update(next => { next.exits.wholesale.earnest_money_at_risk = v; })} />
          <NumberField disabled={!canEdit} label="Assignment fee" value={analysis.exits.wholesale.assignment_fee} onChange={v => update(next => { next.exits.wholesale.assignment_fee = v; })} />
          <Mini label="Wholesale net" value={money(summary.wholesale.netProfit)} />
          <Mini label="Wholesale / member" value={money(summary.wholesale.profitPerMember)} />
        </div>
      </details>
    </section>
  );
}

function NumberField({ label, value, onChange, disabled = false }: { label: string; value?: number | null; onChange: (value: number | null) => void; disabled?: boolean }) {
  return (
    <label style={fieldLabel}>
      <span>{label}</span>
      <input disabled={disabled} type="text" inputMode="decimal" value={value ?? ""} onChange={event => onChange(toNumber(event.target.value))} placeholder="0" style={inputStyle} />
    </label>
  );
}

function TextField({ label, value, onChange, disabled = false }: { label: string; value?: string | null; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label style={fieldLabel}>
      <span>{label}</span>
      <input disabled={disabled} type="text" value={value ?? ""} onChange={event => onChange(event.target.value)} style={inputStyle} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows, disabled = false }: { label: string; value?: string | null; rows: number; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label style={{ ...fieldLabel, marginTop: 10 }}>
      <span>{label}</span>
      <textarea disabled={disabled} rows={rows} value={value ?? ""} onChange={event => onChange(event.target.value)} style={textareaStyle} />
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={mini}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LineTable({ items, editable, onChange }: { items: BuildLineItem[]; editable: boolean; onChange: (idx: number, patch: Partial<BuildLineItem>) => void }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Line item</th>
            <th style={th}>Amount</th>
            <th style={th}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.key}>
              <td style={tdLabel}>{item.label}</td>
              <td style={td}>
                <input disabled={!editable} type="text" inputMode="decimal" value={item.amount ?? ""} onChange={event => onChange(idx, { amount: toNumber(event.target.value) })} style={smallInput} />
              </td>
              <td style={td}>
                <input disabled={!editable} type="text" value={item.notes ?? ""} onChange={event => onChange(idx, { notes: event.target.value })} style={smallInput} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SellRow = {
  key: BuildScenarioKey;
  salePrice?: number | null;
  commission?: number | null;
  concessions?: number | null;
  closing?: number | null;
  timeline?: number | null;
  netProfit?: number | null;
  roi?: number | null;
  profitPerMember?: number | null;
};

function ScenarioTable({
  title,
  rows,
  editable,
  onChange,
}: {
  title: string;
  rows: SellRow[];
  editable: boolean;
  onChange: (key: BuildScenarioKey, field: "sale_price" | "agent_commission_pct" | "buyer_concessions_pct" | "seller_closing_pct" | "timeline_months", value: number | null) => void;
}) {
  return (
    <div style={scenarioBlock}>
      <p style={miniLabel}>{title}</p>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Scenario</th>
              <th style={th}>Sale price</th>
              <th style={th}>Agent %</th>
              <th style={th}>Concessions %</th>
              <th style={th}>Closing %</th>
              <th style={th}>Months</th>
              <th style={th}>Net profit</th>
              <th style={th}>ROI</th>
              <th style={th}>/ member</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <td style={tdLabel}>{SCENARIO_LABELS[row.key]}</td>
                <td style={td}><input disabled={!editable} value={row.salePrice ?? ""} onChange={event => onChange(row.key, "sale_price", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.commission ?? ""} onChange={event => onChange(row.key, "agent_commission_pct", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.concessions ?? ""} onChange={event => onChange(row.key, "buyer_concessions_pct", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.closing ?? ""} onChange={event => onChange(row.key, "seller_closing_pct", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.timeline ?? ""} onChange={event => onChange(row.key, "timeline_months", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}>{money(row.netProfit)}</td>
                <td style={td}>{pct(row.roi)}</td>
                <td style={td}>{money(row.profitPerMember)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RentalRow = {
  key: BuildScenarioKey;
  monthlyRent?: number | null;
  vacancy?: number | null;
  management?: number | null;
  insuranceTaxes?: number | null;
  maintenanceHoa?: number | null;
  debtService?: number | null;
  noi?: number | null;
  capRate?: number | null;
  cashFlow?: number | null;
};

function RentalTable({
  rows,
  editable,
  onChange,
}: {
  rows: RentalRow[];
  editable: boolean;
  onChange: (key: BuildScenarioKey, field: "monthly_rent" | "vacancy_pct" | "property_management_pct" | "insurance_taxes_annual" | "maintenance_hoa_annual" | "debt_service_monthly", value: number | null) => void;
}) {
  return (
    <div style={scenarioBlock}>
      <p style={miniLabel}>Build and hold rental</p>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Scenario</th>
              <th style={th}>Rent</th>
              <th style={th}>Vacancy %</th>
              <th style={th}>Mgmt %</th>
              <th style={th}>Ins. / taxes</th>
              <th style={th}>Maint. / HOA</th>
              <th style={th}>Debt svc.</th>
              <th style={th}>NOI</th>
              <th style={th}>Cap</th>
              <th style={th}>Cash flow</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <td style={tdLabel}>{SCENARIO_LABELS[row.key]}</td>
                <td style={td}><input disabled={!editable} value={row.monthlyRent ?? ""} onChange={event => onChange(row.key, "monthly_rent", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.vacancy ?? ""} onChange={event => onChange(row.key, "vacancy_pct", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.management ?? ""} onChange={event => onChange(row.key, "property_management_pct", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.insuranceTaxes ?? ""} onChange={event => onChange(row.key, "insurance_taxes_annual", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.maintenanceHoa ?? ""} onChange={event => onChange(row.key, "maintenance_hoa_annual", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}><input disabled={!editable} value={row.debtService ?? ""} onChange={event => onChange(row.key, "debt_service_monthly", toNumber(event.target.value))} style={smallInput} /></td>
                <td style={td}>{money(row.noi)}</td>
                <td style={td}>{pct(row.capRate)}</td>
                <td style={td}>{money(row.cashFlow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function checkDot(status: BuildReadinessStatus): React.CSSProperties {
  const colors: Record<BuildReadinessStatus, string> = {
    open: "var(--fog)",
    "in-review": "var(--brass)",
    verified: "var(--pine)",
    blocked: "#8d3f31",
    "not-applicable": "var(--muted)",
  };
  return { width: 10, height: 10, borderRadius: 999, background: colors[status], flex: "0 0 auto", marginTop: 4 };
}

const wrap: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,252,245,0.84)",
  padding: 12,
  display: "grid",
  gap: 12,
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const eyebrow: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: 4,
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 24,
  fontWeight: 500,
  color: "var(--obsidian)",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  border: "1px solid var(--fog)",
  padding: "6px 9px",
  fontSize: 10,
  fontWeight: 800,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};

const metricGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  minWidth: 0,
};

const mini: React.CSSProperties = {
  flex: "1 1 170px",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  background: "var(--surface)",
  padding: 9,
  display: "grid",
  gap: 4,
  minWidth: 0,
  maxWidth: "100%",
};

const miniLabel: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const body: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  lineHeight: 1.45,
  marginTop: 4,
};

const alertGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
  gap: 8,
};

const noteBox: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: 10,
  background: "rgba(237,230,214,0.38)",
};

const details: React.CSSProperties = {
  borderTop: "1px solid var(--fog)",
  paddingTop: 10,
};

const nestedDetails: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: 9,
  background: "var(--bone)",
};

const summaryStyle: React.CSSProperties = {
  color: "var(--obsidian)",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
};

const nestedSummary: React.CSSProperties = {
  ...summaryStyle,
  fontSize: 12,
};

const sectionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
  gap: 10,
  marginTop: 10,
  minWidth: 0,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
  gap: 10,
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  minWidth: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 38,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 72,
};

const checkGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const checkRow: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: 9,
  display: "flex",
  gap: 8,
  background: "var(--surface)",
};

const checkTitle: React.CSSProperties = {
  display: "block",
  color: "var(--obsidian)",
  fontSize: 12,
  lineHeight: 1.3,
};

const compactSelect: React.CSSProperties = {
  minHeight: 32,
  marginTop: 6,
  fontSize: 12,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  marginTop: 10,
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 680,
  borderCollapse: "collapse",
  fontSize: 12,
};

const th: React.CSSProperties = {
  textAlign: "left",
  color: "var(--muted)",
  borderBottom: "1px solid var(--fog)",
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid var(--fog)",
  padding: "6px 8px",
  color: "var(--ink)",
  verticalAlign: "middle",
};

const tdLabel: React.CSSProperties = {
  ...td,
  color: "var(--obsidian)",
  fontWeight: 700,
  minWidth: 150,
};

const smallInput: React.CSSProperties = {
  minWidth: 96,
  minHeight: 32,
  fontSize: 12,
};

const scenarioBlock: React.CSSProperties = {
  marginTop: 12,
};
