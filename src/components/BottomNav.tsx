"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isVaUser } from "@/lib/identity";

const PRIMARY = [
  { href: "/dashboard",  label: "Home" },
  { href: "/actions",    label: "Tasks" },
  { href: "/deals",      label: "Deals" },
  { href: "/crm",        label: "CRM" },
];

const MORE = [
  { href: "/tracker",    label: "Money" },
  { href: "/operations", label: "Operations" },
  { href: "/projects",   label: "Projects" },
  { href: "/meetings",   label: "Meetings" },
  { href: "/surveys",    label: "Surveys" },
  { href: "/members/candidates", label: "Applications" },
  { href: "/documents",  label: "Documents" },
  { href: "/decisions",  label: "Decisions" },
  { href: "/hub",        label: "Hub" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setUser(localStorage.getItem("meridian_user"));
  }, [pathname]);

  // Close the More sheet whenever the route changes.
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const isActive = (href: string) => {
    const baseHref = href.split("?")[0];
    if (pathname === baseHref) return true;
    if (pathname.startsWith(baseHref + "/")) return true;
    if (baseHref === "/surveys" && (pathname.startsWith("/survey/") || pathname.startsWith("/results/"))) return true;
    if (baseHref === "/deals" && pathname.startsWith("/opportunity")) return true;
    return false;
  };

  if (!user || pathname === "/" || pathname === "/apply") return null;

  if (isVaUser(user)) {
    const vaPrimary = [
      { href: "/va", label: "VA Desk" },
      { href: "/actions?filter=va", label: "Tasks" },
      { href: "/crm?view=records", label: "Records" },
      { href: "/dashboard", label: "Portal" },
    ];
    return (
      <nav className="bottom-nav">
        {vaPrimary.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`bottom-nav-tab${isActive(item.href) ? " bottom-nav-active" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    );
  }

  const moreActive = MORE.some(l => isActive(l.href));

  return (
    <>
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 199,
            background: "rgba(20,17,13,0.55)",
          }}
        />
      )}
      {moreOpen && (
        <div
          style={{
            position: "fixed", left: 12, right: 12,
            bottom: "calc(64px + env(safe-area-inset-bottom))",
            zIndex: 201,
            background: "var(--obsidian)",
            border: "1px solid rgba(201,168,120,0.35)",
            borderRadius: 16,
            padding: 8,
            boxShadow: "0 -8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {MORE.map(l => {
            const active = isActive(l.href);
            return (
              <button
                key={l.href}
                onClick={() => { router.push(l.href); setMoreOpen(false); }}
                style={{
                  display: "block", width: "100%",
                  background: "transparent", border: "none",
                  color: active ? "var(--brass)" : "var(--bone)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14, fontWeight: active ? 600 : 500,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "14px 16px", textAlign: "left",
                  borderRadius: 8,
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      )}

      <nav className="bottom-nav">
        {PRIMARY.map(l => {
          const active = isActive(l.href);
          return (
            <button
              key={l.href}
              onClick={() => router.push(l.href)}
              className={`bottom-nav-tab${active ? " bottom-nav-active" : ""}`}
            >
              {l.label}
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(o => !o)}
          className={`bottom-nav-tab${moreActive || moreOpen ? " bottom-nav-active" : ""}`}
        >
          More
        </button>
      </nav>
    </>
  );
}
