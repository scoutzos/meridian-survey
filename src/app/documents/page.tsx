"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DISPLAY_FONT = "var(--font-display)";
const QA_STORAGE_KEY = "meridian_launch_qa_tracker";

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

const QA_CHECKS = [
  { id: "access", label: "Access and identity", detail: "Member and VA login route correctly; sign out clears session/local identity." },
  { id: "import", label: "VA import to lead work", detail: "CSV import, search, lead status, activity history, bad number/DNC visibility." },
  { id: "sms", label: "Sakari SMS", detail: "Inbound matching, unmatched inbox, single send, bulk send, opt-out protection, conversation panel." },
  { id: "brief", label: "VA daily brief", detail: "Clock-in, completed VA tasks, activity metrics, submission, member review." },
  { id: "deal", label: "Deal packet and member vote", detail: "Lead conversion, calculator, vote tasks, agreement, diligence, project gates." },
  { id: "crm", label: "CRM and disposition", detail: "Record panels, edit flows, offer decision tasks, accepted/rejected handoff." },
  { id: "tasks", label: "Member tasks and VA assignment", detail: "Member assigns VA task, VA starts/completes/blocks, task history and notifications update." },
  { id: "money", label: "Money, projects, documents, meetings", detail: "Capital calls, reimbursements, inherited project context, canonical docs, meeting records." },
  { id: "rls", label: "RLS and permissions", detail: "VA/member access limits work under real Supabase Auth without prototype anon reliance." },
  { id: "launch", label: "Launch decision", detail: "No build, SQL, RLS, duplicate/orphan, import-to-review, or disposition blockers remain." },
] as const;

type QaStatus = "untested" | "pass" | "fail";
type QaState = Record<string, QaStatus>;

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocCategory | "All">("All");
  const [qaState, setQaState] = useState<QaState>({});
  const [qaNotes, setQaNotes] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    try {
      const saved = JSON.parse(localStorage.getItem(QA_STORAGE_KEY) || "{}") as { checks?: QaState; notes?: string };
      setQaState(saved.checks ?? {});
      setQaNotes(saved.notes ?? "");
    } catch {
      setQaState({});
      setQaNotes("");
    }
  }, [router]);

  if (!user) return null;

  const filteredDocs = filter === "All" ? DOCS : DOCS.filter(doc => doc.category === filter);
  const countFor = (category: DocCategory | "All") =>
    category === "All" ? DOCS.length : DOCS.filter(doc => doc.category === category).length;
  const qaCounts = QA_CHECKS.reduce((acc, check) => {
    const status = qaState[check.id] ?? "untested";
    acc[status] += 1;
    return acc;
  }, { pass: 0, fail: 0, untested: 0 });
  const setQa = (id: string, status: QaStatus) => {
    const next = { ...qaState, [id]: status };
    setQaState(next);
    localStorage.setItem(QA_STORAGE_KEY, JSON.stringify({ checks: next, notes: qaNotes }));
  };
  const updateQaNotes = (value: string) => {
    setQaNotes(value);
    localStorage.setItem(QA_STORAGE_KEY, JSON.stringify({ checks: qaState, notes: value }));
  };

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

      <section className="qa-panel" aria-label="Launch QA tracker">
        <div className="qa-header">
          <div>
            <p className="qa-eyebrow">Production QA</p>
            <h2>Launch Readiness Tracker</h2>
            <p>Use this during the live Vercel/Supabase/Sakari walkthrough. The full runbook remains the source of truth.</p>
          </div>
          <button onClick={() => router.push("/docs/production-qa-runbook.md")} className="qa-open">Open Runbook</button>
        </div>
        <div className="qa-stats">
          <span>{qaCounts.pass} passed</span>
          <span>{qaCounts.fail} failed</span>
          <span>{qaCounts.untested} untested</span>
        </div>
        <div className="qa-checks">
          {QA_CHECKS.map(check => {
            const status = qaState[check.id] ?? "untested";
            return (
              <article key={check.id} className={`qa-check ${status}`}>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <div className="qa-buttons">
                  <button onClick={() => setQa(check.id, "pass")} className={status === "pass" ? "selected" : ""}>Pass</button>
                  <button onClick={() => setQa(check.id, "fail")} className={status === "fail" ? "selected fail" : ""}>Fail</button>
                  <button onClick={() => setQa(check.id, "untested")} className={status === "untested" ? "selected muted" : ""}>Reset</button>
                </div>
              </article>
            );
          })}
        </div>
        <textarea
          value={qaNotes}
          onChange={event => updateQaNotes(event.target.value)}
          placeholder="Launch QA notes, blockers, test numbers, Supabase errors, or follow-up fixes."
          className="qa-notes"
          rows={4}
        />
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
        .qa-panel {
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 20px;
        }
        .qa-header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .qa-eyebrow {
          color: var(--brass);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .qa-header h2 {
          color: var(--obsidian);
          font-family: ${DISPLAY_FONT};
          font-size: 24px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .qa-header p {
          color: var(--ink);
          font-size: 13px;
          line-height: 1.5;
          opacity: 0.68;
        }
        .qa-open {
          background: var(--obsidian);
          border: none;
          border-radius: 8px;
          color: var(--bone);
          cursor: pointer;
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          padding: 10px 12px;
          text-transform: uppercase;
        }
        .qa-stats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .qa-stats span {
          background: var(--bone);
          border: 1px solid var(--fog);
          border-radius: 999px;
          color: var(--ink);
          font-size: 11px;
          font-weight: 700;
          padding: 5px 10px;
        }
        .qa-checks {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .qa-check {
          background: var(--bone);
          border: 1px solid var(--fog);
          border-radius: 10px;
          display: grid;
          gap: 10px;
          padding: 12px;
        }
        .qa-check.pass { border-color: rgba(47,125,76,0.35); background: rgba(47,125,76,0.07); }
        .qa-check.fail { border-color: rgba(122,51,36,0.36); background: rgba(122,51,36,0.06); }
        .qa-check strong {
          color: var(--obsidian);
          font-size: 13px;
        }
        .qa-check p {
          color: var(--ink);
          font-size: 12px;
          line-height: 1.45;
          margin-top: 4px;
          opacity: 0.66;
        }
        .qa-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .qa-buttons button {
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 6px;
          color: var(--ink);
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          padding: 7px 9px;
          text-transform: uppercase;
        }
        .qa-buttons button.selected {
          background: var(--brass);
          border-color: var(--brass);
          color: var(--obsidian);
        }
        .qa-buttons button.selected.fail {
          background: var(--obsidian);
          border-color: var(--obsidian);
          color: var(--bone);
        }
        .qa-buttons button.selected.muted {
          background: var(--fog);
          border-color: var(--fog);
        }
        .qa-notes {
          background: var(--bone);
          border: 1px solid var(--fog);
          border-radius: 10px;
          color: var(--ink);
          font: inherit;
          margin-top: 12px;
          padding: 12px;
          resize: vertical;
          width: 100%;
        }
        @media (max-width: 900px) {
          .docs-header { flex-direction: column; }
          .bridge-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .qa-checks { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .docs-root { padding-top: 28px !important; }
          .bridge-grid { grid-template-columns: 1fr; }
          .qa-header { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
