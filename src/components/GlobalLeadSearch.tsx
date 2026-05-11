"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchDeals, type Deal } from "@/lib/deals";
import { fetchImportedLandLeads, type ImportedLandLead } from "@/lib/land-leads";

type SearchResult =
  | { kind: "Imported Lead"; id: string; title: string; meta: string; href: string; score: number; haystack: string }
  | { kind: "Deal Packet"; id: string; title: string; meta: string; href: string; score: number; haystack: string };

function collectSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(collectSearchText).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key} ${collectSearchText(entry)}`)
      .join(" ");
  }
  return "";
}

function statusLabel(value: string | null | undefined): string {
  if (!value) return "Not Set";
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function importedLeadTitle(lead: ImportedLandLead): string {
  return lead.owner_name || lead.property_address || lead.parcel_id || "Imported lead";
}

function importedLeadMeta(lead: ImportedLandLead): string {
  return [
    statusLabel(lead.status),
    lead.phone || lead.phone_2,
    lead.property_address,
    lead.parcel_id,
    lead.county,
    lead.campaign_source,
  ].filter(Boolean).join(" · ");
}

function dealMeta(deal: Deal): string {
  return [
    statusLabel(deal.status),
    deal.seller_name,
    deal.seller_phone,
    deal.address,
    deal.parcel_id,
    deal.campaign_source,
  ].filter(Boolean).join(" · ");
}

export default function GlobalLeadSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<ImportedLandLead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    setUser(localStorage.getItem("meridian_user"));
  }, [pathname]);

  const shouldShow = !!user && pathname !== "/" && pathname !== "/apply";
  const crmShell = ["/crm", "/va", "/deals", "/opportunity", "/actions", "/operations", "/meetings"].some(route => pathname === route || pathname.startsWith(route + "/"));

  const loadSearchData = async () => {
    if (loaded || loading) return;
    setLoading(true);
    const [leadRows, dealRows] = await Promise.all([
      fetchImportedLandLeads(3000),
      fetchDeals(),
    ]);
    setLeads(leadRows);
    setDeals(dealRows);
    setLoaded(true);
    setLoading(false);
  };

  const results = useMemo<SearchResult[]>(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const leadResults: SearchResult[] = leads.map(lead => {
      const haystack = collectSearchText(lead).toLowerCase();
      return {
        kind: "Imported Lead" as const,
        id: lead.id,
        title: importedLeadTitle(lead),
        meta: importedLeadMeta(lead),
        href: `/opportunity?lead=${lead.id}`,
        score: (lead.lead_score ?? 0) + (lead.status === "interested" ? 50 : 0),
        haystack,
      };
    });

    const dealResults: SearchResult[] = deals.map(deal => {
      const haystack = collectSearchText(deal).toLowerCase();
      return {
        kind: "Deal Packet" as const,
        id: deal.id,
        title: deal.title || deal.address || deal.parcel_id || "Deal packet",
        meta: dealMeta(deal),
        href: `/opportunity?deal=${deal.id}`,
        score: deal.urgency === "hot" ? 80 : deal.status === "under-review" ? 45 : 20,
        haystack,
      };
    });

    return [...leadResults, ...dealResults]
      .filter(result => terms.every(term => result.haystack.includes(term)))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 10);
  }, [deals, leads, query]);

  const goToResult = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!shouldShow) return null;

  return (
    <div className="global-lead-search">
      {!crmShell && <span className="global-lead-search-label">Lead search</span>}
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onFocus={() => { setOpen(true); void loadSearchData(); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); void loadSearchData(); }}
          placeholder="Search by seller, phone, parcel ID, county, buyer..."
          style={{
            width: "100%",
            height: 38,
            borderRadius: 6,
            border: "1px solid rgba(201,168,120,0.45)",
            background: "var(--bone)",
            color: "var(--ink)",
            padding: "0 12px",
            fontSize: 13,
            fontFamily: "var(--font-body)",
          }}
        />
        {open && (query.trim() || loading) && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--bone)",
            border: "1px solid var(--fog)",
            borderRadius: 8,
            boxShadow: "0 18px 44px rgba(20,17,13,0.22)",
            overflow: "hidden",
          }}>
            {loading && <p style={emptyStyle}>Loading leads...</p>}
            {!loading && results.length === 0 && <p style={emptyStyle}>No lead or deal matches that search.</p>}
            {!loading && results.map(result => (
              <button
                key={`${result.kind}-${result.id}`}
                onMouseDown={event => event.preventDefault()}
                onClick={() => goToResult(result.href)}
                style={{
                  width: "100%",
                  display: "block",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--fog)",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", color: "var(--brass)", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {result.kind}
                </span>
                <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 13, lineHeight: 1.25, marginTop: 2 }}>
                  {result.title}
                </strong>
                <span style={{ display: "block", color: "var(--muted)", fontSize: 12, lineHeight: 1.35, marginTop: 3 }}>
                  {result.meta || "No detail added"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .global-lead-search {
          position: fixed;
          top: ${crmShell ? "10px" : "70px"};
          left: ${crmShell ? "calc(156px + 28px)" : "50%"};
          width: ${crmShell ? "min(560px, calc(100vw - 560px))" : "min(680px, calc(100vw - 40px))"};
          transform: ${crmShell ? "none" : "translateX(-50%)"};
          z-index: 260;
          display: grid;
          grid-template-columns: ${crmShell ? "1fr" : "auto minmax(0, 1fr)"};
          gap: 10px;
          align-items: center;
          padding: ${crmShell ? "0" : "8px"};
          border: ${crmShell ? "none" : "1px solid rgba(201,168,120,0.32)"};
          border-radius: ${crmShell ? "0" : "10px"};
          background: ${crmShell ? "transparent" : "rgba(27,23,18,0.92)"};
          box-shadow: ${crmShell ? "none" : "0 16px 42px rgba(20,17,13,0.2)"};
          backdrop-filter: blur(10px);
        }
        .global-lead-search-label {
          color: var(--brass);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        @media (max-width: 767px) {
          .global-lead-search {
            top: ${crmShell ? "56px" : "calc(10px + env(safe-area-inset-top))"};
            left: 12px;
            right: 12px;
            bottom: auto;
            width: auto;
            transform: none;
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.4,
  padding: "12px",
};
