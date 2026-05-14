"use client";

import type { ImportedLandLead, LandUnderwritingResultRow } from "@/lib/land-leads";
import { calculateLandUnderwriting } from "@/lib/land-underwriting";

type Props = {
  lead: ImportedLandLead;
  results?: LandUnderwritingResultRow[];
};

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function ppa(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${money(value)}/ac`;
}

function normalizedRows(lead: ImportedLandLead, rows: LandUnderwritingResultRow[] | undefined) {
  if (rows?.length) return [...rows].sort((a, b) => b.rank - a.rank);
  const summary = calculateLandUnderwriting(lead);
  return summary.results.map((item): LandUnderwritingResultRow => ({
    id: `local-${item.exitType}`,
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
    created_at: new Date().toISOString(),
  })).sort((a, b) => b.rank - a.rank || indexOrder(a.exit_type) - indexOrder(b.exit_type));
}

function indexOrder(exitType: string): number {
  return ["retail-resale", "neighbor-sale", "land-flip", "assignment", "subdivide", "pass"].indexOf(exitType);
}

export default function LandUnderwritingMatrix({ lead, results }: Props) {
  const rows = normalizedRows(lead, results);
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--fog)", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
        <thead>
          <tr>
            <th style={head}>Exit</th>
            <th style={head}>Status</th>
            <th style={head}>Max Offer</th>
            <th style={head}>Required PPA</th>
            <th style={head}>Required Sale</th>
            <th style={head}>Spread</th>
            <th style={head}>VA Next Step</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.exit_type}>
              <td style={cell}>
                <strong style={{ color: "var(--obsidian)" }}>{row.label}</strong>
                {row.blocker && <p style={subText}>Blocker: {row.blocker}</p>}
              </td>
              <td style={cell}><span style={statusPill(row.status)}>{row.status}</span></td>
              <td style={cell}>{money(row.max_offer)}</td>
              <td style={cell}>{ppa(row.required_ppa)}</td>
              <td style={cell}>{money(row.required_resale_value)}</td>
              <td style={cell}>{money(row.projected_spread)}</td>
              <td style={{ ...cell, minWidth: 260 }}>
                <p style={{ color: "var(--ink)", fontSize: 12, lineHeight: 1.45 }}>{row.next_step || "Review assumptions."}</p>
                {row.key_assumption && <p style={subText}>{row.key_assumption}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const head: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid var(--fog)",
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  textAlign: "left",
  background: "rgba(245,239,224,0.82)",
  whiteSpace: "nowrap",
};

const cell: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid var(--fog)",
  color: "var(--ink)",
  fontSize: 12,
  lineHeight: 1.4,
  verticalAlign: "top",
};

const subText: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  lineHeight: 1.4,
  marginTop: 3,
};

function statusPill(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    border: "1px solid var(--fog)",
  };
  if (status === "strong") return { ...base, background: "rgba(34,119,84,0.12)", color: "var(--pine)", borderColor: "rgba(34,119,84,0.22)" };
  if (status === "possible") return { ...base, background: "rgba(176,137,84,0.14)", color: "var(--obsidian)", borderColor: "var(--brass)" };
  if (status === "pass") return { ...base, background: "var(--obsidian)", color: "var(--brass)", borderColor: "var(--obsidian)" };
  return { ...base, background: "var(--surface)", color: "var(--muted)" };
}
