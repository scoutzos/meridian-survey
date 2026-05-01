"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(localStorage.getItem("meridian_user"));
  }, []);

  if (!user || pathname === "/") return null;

  const links = [
    { href: "/dashboard",  label: "Home" },
    { href: "/deals",      label: "Deals" },
    { href: "/projects",   label: "Projects" },
    { href: "/operations", label: "Ops" },
    { href: "/surveys",    label: "Surveys" },
    { href: "/actions",    label: "Actions" },
    { href: "/meetings",   label: "Meetings" },
    { href: "/members",    label: "Members" },
    { href: "/documents",  label: "Docs" },
    { href: "/decisions",  label: "Decisions" },
    { href: "/tracker",    label: "Tracker" },
    { href: "/hub",        label: "Hub" },
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
      background: "var(--obsidian)",
      borderBottom: "1px solid rgba(201,168,120,0.25)",
      padding: "0 20px", height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, flex: 1, minWidth: 0 }}>
        <Logo width={42} onDark style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => router.push("/dashboard")} />
        <div style={{
          display: "flex", alignItems: "center", gap: 2, overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {links.map(l => {
            const active = isActive(l.href);
            return (
              <button
                key={l.href}
                onClick={() => router.push(l.href)}
                style={{
                  background: "transparent",
                  color: active ? "var(--brass)" : "var(--fog)",
                  border: "none",
                  padding: "8px 12px",
                  fontSize: 11,
                  fontFamily: "var(--font-body)",
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "color 0.15s",
                  borderBottom: active ? "1px solid var(--brass)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          color: "var(--brass)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}>{user}</span>
        <button
          onClick={() => { localStorage.removeItem("meridian_user"); router.push("/"); }}
          style={{
            background: "none", border: "none",
            color: "var(--fog)",
            fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500,
            cursor: "pointer", fontFamily: "var(--font-body)",
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
