"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DISPLAY_FONT = "var(--font-display)";

type DocType = "Working Draft" | "PDF" | "Doc" | "Link";

interface Doc {
  title: string;
  description: string;
  type: DocType;
  href: string | null;          // null when document isn't published yet
  external?: boolean;
  dateAdded: string;            // ISO date
}

const DOCS: Doc[] = [
  {
    title: "Operating Agreement Working Draft",
    description: "Governing document for Meridian Collective LLC. Currently in revision with the LegalShield attorney.",
    type: "Working Draft",
    href: null,
    dateAdded: "2026-03-26",
  },
  {
    title: "Brand Guidelines Vol. I",
    description: "Identity system: palette, typography, logo, and voice for the Meridian Collective brand.",
    type: "PDF",
    href: null,
    dateAdded: "2026-04-12",
  },
  {
    title: "Forms of Contribution Reference",
    description: "Reference doc for cash, property, services, sweat equity, and credit/lending capacity contributions.",
    type: "Doc",
    href: "https://docs.google.com/document/d/1HXFeWkjlERbRDtao0KWqCgy8BC5GjEMNhkPXmXosIEQ/edit?usp=sharing",
    external: true,
    dateAdded: "2026-04-02",
  },
  {
    title: "Meridian Website",
    description: "Public-facing site for the Meridian Collective brand.",
    type: "Link",
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

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "84px 20px 100px" }} className="docs-root">
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
          Reference Library
        </p>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
          Documents
        </h1>
        <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
          The canonical references for the operating agreement, brand, and partnership.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {DOCS.map(d => {
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
        @media (max-width: 600px) {
          .docs-root { padding-top: 28px !important; }
        }
      `}</style>
    </div>
  );
}
