"use client";

import type { ImportedLandLead, LandUnderwritingResultRow } from "@/lib/land-leads";
import { calculateLandUnderwriting } from "@/lib/land-underwriting";

type Props = {
  lead: ImportedLandLead;
  results?: LandUnderwritingResultRow[];
  compact?: boolean;
};

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function ppa(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${money(value)}/ac`;
}

function bestFromRows(lead: ImportedLandLead, rows: LandUnderwritingResultRow[] | undefined) {
  if (rows?.length) {
    const best = [...rows].filter(row => row.exit_type !== "pass").sort((a, b) =>
      b.rank - a.rank
      || (b.projected_spread ?? -1) - (a.projected_spread ?? -1)
      || (b.max_offer ?? -1) - (a.max_offer ?? -1),
    )[0] ?? rows[0];
    return {
      label: best.label,
      status: best.status,
      maxOffer: best.max_offer,
      requiredPpa: best.required_ppa,
      projectedSpread: best.projected_spread,
      nextStep: best.next_step || "Review calculator output.",
      blocker: best.blocker,
      landInsightsPpa: best.land_insights_ppa,
    };
  }
  const summary = calculateLandUnderwriting(lead);
  return {
    label: summary.best.label,
    status: summary.best.status,
    maxOffer: summary.best.maxOffer,
    requiredPpa: summary.best.requiredPpa,
    projectedSpread: summary.best.projectedSpread,
    nextStep: summary.best.nextStep,
    blocker: summary.best.blocker,
    landInsightsPpa: summary.best.landInsightsPpa,
  };
}

export default function LandUnderwritingPanel({ lead, results, compact = false }: Props) {
  const best = bestFromRows(lead, results);
  const tone = best.status === "strong" ? "good" : best.status === "possible" ? "possible" : best.status === "weak" ? "weak" : "pass";
  return (
    <div style={{ ...wrap, padding: compact ? 10 : 12 }}>
      <div style={topRow}>
        <div>
          <p style={eyebrow}>Best exit</p>
          <strong style={title}>{best.label}</strong>
        </div>
        <span style={{ ...statusPill, ...toneStyles[tone] }}>{best.status}</span>
      </div>
      <div style={metricGrid}>
        <Mini label="Max offer" value={money(best.maxOffer)} />
        <Mini label="Needs PPA" value={ppa(best.requiredPpa)} />
        {!compact && <Mini label="LI PPA" value={ppa(best.landInsightsPpa)} />}
        {!compact && <Mini label="Spread" value={money(best.projectedSpread)} />}
      </div>
      <p style={nextStep}>{best.blocker ? `Blocker: ${best.blocker}. ` : ""}{best.nextStep}</p>
    </div>
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

const wrap: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,252,245,0.78)",
  display: "grid",
  gap: 9,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const eyebrow: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: 3,
};

const title: React.CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 14,
};

const statusPill: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  border: "1px solid var(--fog)",
};

const toneStyles: Record<string, React.CSSProperties> = {
  good: { background: "rgba(34,119,84,0.12)", color: "var(--pine)", borderColor: "rgba(34,119,84,0.22)" },
  possible: { background: "rgba(176,137,84,0.14)", color: "var(--obsidian)", borderColor: "var(--brass)" },
  weak: { background: "var(--surface)", color: "var(--muted)" },
  pass: { background: "var(--obsidian)", color: "var(--brass)", borderColor: "var(--obsidian)" },
};

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
  gap: 6,
};

const mini: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: 8,
  background: "var(--surface)",
  display: "grid",
  gap: 3,
};

const nextStep: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.45,
};
