"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OperatingHeader from "@/components/OperatingHeader";
import BulkSmsDrawer from "@/components/BulkSmsDrawer";
import { categorizeForBulkSms } from "@/lib/bulk-sms";
import {
  fetchImportedLandLeads,
  fetchLandLeadBatches,
  type ImportedLandLead,
  type LandLeadBatch,
} from "@/lib/land-leads";
import { labelForStatus } from "@/lib/status-map";

type FilterKey =
  | "all"
  | "has-mobile"
  | "interested"
  | "no-contact"
  | "previously-contacted"
  | "tax-delinquent"
  | "out-of-state"
  | "compliance-clean"
  | "opted-out"
  | "multi-property";

const FILTERS: Array<{ key: FilterKey; label: string; matches: (lead: ImportedLandLead, ctx: FilterCtx) => boolean }> = [
  { key: "all", label: "All", matches: () => true },
  { key: "has-mobile", label: "Has mobile", matches: (l) => hasMobile(l) },
  { key: "interested", label: "Interested", matches: (l) => l.status === "interested" },
  { key: "no-contact", label: "No prior contact", matches: (l) => !(l.outreach_count && l.outreach_count > 0) },
  { key: "previously-contacted", label: "Contacted", matches: (l) => !!l.outreach_count && l.outreach_count > 0 },
  { key: "tax-delinquent", label: "Tax delinquent", matches: (l) => l.tax_delinquent === true },
  { key: "out-of-state", label: "Out-of-state owner", matches: (l) => l.owner_out_of_state === true },
  { key: "compliance-clean", label: "Compliance clean", matches: (l) => !l.dnc && !l.state_dnc && !l.litigator && l.sms_opt_status !== "opted-out" },
  { key: "opted-out", label: "Opted out", matches: (l) => l.sms_opt_status === "opted-out" },
  { key: "multi-property", label: "Multi-property owner", matches: (l, ctx) => ctx.multiPropertyOwners.has(ownerKey(l)) },
];

interface FilterCtx {
  multiPropertyOwners: Set<string>;
}

function ownerKey(lead: ImportedLandLead): string {
  const phone = (lead.phone || lead.phone_2 || "").replace(/\D/g, "");
  const owner = (lead.owner_name || "").toLowerCase().trim();
  return `${phone}|${owner}`;
}

function hasMobile(lead: ImportedLandLead): boolean {
  const types = [
    lead.phone_1_type, lead.phone_2_type, lead.phone_3_type,
    lead.phone_4_type, lead.phone_5_type, lead.phone_6_type,
  ];
  if (types.some(t => (t || "").toLowerCase().includes("mobile"))) return true;
  if (types.every(t => !t)) return !!(lead.phone || lead.phone_2);
  return false;
}

export default function ListDetailPage() {
  const params = useParams<{ batch_id: string }>();
  const batchId = params?.batch_id;
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [batch, setBatch] = useState<LandLeadBatch | null>(null);
  const [allLeads, setAllLeads] = useState<ImportedLandLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const u = typeof window !== "undefined" ? localStorage.getItem("meridian_user") : null;
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [batches, leads] = await Promise.all([
        fetchLandLeadBatches(60),
        fetchImportedLandLeads(2000),
      ]);
      if (cancelled) return;
      setBatch(batches.find(b => b.id === batchId) ?? null);
      setAllLeads(leads.filter(l => l.batch_id === batchId));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of allLeads) {
      const key = ownerKey(lead);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [allLeads]);

  const multiPropertyOwners = useMemo(() => {
    const set = new Set<string>();
    ownerCounts.forEach((count, key) => { if (count > 1) set.add(key); });
    return set;
  }, [ownerCounts]);

  const filterCtx = useMemo<FilterCtx>(() => ({ multiPropertyOwners }), [multiPropertyOwners]);

  const filteredLeads = useMemo(() => {
    const filterFn = FILTERS.find(f => f.key === filter)?.matches ?? FILTERS[0].matches;
    const query = search.trim().toLowerCase();
    return allLeads.filter(lead => {
      if (!filterFn(lead, filterCtx)) return false;
      if (!query) return true;
      const hay = [
        lead.owner_name, lead.property_address, lead.parcel_id, lead.county,
        lead.phone, lead.phone_2, lead.email,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [allLeads, filter, search, filterCtx]);

  const selectedLeads = useMemo(() => filteredLeads.filter(l => selectedIds.has(l.id)), [filteredLeads, selectedIds]);
  const bulkSourceLeads = selectMode && selectedIds.size > 0 ? selectedLeads : filteredLeads;
  const categorization = useMemo(() => categorizeForBulkSms(bulkSourceLeads), [bulkSourceLeads]);

  const funnel = useMemo(() => {
    const propertyRows = allLeads.length;
    const uniqueOwnerKeys = new Set(allLeads.map(ownerKey));
    const uniqueLeadCount = uniqueOwnerKeys.size;
    const textableLeadCount = allLeads.filter(hasMobile).length;
    const multiPropertyLeadCount = Array.from(ownerCounts.values()).filter(c => c > 1).length;
    const optedOut = allLeads.filter(l => l.sms_opt_status === "opted-out").length;
    const dncOrLitigator = allLeads.filter(l => l.dnc || l.state_dnc || l.litigator).length;
    const taxDelinquent = allLeads.filter(l => l.tax_delinquent === true).length;
    const outOfState = allLeads.filter(l => l.owner_out_of_state === true).length;
    return { propertyRows, uniqueLeadCount, textableLeadCount, multiPropertyLeadCount, optedOut, dncOrLitigator, taxDelinquent, outOfState };
  }, [allLeads, ownerCounts]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      "all": allLeads.length,
      "has-mobile": 0,
      "interested": 0,
      "no-contact": 0,
      "previously-contacted": 0,
      "tax-delinquent": 0,
      "out-of-state": 0,
      "compliance-clean": 0,
      "opted-out": 0,
      "multi-property": 0,
    };
    for (const lead of allLeads) {
      for (const f of FILTERS) {
        if (f.key === "all") continue;
        if (f.matches(lead, filterCtx)) counts[f.key] += 1;
      }
    }
    return counts;
  }, [allLeads, filterCtx]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInView = () => setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  const clearSelected = () => setSelectedIds(new Set());

  const sendBulkSms = async ({ message: body, recipients }: { message: string; recipients: Array<{ leadId: string; toNumber: string; label: string | null; rendered: string }> }): Promise<{ sent?: number; error?: string }> => {
    if (!body.trim()) return { error: "Write a message before sending." };
    if (recipients.length === 0) return { error: "No eligible recipients." };
    setMessage("");
    const response = await fetch("/api/sakari/bulk-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: user,
        message: body,
        recipients: recipients.map(r => ({
          leadId: r.leadId,
          toNumber: r.toNumber,
          label: r.label,
          message: r.rendered,
        })),
      }),
    });
    const result = await response.json().catch(() => ({})) as { sent?: number; error?: string };
    if (!response.ok || result.error) {
      const errorMessage = result.error || response.statusText;
      setMessage(`Bulk SMS failed: ${errorMessage}`);
      return { error: errorMessage };
    }
    const sent = result.sent ?? recipients.length;
    setMessage(`Bulk SMS sent to ${sent} seller${sent === 1 ? "" : "s"}.`);
    setSelectedIds(new Set());
    setSelectMode(false);
    // Refresh leads to capture status changes
    const fresh = await fetchImportedLandLeads(2000);
    setAllLeads(fresh.filter(l => l.batch_id === batchId));
    return { sent };
  };

  if (!user) return null;

  const listLabel = batch?.campaign_source || batch?.original_filename || batch?.source_system || "Imported list";
  const importDate = batch?.created_at ? new Date(batch.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="lists-root" style={{ maxWidth: 1480, margin: "0 auto", padding: "82px 20px 100px" }}>
      <OperatingHeader
        eyebrow="Lead source"
        title={listLabel}
        subtitle={`Imported ${importDate}${batch?.source_system ? ` from ${batch.source_system}` : ""}${batch?.uploaded_by ? ` by ${batch.uploaded_by}` : ""}`}
        user={user}
        mode="va"
        actions={
          <>
            <button onClick={() => router.push("/va?tab=lists")} style={secondaryButton}>Back to Lists</button>
            <button
              onClick={() => setBulkDrawerOpen(true)}
              disabled={categorization.eligible.length === 0}
              style={{ ...primaryButton, opacity: categorization.eligible.length === 0 ? 0.55 : 1 }}
            >
              {selectMode && selectedIds.size > 0 ? `Bulk Text ${selectedIds.size} →` : `Bulk Text ${categorization.eligible.length} →`}
            </button>
          </>
        }
        stats={[
          { label: "Property rows", value: String(funnel.propertyRows), detail: "Raw rows imported", tone: "default" as const },
          { label: "Unique leads", value: String(funnel.uniqueLeadCount), detail: "After grouping by owner", tone: "default" as const },
          { label: "Textable", value: String(funnel.textableLeadCount), detail: "Have valid mobile", tone: funnel.textableLeadCount ? "good" as const : "default" as const },
          { label: "Multi-property", value: String(funnel.multiPropertyLeadCount), detail: "Owns 2+ parcels", tone: funnel.multiPropertyLeadCount ? "hot" as const : "default" as const },
        ]}
      />

      {message && (
        <div style={{ ...panel, padding: 12, marginBottom: 16, borderColor: message.includes("failed") ? "var(--obsidian)" : "var(--brass)" }}>
          <p style={{ fontSize: 13, color: "var(--ink)" }}>{message}</p>
        </div>
      )}

      <section style={{ ...panel, marginBottom: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={eyebrowSmall}>Funnel</p>
            <h2 style={sectionTitle}>From import to outreach</h2>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)" }}>
            <span>{funnel.optedOut} opted out</span>
            <span>·</span>
            <span>{funnel.dncOrLitigator} DNC / litigator</span>
            <span>·</span>
            <span>{funnel.taxDelinquent} tax delinquent</span>
            <span>·</span>
            <span>{funnel.outOfState} out-of-state</span>
          </div>
        </header>

        <div className="lists-filters" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {FILTERS.map(f => {
            const count = filterCounts[f.key];
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  ...filterChip,
                  background: active ? "var(--obsidian)" : "var(--surface)",
                  color: active ? "var(--bone)" : "var(--obsidian)",
                  borderColor: active ? "var(--obsidian)" : "var(--fog)",
                }}
              >
                {f.label}
                <span style={{
                  marginLeft: 6,
                  fontSize: 10,
                  opacity: 0.7,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: active ? "rgba(255,252,245,0.18)" : "rgba(20,17,13,0.06)",
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search owner, address, parcel, phone, county…"
            style={searchInput}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => { setSelectMode(m => !m); if (selectMode) clearSelected(); }}
              style={{ ...secondaryButton, opacity: 1 }}
            >
              {selectMode ? "Cancel select" : "Select mode"}
            </button>
            {selectMode && (
              <>
                <button onClick={selectAllInView} style={secondaryButton}>Select visible ({filteredLeads.length})</button>
                <button onClick={clearSelected} disabled={selectedIds.size === 0} style={{ ...secondaryButton, opacity: selectedIds.size === 0 ? 0.55 : 1 }}>Clear ({selectedIds.size})</button>
              </>
            )}
          </div>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid var(--fog)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead>
              <tr>
                {selectMode && <th style={tableHead} aria-label="select" />}
                <th style={tableHead}>Owner</th>
                <th style={tableHead}>Phone</th>
                <th style={tableHead}>County</th>
                <th style={tableHead}>Acres</th>
                <th style={tableHead}>Status</th>
                <th style={tableHead}>Signals</th>
                <th style={tableHead}>Last touch</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={selectMode ? 8 : 7} style={{ ...tableCell, textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>
              )}
              {!loading && filteredLeads.length === 0 && (
                <tr><td colSpan={selectMode ? 8 : 7} style={{ ...tableCell, textAlign: "center", color: "var(--muted)" }}>No leads match this filter.</td></tr>
              )}
              {!loading && filteredLeads.map(lead => {
                const ownerHasMany = multiPropertyOwners.has(ownerKey(lead));
                const phone = lead.phone || lead.phone_2 || "—";
                const blocked = !!lead.dnc || !!lead.state_dnc || !!lead.litigator || lead.sms_opt_status === "opted-out";
                return (
                  <tr key={lead.id} style={{ background: selectedIds.has(lead.id) ? "rgba(176,137,84,0.12)" : "var(--surface)", cursor: "pointer" }} onClick={() => {
                    if (selectMode) { toggleSelected(lead.id); return; }
                    router.push(`/lead/${lead.id}`);
                  }}>
                    {selectMode && (
                      <td style={tableCell} onClick={e => { e.stopPropagation(); toggleSelected(lead.id); }}>
                        <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelected(lead.id)} />
                      </td>
                    )}
                    <td style={tableCell}>
                      <strong style={{ color: "var(--obsidian)" }}>{lead.owner_name || "Owner unknown"}</strong>
                      {ownerHasMany && <span style={{ marginLeft: 6, ...pill, fontSize: 9 }}>🏷 {ownerCounts.get(ownerKey(lead))} props</span>}
                      <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>{lead.property_address || lead.parcel_id || "No address"}</p>
                    </td>
                    <td style={tableCell}>{phone}</td>
                    <td style={tableCell}>{lead.county || "—"}</td>
                    <td style={tableCell}>{lead.acreage ?? "—"}</td>
                    <td style={tableCell}>
                      <span style={lead.status === "interested" ? hotPill : pill}>{labelForStatus(lead.status)}</span>
                    </td>
                    <td style={tableCell}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {blocked && <span style={blockChip}>⛔ DNC/blocked</span>}
                        {lead.tax_delinquent && <span style={signalChip}>Tax due {lead.tax_delinquent_years ?? ""}</span>}
                        {lead.owner_out_of_state && <span style={signalChip}>Out of state</span>}
                        {lead.seller_iq && <span style={signalChip}>SellerIQ {lead.seller_iq}</span>}
                        {!blocked && !lead.tax_delinquent && !lead.owner_out_of_state && !lead.seller_iq && (
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={tableCell}>
                      {lead.last_sms_at
                        ? new Date(lead.last_sms_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : lead.last_activity_at
                          ? new Date(lead.last_activity_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
          Showing {filteredLeads.length} of {allLeads.length} · {categorization.eligible.length} eligible to text · {categorization.excluded.length} excluded
        </p>
      </section>

      <BulkSmsDrawer
        open={bulkDrawerOpen}
        onClose={() => setBulkDrawerOpen(false)}
        audienceLabel={`List: ${listLabel}`}
        audienceContext={[
          filter !== "all" ? `Filter: ${FILTERS.find(f => f.key === filter)?.label}` : null,
          search.trim() ? `Search: "${search.trim()}"` : null,
          selectMode && selectedIds.size > 0 ? `Hand-picked: ${selectedIds.size}` : null,
        ].filter(Boolean).join(" · ") || undefined}
        categorization={categorization}
        onSend={sendBulkSms}
      />

      <style jsx>{`
        @media (max-width: 880px) {
          .lists-root { padding-top: 28px !important; }
          .lists-filters { overflow-x: auto; flex-wrap: nowrap !important; }
        }
      `}</style>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 16px 44px rgba(20,17,13,0.06)",
};

const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  padding: "10px 13px",
  minHeight: 42,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
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

const filterChip: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 280,
  padding: "10px 12px",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "var(--font-body)",
  background: "var(--surface)",
  color: "var(--ink)",
};

const tableHead: React.CSSProperties = {
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

const tableCell: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid var(--fog)",
  color: "var(--ink)",
  fontSize: 12,
  lineHeight: 1.4,
  verticalAlign: "middle",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "3px 7px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  whiteSpace: "nowrap",
};

const hotPill: React.CSSProperties = {
  ...pill,
  borderColor: "var(--brass)",
  color: "var(--obsidian)",
  background: "rgba(176,137,84,0.14)",
};

const signalChip: React.CSSProperties = {
  ...pill,
  fontSize: 9,
  padding: "2px 6px",
  letterSpacing: "0.06em",
  background: "rgba(176,137,84,0.10)",
  borderColor: "var(--brass)",
  color: "var(--obsidian)",
};

const blockChip: React.CSSProperties = {
  ...pill,
  fontSize: 9,
  padding: "2px 6px",
  letterSpacing: "0.06em",
  background: "var(--obsidian)",
  borderColor: "var(--obsidian)",
  color: "var(--brass)",
};
