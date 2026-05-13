"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchDeals, type Deal } from "@/lib/deals";
import { fetchImportedLandLeads, type ImportedLandLead } from "@/lib/land-leads";

type SearchResult =
  | { kind: "Imported Lead"; id: string; title: string; meta: string; href: string; score: number; haystack: string }
  | { kind: "Packet"; id: string; title: string; meta: string; href: string; score: number; haystack: string };

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<ImportedLandLead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [vaTab, setVaTab] = useState<string | null>(null);

  useEffect(() => {
    setUser(localStorage.getItem("meridian_user"));
    if (pathname === "/va") setVaTab(new URLSearchParams(window.location.search).get("tab") || "today");
    else setVaTab(null);
  }, [pathname]);

  useEffect(() => {
    const handleVaTab = (event: Event) => {
      setVaTab((event as CustomEvent<string>).detail || null);
    };
    window.addEventListener("meridian-va-tab", handleVaTab);
    return () => window.removeEventListener("meridian-va-tab", handleVaTab);
  }, []);

  const shouldShow = !!user && pathname !== "/" && pathname !== "/apply" && !(pathname === "/va" && vaTab === "outreach");
  const crmShell = ["/crm", "/va", "/deals", "/opportunity", "/actions", "/operations", "/meetings"].some(route => pathname === route || pathname.startsWith(route + "/"));

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
        href: `/lead/${lead.id}`,
        score: (lead.lead_score ?? 0) + (lead.status === "interested" ? 50 : 0),
        haystack,
      };
    });

    const dealResults: SearchResult[] = deals.map(deal => {
      const haystack = collectSearchText(deal).toLowerCase();
      return {
        kind: "Packet" as const,
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
    <div className="global-lead-search" ref={rootRef}>
      <button
        type="button"
        aria-label="Open lead search"
        title="Search leads and deals"
        className="global-lead-search-trigger"
        onClick={() => {
          setOpen(current => {
            const next = !current;
            if (next) {
              void loadSearchData();
              window.setTimeout(() => inputRef.current?.focus(), 40);
            }
            return next;
          });
        }}
      >
        <span aria-hidden="true">⌕</span>
      </button>

      {open && (
      <div className="global-lead-search-panel">
        <p className="global-lead-search-label">Lead search</p>
        <input
          ref={inputRef}
          value={query}
          onFocus={() => { setOpen(true); void loadSearchData(); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); void loadSearchData(); }}
          placeholder="Search by seller, phone, parcel ID, county, buyer..."
          style={{
            width: "100%",
            height: 42,
            borderRadius: 8,
            border: "1px solid rgba(201,168,120,0.45)",
            background: "var(--bone)",
            color: "var(--ink)",
            padding: "0 13px",
            fontSize: 13,
            fontFamily: "var(--font-body)",
            outline: "none",
          }}
        />
        {open && (query.trim() || loading) && (
          <div style={{
            marginTop: 8,
            background: "var(--bone)",
            border: "1px solid var(--fog)",
            borderRadius: 8,
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
      )}
      <style jsx>{`
        .global-lead-search {
          position: fixed;
          top: ${crmShell ? "10px" : "11px"};
          right: ${crmShell ? "292px" : "clamp(260px, 24vw, 430px)"};
          z-index: 320;
        }
        .global-lead-search-trigger {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid ${crmShell ? "var(--fog)" : "rgba(214,205,183,0.22)"};
          background: ${crmShell ? "rgba(255,252,245,0.9)" : "rgba(237,230,214,0.06)"};
          color: ${crmShell ? "var(--obsidian)" : "var(--bone)"};
          box-shadow: ${crmShell ? "0 8px 24px rgba(20,17,13,0.08)" : "none"};
          cursor: pointer;
          font-family: var(--font-body);
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .global-lead-search-trigger:hover {
          background: ${crmShell ? "var(--bone)" : "rgba(201,168,120,0.18)"};
          border-color: var(--brass);
          color: var(--brass);
        }
        .global-lead-search-trigger span {
          font-size: 25px;
          line-height: 1;
          transform: translateY(-1px);
        }
        .global-lead-search-panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: min(520px, calc(100vw - 32px));
          padding: 10px;
          border: 1px solid rgba(201,168,120,0.32);
          border-radius: 12px;
          background: rgba(27,23,18,0.95);
          box-shadow: 0 24px 58px rgba(20,17,13,0.28);
          backdrop-filter: blur(12px);
        }
        .global-lead-search-label {
          color: var(--brass);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          white-space: nowrap;
          margin-bottom: 7px;
        }
        @media (max-width: 767px) {
          .global-lead-search {
            top: calc(9px + env(safe-area-inset-top));
            right: 12px;
          }
          .global-lead-search-trigger {
            width: 40px;
            height: 40px;
            background: rgba(20,17,13,0.94);
            color: var(--bone);
            border-color: rgba(201,168,120,0.34);
          }
          .global-lead-search-panel {
            position: fixed;
            top: calc(58px + env(safe-area-inset-top));
            left: 12px;
            right: 12px;
            width: auto;
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
