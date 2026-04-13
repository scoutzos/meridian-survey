"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(localStorage.getItem("meridian_user"));
  }, []);

  if (!user || pathname === "/") return null;

  const links = [
    { href: "/surveys", label: "Surveys" },
    { href: "/decisions", label: "Decisions" },
    { href: "/hub", label: "Hub" },
  ];

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (pathname.startsWith(href + "/")) return true;
    if (href === "/surveys" && (pathname.startsWith("/survey/") || pathname.startsWith("/results/"))) return true;
    return false;
  };

  return (
    <nav className="top-nav-bar" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "var(--bg)", borderBottom: "1px solid var(--border)",
      padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "var(--gold)", fontSize: 18, marginRight: 8 }}>◆</span>
        {links.map(l => {
          const active = isActive(l.href);
          return (
            <button
              key={l.href}
              onClick={() => router.push(l.href)}
              style={{
                background: active ? "var(--gold)" : "transparent",
                color: active ? "var(--bg)" : "var(--muted)",
                border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 13,
                fontWeight: active ? 600 : 400, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--gold)" }}>{user}</span>
        <button
          onClick={() => { localStorage.removeItem("meridian_user"); router.push("/"); }}
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
