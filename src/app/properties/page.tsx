"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  fetchImportedLandLeads,
  importedLeadDealPropertyType,
  listingUrlHints,
  type ImportedLandLead,
} from "@/lib/land-leads";
import { getCurrentMeridianUser } from "@/lib/identity";

const DISPLAY_FONT = "var(--font-display)";

type PropertyFilter = "all" | "land" | "house" | "rental" | "commercial" | "other" | "unlinked" | "deal-linked";

const FILTERS: Array<{ value: PropertyFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "land", label: "Land" },
  { value: "house", label: "House" },
  { value: "rental", label: "Rental" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
  { value: "unlinked", label: "No Deal Packet" },
  { value: "deal-linked", label: "Deal Linked" },
];

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function numberText(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function dateText(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function propertyTitle(lead: ImportedLandLead): string {
  return displayAddressParts(lead).address || lead.property_address || lead.parcel_id || lead.owner_name || "Property record";
}

function propertySubtitle(lead: ImportedLandLead): string {
  const display = displayAddressParts(lead);
  return [
    [display.city || lead.city, display.state || lead.state].filter(Boolean).join(", "),
    display.zip || lead.zip,
    lead.county,
  ].filter(Boolean).join(" · ") || "Location pending";
}

function normalizeKey(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function displayAddressParts(lead: ImportedLandLead): { address: string | null; city: string | null; state: string | null; zip: string | null; conflict: boolean } {
  const urlHints = listingUrlHints(lead.property_url || lead.parcel_link || "");
  const urlAddress = [urlHints.propertyAddress, urlHints.city, urlHints.state, urlHints.zip].filter(Boolean).join(" ");
  const savedAddress = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean).join(" ");
  const urlNumber = normalizeKey(urlAddress).match(/\b\d{1,6}\b/)?.[0] || null;
  const savedNumber = normalizeKey(savedAddress).match(/\b\d{1,6}\b/)?.[0] || null;
  const conflict = Boolean(urlHints.propertyAddress && savedAddress && urlNumber && savedNumber && urlNumber !== savedNumber);
  return {
    address: conflict ? urlHints.propertyAddress || null : null,
    city: conflict ? urlHints.city || null : null,
    state: conflict ? urlHints.state || null : null,
    zip: conflict ? urlHints.zip || null : null,
    conflict,
  };
}

function recordKey(lead: ImportedLandLead): string {
  const url = normalizeKey(lead.property_url || lead.parcel_link);
  if (url) return `url:${url}`;
  const parcel = normalizeKey(lead.parcel_id);
  if (parcel) return `parcel:${parcel}`;
  const display = displayAddressParts(lead);
  return `address:${normalizeKey([display.address || lead.property_address, display.city || lead.city, display.state || lead.state, display.zip || lead.zip].filter(Boolean).join(" ")) || lead.id}`;
}

function uniqueRecords(records: ImportedLandLead[]): ImportedLandLead[] {
  const seen = new Set<string>();
  return records
    .sort((a, b) => sortValue(b).localeCompare(sortValue(a)))
    .filter(lead => {
      const key = recordKey(lead);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function filterMatches(lead: ImportedLandLead, filter: PropertyFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unlinked") return !lead.deal_id;
  if (filter === "deal-linked") return Boolean(lead.deal_id);
  return importedLeadDealPropertyType(lead) === filter;
}

function searchMatches(lead: ImportedLandLead, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const display = displayAddressParts(lead);
  return [
    display.address,
    display.city,
    display.state,
    display.zip,
    lead.property_address,
    lead.parcel_id,
    lead.owner_name,
    lead.city,
    lead.state,
    lead.zip,
    lead.county,
    lead.source_system,
    lead.campaign_source,
    lead.land_use,
    lead.zoning,
  ].filter(Boolean).join(" ").toLowerCase().includes(query);
}

function sortValue(lead: ImportedLandLead): string {
  return lead.updated_at || lead.created_at || "";
}

export default function PropertiesPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [records, setRecords] = useState<ImportedLandLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PropertyFilter>("all");

  useEffect(() => {
    const current = getCurrentMeridianUser();
    if (!current) {
      router.push("/");
      return;
    }
    setUser(current);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    void fetchImportedLandLeads(2500)
      .then(rows => {
        if (cancelled) return;
        setRecords(rows);
        setMessage(rows.length ? "" : "No property records are visible yet. Add a property or import a list to start the inventory.");
      })
      .catch(error => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Property records could not load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const uniqueRows = useMemo(() => uniqueRecords(records), [records]);

  const rows = useMemo(() => uniqueRows
    .filter(lead => filterMatches(lead, filter))
    .filter(lead => searchMatches(lead, search))
    .sort((a, b) => sortValue(b).localeCompare(sortValue(a))),
    [filter, search, uniqueRows],
  );

  const stats = useMemo(() => ({
    total: uniqueRows.length,
    hiddenDuplicates: Math.max(0, records.length - uniqueRows.length),
    land: uniqueRows.filter(row => importedLeadDealPropertyType(row) === "land").length,
    linked: uniqueRows.filter(row => Boolean(row.deal_id)).length,
    newest: uniqueRows[0]?.created_at || null,
  }), [records.length, uniqueRows]);

  if (!user) return null;

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <p style={eyebrow}>Member portal</p>
          <h1 style={title}>Properties</h1>
          <p style={lede}>All saved property records from link intake and imported land lists, with quick access to the record and analyzer.</p>
        </div>
        <div style={headerActions}>
          <button type="button" onClick={() => router.push("/va?tab=lists&create=property")} style={primaryButton}>Add Property</button>
          <button type="button" onClick={() => router.push("/analyze")} style={secondaryButton}>Analyze Deal</button>
        </div>
      </section>

      {message && <p style={messageBox}>{message}</p>}

      <section style={statsGrid}>
        <Metric label="Visible records" value={String(rows.length)} />
        <Metric label="Total saved" value={String(stats.total)} />
        <Metric label="Duplicates hidden" value={String(stats.hiddenDuplicates)} />
        <Metric label="Land records" value={String(stats.land)} />
        <Metric label="Deal linked" value={String(stats.linked)} />
        <Metric label="Newest added" value={dateText(stats.newest)} />
      </section>

      <section style={panel}>
        <div style={toolbar}>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search address, APN, owner, city, county, source..."
            style={input}
          />
          <select value={filter} onChange={event => setFilter(event.target.value as PropertyFilter)} style={select}>
            {FILTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Property</th>
                <th style={th}>Type</th>
                <th style={th}>Price</th>
                <th style={th}>Acres</th>
                <th style={th}>Owner</th>
                <th style={th}>Source</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(lead => {
                const type = importedLeadDealPropertyType(lead);
                const display = displayAddressParts(lead);
                const detailsConflict = display.conflict;
                return (
                  <tr key={lead.id} style={tr}>
                    <td style={td}>
                      <strong style={rowTitle}>{propertyTitle(lead)}</strong>
                      <span style={rowMeta}>{propertySubtitle(lead)}</span>
                      <span style={rowMeta}>{lead.parcel_id || "APN pending"}</span>
                      {detailsConflict && <span style={warnText}>Source URL address did not match saved listing-card details.</span>}
                    </td>
                    <td style={td}><span style={pill}>{type}</span></td>
                    <td style={td}>{detailsConflict ? "-" : money(lead.asking_price ?? lead.market_value ?? lead.assessed_value)}</td>
                    <td style={td}>{detailsConflict ? "-" : numberText(lead.acreage, " ac")}</td>
                    <td style={td}>
                      <span>{lead.owner_name || "Owner pending"}</span>
                      <span style={rowMeta}>{lead.phone || lead.phone_2 || lead.email || "Contact pending"}</span>
                    </td>
                    <td style={td}>
                      <span>{lead.campaign_source || lead.source_system || "Property intake"}</span>
                      <span style={rowMeta}>Added {dateText(lead.created_at)}</span>
                    </td>
                    <td style={td}>
                      <span style={lead.deal_id ? goodPill : mutedPill}>{lead.deal_id ? "Deal linked" : lead.status || "new"}</span>
                    </td>
                    <td style={td}>
                      <div style={rowActions}>
                        <button type="button" onClick={() => router.push(`/lead/${lead.id}?tab=properties&property=${lead.id}`)} style={smallButton}>Open</button>
                        <button type="button" onClick={() => router.push(`/analyze?lead=${lead.id}`)} style={smallButton}>Analyze</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <p style={emptyText}>Loading property records...</p>}
          {!loading && rows.length === 0 && <p style={emptyText}>No property records match this view.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bone)",
  padding: "26px clamp(16px, 3vw, 36px) 46px",
  display: "grid",
  gap: 18,
};

const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  borderBottom: "1px solid var(--fog)",
  paddingBottom: 18,
};

const headerActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const eyebrow: CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const title: CSSProperties = {
  fontFamily: DISPLAY_FONT,
  color: "var(--obsidian)",
  fontSize: "clamp(34px, 5vw, 58px)",
  fontWeight: 500,
  lineHeight: 0.98,
  letterSpacing: 0,
};

const lede: CSSProperties = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 760,
  marginTop: 10,
};

const primaryButton: CSSProperties = {
  border: "1px solid var(--obsidian)",
  background: "var(--obsidian)",
  color: "var(--bone)",
  borderRadius: 7,
  minHeight: 40,
  padding: "10px 13px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "var(--surface)",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const messageBox: CSSProperties = {
  border: "1px solid rgba(49,107,76,0.22)",
  background: "rgba(49,107,76,0.08)",
  color: "#284f3a",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.45,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const metric: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,252,245,0.88)",
  padding: 12,
  display: "grid",
  gap: 4,
  color: "var(--muted)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const panel: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,252,245,0.88)",
  overflow: "hidden",
};

const toolbar: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 1fr) minmax(160px, 240px)",
  gap: 10,
  padding: 12,
  borderBottom: "1px solid var(--fog)",
};

const input: CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  background: "var(--surface)",
  color: "var(--obsidian)",
  padding: "10px 11px",
  fontSize: 14,
  outline: "none",
};

const select: CSSProperties = {
  ...input,
  minHeight: 41,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
};

const table: CSSProperties = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
  fontSize: 12,
};

const th: CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid var(--fog)",
  whiteSpace: "nowrap",
};

const tr: CSSProperties = {
  borderBottom: "1px solid var(--fog)",
};

const td: CSSProperties = {
  padding: "11px 12px",
  color: "var(--obsidian)",
  verticalAlign: "top",
};

const rowTitle: CSSProperties = {
  display: "block",
  color: "var(--obsidian)",
  fontSize: 13,
  lineHeight: 1.3,
};

const rowMeta: CSSProperties = {
  display: "block",
  color: "var(--muted)",
  fontSize: 11,
  lineHeight: 1.4,
  marginTop: 2,
};

const warnText: CSSProperties = {
  display: "block",
  color: "#8d3f31",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.35,
  marginTop: 4,
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const smallButton: CSSProperties = {
  border: "1px solid var(--fog)",
  background: "var(--surface)",
  color: "var(--obsidian)",
  borderRadius: 7,
  minHeight: 30,
  padding: "7px 10px",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const pill: CSSProperties = {
  border: "1px solid rgba(176,137,84,0.32)",
  background: "rgba(176,137,84,0.10)",
  color: "#765629",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const goodPill: CSSProperties = {
  ...pill,
  border: "1px solid rgba(49,107,76,0.28)",
  background: "rgba(49,107,76,0.10)",
  color: "#316b4c",
};

const mutedPill: CSSProperties = {
  ...pill,
  border: "1px solid var(--fog)",
  background: "var(--surface)",
  color: "var(--muted)",
};

const emptyText: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  padding: 16,
};
