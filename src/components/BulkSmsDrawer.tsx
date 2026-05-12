"use client";

import { useEffect, useMemo, useState } from "react";
import {
  appendComplianceFooter,
  estimateSegments,
  exclusionReasonLabel,
  renderMessageForRecipient,
  EXCLUSION_REASONS_BY_SEVERITY,
  EXCLUSION_SEVERITY_HINT,
  EXCLUSION_SEVERITY_LABEL,
  EXCLUSION_SEVERITY_ORDER,
  type BulkSmsCategorization,
  type BulkSmsExclusionSeverity,
} from "@/lib/bulk-sms";
import type { ImportedLandLead } from "@/lib/land-leads";

type SendResult = { sent?: number; error?: string };

export interface BulkSmsDrawerProps {
  open: boolean;
  onClose: () => void;
  audienceLabel: string;
  audienceContext?: string;
  categorization: BulkSmsCategorization;
  onSend: (args: { message: string; recipients: Array<{ leadId: string; toNumber: string; label: string | null; rendered: string }> }) => Promise<SendResult>;
  onSent?: (sent: number) => void;
  initialMessage?: string;
}

const MERGE_FIELD_OPTIONS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{county}}", label: "County" },
  { token: "{{property_count}}", label: "Property count" },
  { token: "{{property_list}}", label: "Property phrase" },
];

const TEMPLATES = [
  {
    label: "Initial outreach",
    body: "Hi {{first_name}}, this is Courtney with Meridian. I was reaching out about land you own in {{county}}. Would you consider selling?",
  },
  {
    label: "Follow-up · no response",
    body: "Hi {{first_name}}, just following up on the land you own in {{county}}. Are you open to an offer, or should I close your file?",
  },
  {
    label: "Reactivation",
    body: "Hi {{first_name}}, circling back on the land you own in {{county}}. Has anything changed about selling it?",
  },
];

const SEVERITY_TONE: Record<BulkSmsExclusionSeverity, { border: string; background: string; dot: string; label: string }> = {
  "compliance": {
    border: "1px solid var(--obsidian)",
    background: "rgba(20,17,13,0.06)",
    dot: "var(--obsidian)",
    label: "var(--obsidian)",
  },
  "data-quality": {
    border: "1px solid var(--brass)",
    background: "rgba(176,137,84,0.10)",
    dot: "var(--brass)",
    label: "var(--obsidian)",
  },
  "recency-dedupe": {
    border: "1px solid var(--fog)",
    background: "var(--surface)",
    dot: "var(--fog)",
    label: "var(--muted)",
  },
};

function pickRandom<T>(items: T[], count: number, seed: number): T[] {
  if (items.length <= count) return items;
  const pool = [...items];
  const out: T[] = [];
  let cursor = seed;
  for (let i = 0; i < count && pool.length; i += 1) {
    cursor = (cursor * 9301 + 49297) % 233280;
    const idx = Math.floor((cursor / 233280) * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export default function BulkSmsDrawer({
  open,
  onClose,
  audienceLabel,
  audienceContext,
  categorization,
  onSend,
  onSent,
  initialMessage = "",
}: BulkSmsDrawerProps) {
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSeed, setPreviewSeed] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setMessage(initialMessage);
    setError(null);
    setPreviewSeed(Date.now());
  }, [open, initialMessage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  const previewSamples = useMemo<ImportedLandLead[]>(() => pickRandom(categorization.eligible, 3, previewSeed), [categorization.eligible, previewSeed]);
  const segments = estimateSegments(message);
  const finalLength = appendComplianceFooter(message).length;
  const eligibleCount = categorization.eligible.length;
  const excludedCount = categorization.excluded.length;
  const canSend = !sending && eligibleCount > 0 && message.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = message.trim();
    const confirmText = `Send this SMS to ${eligibleCount} seller${eligibleCount === 1 ? "" : "s"}?`;
    if (!window.confirm(confirmText)) return;
    setSending(true);
    setError(null);
    try {
      const recipients = categorization.eligible.map(lead => ({
        leadId: lead.id,
        toNumber: categorization.eligiblePhones[lead.id] ?? (lead.phone || lead.phone_2) ?? "",
        label: lead.owner_name,
        rendered: renderMessageForRecipient(trimmed, lead, 1),
      }));
      const result = await onSend({ message: trimmed, recipients });
      if (result.error) {
        setError(result.error);
        return;
      }
      onSent?.(result.sent ?? eligibleCount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  };

  const insertToken = (token: string) => {
    setMessage(prev => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}${token}`);
  };

  if (!open) return null;

  return (
    <div style={backdrop} onClick={() => { if (!sending) onClose(); }}>
      <div style={modal} role="dialog" aria-modal="true" aria-label="Send bulk text" onClick={e => e.stopPropagation()}>
        <header style={modalHeader}>
          <div>
            <p style={eyebrow}>Bulk SMS</p>
            <h2 style={title}>Send to {eligibleCount} of {categorization.totalConsidered}</h2>
            <p style={subtitle}>{audienceLabel}</p>
            {audienceContext && <p style={contextLine}>{audienceContext}</p>}
          </div>
          <button onClick={onClose} disabled={sending} style={closeButton} aria-label="Close">×</button>
        </header>

        <section style={section}>
          <h3 style={sectionHeading}>Audience</h3>
          <div style={audienceGrid}>
            <div style={statCard}>
              <span style={statLabel}>Eligible</span>
              <strong style={statValueBig}>{eligibleCount}</strong>
              <span style={statDetail}>will receive</span>
            </div>
            <div style={statCardMuted}>
              <span style={statLabel}>Excluded</span>
              <strong style={statValueBig}>{excludedCount}</strong>
              <span style={statDetail}>not sent</span>
            </div>
          </div>
          {excludedCount > 0 && (
            <div style={exclusionGroupWrap}>
              {EXCLUSION_SEVERITY_ORDER.map(severity => {
                const reasons = EXCLUSION_REASONS_BY_SEVERITY[severity].filter(r => categorization.excludedByReason[r] > 0);
                if (reasons.length === 0) return null;
                const groupTotal = reasons.reduce((sum, r) => sum + categorization.excludedByReason[r], 0);
                const tone = SEVERITY_TONE[severity];
                return (
                  <section key={severity} style={{ ...exclusionGroupCard, border: tone.border, background: tone.background }}>
                    <header style={exclusionGroupHeader}>
                      <strong style={{ ...exclusionGroupTitle, color: tone.label }}>{EXCLUSION_SEVERITY_LABEL[severity]}</strong>
                      <span style={exclusionGroupTotal}>{groupTotal}</span>
                    </header>
                    <p style={exclusionGroupHint}>{EXCLUSION_SEVERITY_HINT[severity]}</p>
                    <ul style={exclusionList}>
                      {reasons.map(reason => (
                        <li key={reason} style={exclusionRow}>
                          <span style={{ ...exclusionDot, background: tone.dot }} />
                          <span style={exclusionCount}>{categorization.excludedByReason[reason]}</span>
                          <span style={exclusionLabel}>{exclusionReasonLabel(reason)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section style={section}>
          <h3 style={sectionHeading}>Message</h3>
          <div style={templateRow}>
            <span style={templateLabel}>Templates</span>
            {TEMPLATES.map(template => (
              <button
                key={template.label}
                type="button"
                onClick={() => setMessage(template.body)}
                disabled={sending}
                style={templateButton}
              >
                {template.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Hi {{first_name}}, this is Courtney. I was reaching out about land you own in {{county}}…"
            rows={5}
            disabled={sending}
            style={textarea}
          />
          <div style={mergeRow}>
            <span style={mergeRowLabel}>Insert</span>
            {MERGE_FIELD_OPTIONS.map(option => (
              <button
                key={option.token}
                type="button"
                onClick={() => insertToken(option.token)}
                disabled={sending}
                style={mergeChip}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={meterRow}>
            <span>{message.trim().length} chars typed · {finalLength} with footer · {segments} segment{segments === 1 ? "" : "s"}</span>
            <span style={footerNote}>“Reply STOP to opt out.” appended automatically</span>
          </div>
        </section>

        <section style={section}>
          <h3 style={sectionHeading}>Preview <span style={previewCount}>{previewSamples.length} sample{previewSamples.length === 1 ? "" : "s"}</span></h3>
          <div style={previewList}>
            {previewSamples.length === 0 && (
              <p style={emptyNote}>No eligible recipients to preview.</p>
            )}
            {previewSamples.map(lead => (
              <article key={lead.id} style={previewCard}>
                <header style={previewCardHeader}>
                  <strong style={previewName}>{lead.owner_name || "Owner unknown"}</strong>
                  <span style={previewMeta}>{lead.county || "County pending"} · {categorization.eligiblePhones[lead.id] || lead.phone || lead.phone_2 || "—"}</span>
                </header>
                <p style={previewBody}>{renderMessageForRecipient(message, lead, 1) || "Compose a message to see preview"}</p>
              </article>
            ))}
            <button type="button" onClick={() => setPreviewSeed(Date.now())} disabled={sending || previewSamples.length === 0} style={shufflePreview}>
              Shuffle preview
            </button>
          </div>
        </section>

        {error && (
          <div style={errorBanner}>{error}</div>
        )}

        <footer style={modalFooter}>
          <button onClick={onClose} disabled={sending} style={secondaryButton}>Cancel</button>
          <button onClick={handleSend} disabled={!canSend} style={{ ...primaryButton, opacity: canSend ? 1 : 0.55 }}>
            {sending ? "Sending…" : `Send to ${eligibleCount}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(20,17,13,0.55)",
  zIndex: 200,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "48px 16px 16px",
  overflowY: "auto",
};

const modal: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  width: "min(720px, 100%)",
  boxShadow: "0 24px 64px rgba(20,17,13,0.32)",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  borderBottom: "1px solid var(--fog)",
  paddingBottom: 16,
};

const eyebrow: React.CSSProperties = {
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
};

const subtitle: React.CSSProperties = {
  color: "var(--ink)",
  fontSize: 13,
  marginTop: 6,
  lineHeight: 1.45,
};

const contextLine: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 4,
  lineHeight: 1.5,
};

const closeButton: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  width: 32,
  height: 32,
  fontSize: 18,
  cursor: "pointer",
  color: "var(--ink)",
};

const section: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const sectionHeading: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 800,
  color: "var(--muted)",
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};

const audienceGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const statCard: React.CSSProperties = {
  background: "rgba(176,137,84,0.12)",
  border: "1px solid var(--brass)",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 4,
};

const statCardMuted: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 4,
};

const statLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--muted)",
};

const statValueBig: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: "var(--obsidian)",
  lineHeight: 1,
};

const statDetail: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
};

const exclusionGroupWrap: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const exclusionGroupCard: React.CSSProperties = {
  borderRadius: 8,
  padding: 10,
};

const exclusionGroupHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
};

const exclusionGroupTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const exclusionGroupTotal: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--obsidian)",
};

const exclusionGroupHint: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  margin: "4px 0 8px",
  lineHeight: 1.4,
  fontStyle: "italic",
};

const exclusionList: React.CSSProperties = {
  display: "grid",
  gap: 6,
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const exclusionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 13,
  color: "var(--ink)",
};

const exclusionDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "var(--fog)",
  flexShrink: 0,
};

const exclusionCount: React.CSSProperties = {
  fontWeight: 700,
  color: "var(--obsidian)",
  minWidth: 36,
};

const exclusionLabel: React.CSSProperties = {
  color: "var(--muted)",
};

const templateRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
};

const templateLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--muted)",
};

const templateButton: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--obsidian)",
  cursor: "pointer",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const textarea: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: "12px 12px",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  lineHeight: 1.45,
  resize: "vertical",
};

const mergeRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
};

const mergeRowLabel: React.CSSProperties = {
  ...templateLabel,
};

const mergeChip: React.CSSProperties = {
  background: "rgba(176,137,84,0.12)",
  border: "1px solid var(--brass)",
  borderRadius: 6,
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--obsidian)",
  cursor: "pointer",
};

const meterRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  color: "var(--muted)",
  flexWrap: "wrap",
};

const footerNote: React.CSSProperties = {
  fontStyle: "italic",
};

const previewList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const previewCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 6,
};

const previewCardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "baseline",
  flexWrap: "wrap",
};

const previewName: React.CSSProperties = {
  fontSize: 13,
  color: "var(--obsidian)",
};

const previewMeta: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
};

const previewBody: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink)",
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};

const previewCount: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--brass)",
};

const shufflePreview: React.CSSProperties = {
  alignSelf: "flex-start",
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

const emptyNote: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  fontStyle: "italic",
};

const errorBanner: React.CSSProperties = {
  background: "rgba(176,137,84,0.14)",
  border: "1px solid var(--brass)",
  borderRadius: 8,
  padding: 12,
  color: "var(--obsidian)",
  fontSize: 13,
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  borderTop: "1px solid var(--fog)",
  paddingTop: 16,
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  padding: "12px 18px",
  minHeight: 44,
  fontSize: 12,
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
