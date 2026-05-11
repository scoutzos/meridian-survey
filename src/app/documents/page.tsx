"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DISPLAY_FONT = "var(--font-display)";

type DocType = "Working Draft" | "PDF" | "Doc" | "Link";
type DocCategory = "Governance" | "Money" | "Brand" | "Platform";

interface Doc {
  title: string;
  description: string;
  type: DocType;
  category: DocCategory;
  href: string | null;          // null when document isn't published yet
  external?: boolean;
  dateAdded: string;            // ISO date
}

const DOC_FILTERS: Array<DocCategory | "All"> = ["All", "Governance", "Money", "Brand", "Platform"];

const DOCS: Doc[] = [
  {
    title: "Member And VA Onboarding Guide",
    description: "Launch-week guide for what each role does, where work belongs, VA daily brief expectations, CRM rules, and escalation paths.",
    type: "Doc",
    category: "Platform",
    href: "/docs/meridian-member-va-onboarding-guide.md",
    dateAdded: "2026-05-11",
  },
  {
    title: "Production QA Runbook",
    description: "Pass/fail checklist for live Supabase, Vercel, Sakari, VA, member, CRM, disposition, and permission testing.",
    type: "Doc",
    category: "Platform",
    href: "/docs/production-qa-runbook.md",
    dateAdded: "2026-05-11",
  },
  {
    title: "Supabase Auth Cutover Runbook",
    description: "Step-by-step path for migrating members and the VA from prototype login to Supabase Auth without breaking work routing.",
    type: "Doc",
    category: "Platform",
    href: "/docs/supabase-auth-cutover-runbook.md",
    dateAdded: "2026-05-11",
  },
  {
    title: "Operating Agreement Working Draft",
    description: "Governing document for Meridian Collective LLC. Currently in revision with the LegalShield attorney.",
    type: "Working Draft",
    category: "Governance",
    href: null,
    dateAdded: "2026-03-26",
  },
  {
    title: "Brand Guidelines Vol. I",
    description: "Identity system: palette, typography, logo, and voice for the Meridian Collective brand.",
    type: "PDF",
    category: "Brand",
    href: null,
    dateAdded: "2026-04-12",
  },
  {
    title: "Forms of Contribution Reference",
    description: "Reference doc for cash, property, services, sweat equity, and credit/lending capacity contributions.",
    type: "Doc",
    category: "Money",
    href: "https://docs.google.com/document/d/1HXFeWkjlERbRDtao0KWqCgy8BC5GjEMNhkPXmXosIEQ/edit?usp=sharing",
    external: true,
    dateAdded: "2026-04-02",
  },
  {
    title: "Meridian Website",
    description: "Public-facing site for the Meridian Collective brand.",
    type: "Link",
    category: "Platform",
    href: "https://meridian-website-red.vercel.app",
    external: true,
    dateAdded: "2026-04-20",
  },
];

const TYPE_COLORS: Record<DocType, { bg: string; color: string }> = {
  "Working Draft": { bg: "rgba(201,168,120,0.18)", color: "var(--gold-dim)" },
  "PDF":           { bg: "rgba(20,17,13,0.85)",    color: "var(--bone)" },
  "Doc":           { bg: "var(--fog)",             color: "var(--obsidian)" },
  "Link":          { bg: "var(--brass)",           color: "var(--obsidian)" },
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocCategory | "All">("All");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const filteredDocs = filter === "All" ? DOCS : DOCS.filter(doc => doc.category === filter);
  const countFor = (category: DocCategory | "All") =>
    category === "All" ? DOCS.length : DOCS.filter(doc => doc.category === category).length;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "84px 20px 100px" }} className="docs-root">
      <header className="docs-header">
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
            Member Portal
          </p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            Document Library
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14, maxWidth: 640, lineHeight: 1.6 }}>
            Operating agreements, contribution references, meeting artifacts, project records, and source links live here so members know which file is the source of truth.
          </p>
        </div>
      </header>

      <section className="bridge-grid">
        <button onClick={() => router.push("/meetings")} className="bridge-card">
          <span>Meetings</span>
          <strong>Notes, transcripts, and action extraction</strong>
        </button>
        <button onClick={() => router.push("/decisions")} className="bridge-card">
          <span>Decisions</span>
          <strong>Member votes and operating decisions</strong>
        </button>
        <button onClick={() => router.push("/projects")} className="bridge-card">
          <span>Projects</span>
          <strong>Records tied to renovation and execution</strong>
        </button>
        <button onClick={() => router.push("/crm?view=records")} className="bridge-card">
          <span>CRM Records</span>
          <strong>Deal packets, seller history, and buyer offers</strong>
        </button>
      </section>

      <nav className="doc-filters" aria-label="Document filters">
        {DOC_FILTERS.map(category => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={filter === category ? "filter-chip active" : "filter-chip"}
          >
            {category}
            <span>{countFor(category)}</span>
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredDocs.map(d => {
          const colors = TYPE_COLORS[d.type];
          const onClick = d.href
            ? () => { if (d.external) window.open(d.href!, "_blank", "noopener"); else router.push(d.href!); }
            : undefined;
          return (
            <article
              key={d.title}
              onClick={onClick}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--fog)",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                cursor: d.href ? "pointer" : "default",
                transition: "border-color 0.15s",
              }}
              onMouseOver={e => { if (d.href) e.currentTarget.style.borderColor = "var(--brass)"; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "var(--fog)"; }}
            >
              <span style={{
                background: colors.bg, color: colors.color,
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                textTransform: "uppercase", padding: "4px 10px", borderRadius: 4,
                whiteSpace: "nowrap", flexShrink: 0, alignSelf: "flex-start",
              }}>
                {d.type}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <h2 style={{
                    fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 500,
                    color: "var(--obsidian)", lineHeight: 1.2,
                  }}>
                    {d.title}
                  </h2>
                  <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.55, whiteSpace: "nowrap", paddingTop: 4 }}>
                    Added {formatDate(d.dateAdded)}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.75, lineHeight: 1.55, marginTop: 6 }}>
                  {d.description}
                </p>
                <p style={{ fontSize: 11, color: "var(--ink)", opacity: 0.55, marginTop: 8 }}>
                  {d.category} record
                </p>
                <p style={{ fontSize: 11, color: "var(--brass)", fontWeight: 600, marginTop: 8, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  {d.href
                    ? (d.external ? "Open in new tab ↗" : "Open →")
                    : "Coming soon"}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <style jsx>{`
        .docs-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 22px;
        }
        .docs-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .bridge-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .bridge-card {
          appearance: none;
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          min-height: 120px;
        }
        .bridge-card span,
        .filter-chip {
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .bridge-card span {
          color: var(--brass);
          display: block;
          margin-bottom: 14px;
        }
        .bridge-card strong {
          color: var(--obsidian);
          display: block;
          font-size: 15px;
          line-height: 1.35;
        }
        .doc-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .filter-chip {
          border: 1px solid var(--fog);
          background: var(--surface);
          color: var(--ink);
          border-radius: 999px;
          padding: 8px 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }
        .filter-chip span {
          font-size: 11px;
          letter-spacing: 0;
          background: var(--bone);
          border: 1px solid var(--fog);
          border-radius: 999px;
          padding: 1px 7px;
        }
        .filter-chip.active {
          background: var(--obsidian);
          border-color: var(--obsidian);
          color: var(--bone);
        }
        .filter-chip.active span {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.18);
          color: var(--bone);
        }
        @media (max-width: 900px) {
          .docs-header { flex-direction: column; }
          .bridge-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .docs-root { padding-top: 28px !important; }
          .bridge-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
