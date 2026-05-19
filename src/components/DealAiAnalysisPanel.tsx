"use client";

import type { DealAiAnalysisResult } from "@/lib/deal-ai";

type Props = {
  result: DealAiAnalysisResult | null;
  loading: boolean;
  error?: string;
  onAnalyze: () => void;
  onApply?: () => void;
  canApply?: boolean;
  compact?: boolean;
};

export default function DealAiAnalysisPanel({
  result,
  loading,
  error,
  onAnalyze,
  onApply,
  canApply = false,
  compact = false,
}: Props) {
  return (
    <section style={wrap}>
      <div style={topRow}>
        <div>
          <p style={eyebrow}>AI deal analyst</p>
          <h3 style={title}>{result?.recommendation || "Analyze packet"}</h3>
        </div>
        <button type="button" onClick={onAnalyze} disabled={loading} style={{ ...button, opacity: loading ? 0.62 : 1 }}>
          {loading ? "Analyzing..." : result ? "Re-analyze" : "AI Analyze"}
        </button>
      </div>

      {!result && !error && (
        <p style={body}>
          Run the AI review after the property basics, calculator assumptions, comps notes, or build analysis are filled in. Suggestions stay in draft until you apply them.
        </p>
      )}

      {error && <p style={{ ...body, color: "#8d3f31" }}>{error}</p>}

      {result && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={metricGrid}>
            <Mini label="Confidence" value={result.confidence} />
            <Mini label="Source" value={sourceLabel(result)} />
            <Mini label="Missing" value={String(result.missing_info.length)} />
            <Mini label="Next actions" value={String(result.next_actions.length)} />
          </div>

          <div style={noteBox}>
            <p style={miniLabel}>Executive summary</p>
            <p style={body}>{result.executive_summary}</p>
          </div>

          {!compact && (
            <>
              <div style={twoCol}>
                <Info title="Investment thesis" lines={[result.investment_thesis]} />
                <Info title="Pricing guidance" lines={[result.pricing_guidance]} />
              </div>
              <Info title="Key risks" lines={result.key_risks} />
              <Info title="Missing information" lines={result.missing_info.length ? result.missing_info : ["No major missing items flagged."]} />
              <Info
                title="Comp strategy"
                lines={[
                  `${result.comp_strategy.required_count} ${result.comp_strategy.target_comp_type.toLowerCase()} within ${result.comp_strategy.search_radius_miles} miles and ${result.comp_strategy.lookback_months} months.`,
                  `Include: ${result.comp_strategy.include_filters.join(", ")}`,
                  `Reject: ${result.comp_strategy.reject_filters.join(", ")}`,
                ]}
              />
            </>
          )}

          <div style={noteBox}>
            <p style={miniLabel}>Suggested next actions</p>
            <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
              {result.next_actions.slice(0, compact ? 3 : 6).map(action => (
                <div key={`${action.title}-${action.priority}`} style={actionRow}>
                  <span style={priorityPill(action.priority)}>{action.priority}</span>
                  <div>
                    <strong style={{ color: "var(--obsidian)", fontSize: 12 }}>{action.title}</strong>
                    <p style={{ ...body, marginTop: 2 }}>{action.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.note && <p style={body}>{result.note}</p>}

          {onApply && (
            <button type="button" onClick={onApply} disabled={!canApply || loading} style={{ ...button, width: "100%", justifyContent: "center", opacity: !canApply || loading ? 0.62 : 1 }}>
              Apply AI Suggestions To Draft
            </button>
          )}
        </div>
      )}
    </section>
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

function sourceLabel(result: DealAiAnalysisResult): string {
  if (result.source === "fallback") return "Fallback";
  if (result.source === "openrouter") return "OpenRouter";
  return result.model;
}

function Info({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div style={noteBox}>
      <p style={miniLabel}>{title}</p>
      <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
        {lines.map(line => <p key={line} style={body}>{line}</p>)}
      </div>
    </div>
  );
}

function priorityPill(priority: string): React.CSSProperties {
  const urgent = priority === "urgent" || priority === "high";
  return {
    borderRadius: 999,
    border: urgent ? "1px solid rgba(141,63,49,0.28)" : "1px solid var(--fog)",
    background: urgent ? "rgba(141,63,49,0.10)" : "var(--surface)",
    color: urgent ? "#8d3f31" : "var(--muted)",
    padding: "3px 7px",
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    alignSelf: "start",
  };
}

const wrap: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,252,245,0.86)",
  padding: 12,
  display: "grid",
  gap: 10,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
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
  color: "var(--obsidian)",
  fontSize: 22,
  fontWeight: 500,
};

const button: React.CSSProperties = {
  border: "1px solid var(--obsidian)",
  borderRadius: 8,
  background: "var(--obsidian)",
  color: "var(--bone)",
  padding: "9px 11px",
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(98px, 1fr))",
  gap: 8,
};

const mini: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 6,
  background: "var(--surface)",
  padding: 8,
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const miniLabel: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const body: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.48,
};

const noteBox: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 6,
  background: "var(--surface)",
  padding: 10,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const actionRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 8,
  alignItems: "flex-start",
};
