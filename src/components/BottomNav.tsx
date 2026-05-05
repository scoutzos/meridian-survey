"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PRIMARY = [
  { href: "/dashboard",  label: "Home" },
  { href: "/tracker",    label: "Money" },
  { href: "/deals",      label: "Deals" },
  { href: "/projects",   label: "Projects" },
];

const MORE = [
  { href: "/actions",    label: "Actions" },
  { href: "/operations", label: "Operations" },
  { href: "/meetings",   label: "Meetings" },
  { href: "/surveys",    label: "Surveys" },
  { href: "/members",    label: "Members" },
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
  }, []);

  // Close the More sheet whenever the route changes.
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (!user || pathname === "/") return null;

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (pathname.startsWith(href + "/")) return true;
    if (href === "/surveys" && (pathname.startsWith("/survey/") || pathname.startsWith("/results/"))) return true;
    return false;
  };

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
