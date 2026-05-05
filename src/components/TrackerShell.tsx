"use client";
import { useRouter, usePathname } from "next/navigation";

export const trackerCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
};

export const trackerInput: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  color: "var(--fg)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  fontFamily: "inherit",
};

export const trackerBtn: React.CSSProperties = {
  background: "var(--gold)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

export const trackerBtnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--gold)",
  border: "1px solid var(--gold)",
  borderRadius: 8,
  padding: "9px 17px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

export const trackerBtnSubtle: React.CSSProperties = {
  background: "var(--surface2)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 17px",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};

const TABS = [
  { href: "/tracker",                label: "Dashboard" },
  { href: "/tracker/members",        label: "Members" },
  { href: "/tracker/expenses",       label: "Expenses" },
  { href: "/tracker/planning",       label: "Planning" },
  { href: "/tracker/contributions",  label: "Contributions" },
  { href: "/tracker/capital-calls",  label: "Capital Calls" },
  { href: "/tracker/settings",       label: "Settings" },
];

export default function TrackerShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/tracker" ? pathname === "/tracker" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{title}</h1>
      {subtitle && (
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>{subtitle}</p>
      )}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 20,
          overflowX: "auto",
          paddingBottom: 4,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map(t => {
          const active = isActive(t.href);
          return (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              style={{
                background: active ? "var(--gold)" : "transparent",
                color: active ? "var(--bg)" : "var(--muted)",
                border: "none",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
