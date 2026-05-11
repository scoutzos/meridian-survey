"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getCurrentMeridianUser, isVaUser, signOutMeridianUser } from "@/lib/identity";
import Logo from "./Logo";

const crmRoutes = ["/crm", "/va"];
const crmLinks = [
  { href: "/dashboard", label: "Member Portal" },
  { href: "/crm", label: "Command Center" },
  { href: "/va", label: "VA Home" },
  { href: "/va?tab=outreach", label: "Lead Inbox" },
  { href: "/va?tab=lists", label: "Lists" },
  { href: "/crm?view=deals", label: "Deal Reviews" },
  { href: "/crm?view=buyers", label: "Buyers" },
  { href: "/crm?view=dispo", label: "Disposition" },
  { href: "/crm?view=records", label: "Records" },
];
const vaLinks = [
  { href: "/dashboard", label: "Member Portal" },
  { href: "/va", label: "VA Home" },
  { href: "/va?tab=outreach", label: "Lead Inbox" },
  { href: "/va?tab=lists", label: "Lists" },
  { href: "/va?tab=packet", label: "Deal Packets" },
  { href: "/va?tab=brief", label: "Daily Brief" },
  { href: "/crm", label: "CRM Command" },
  { href: "/crm?view=records", label: "CRM Records" },
];

const crmCreateButton: CSSProperties = {
  border: "1px solid var(--brass)",
  background: "var(--brass)",
  color: "var(--obsidian)",
  borderRadius: 7,
  padding: "8px 13px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const crmPortalButton: CSSProperties = {
  border: "1px solid var(--fog)",
  background: "var(--surface)",
  color: "var(--obsidian)",
  borderRadius: 7,
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);
  const [crmView, setCrmView] = useState<string | null>(null);
  const [vaTab, setVaTab] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentMeridianUser());
    if (pathname === "/crm") {
      setCrmView(new URLSearchParams(window.location.search).get("view"));
    } else {
      setCrmView(null);
    }
    if (pathname === "/va") {
      setVaTab(new URLSearchParams(window.location.search).get("tab") || "today");
    } else {
      setVaTab(null);
    }
  }, [pathname]);

  const crmShell = !!user && crmRoutes.some(route => pathname === route || pathname.startsWith(route + "/"));
  const handleSignOut = async () => {
    await signOutMeridianUser();
    router.push("/");
  };

  useEffect(() => {
    document.body.classList.toggle("crm-shell-active", crmShell);
    return () => document.body.classList.remove("crm-shell-active");
  }, [crmShell]);

  if (!user || pathname === "/" || pathname === "/apply") return null;

  const memberLinks = [
    { href: "/dashboard",  label: "Home" },
    { href: "/actions",    label: "Tasks" },
    { href: "/deals",      label: "Deal Reviews" },
    { href: "/crm",        label: "CRM" },
    { href: "/tracker",    label: "Money" },
    { href: "/operations", label: "Operations" },
    { href: "/projects",   label: "Projects" },
  ];
  const secondaryMemberLinks = [
    { href: "/documents",  label: "Docs" },
    { href: "/meetings",   label: "Meetings" },
    { href: "/dashboard",  label: "My Portal" },
    { href: "/members/candidates", label: "Applications" },
    { href: "/decisions",  label: "Decisions" },
    { href: "/surveys",    label: "Surveys" },
    { href: "/hub",        label: "Hub" },
  ];
  const mainVaLinks = [
    { href: "/va", label: "VA Desk" },
    { href: "/crm", label: "CRM" },
  ];
  const links = isVaUser(user) ? mainVaLinks : memberLinks;

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (pathname.startsWith(href + "/")) return true;
    if (href === "/surveys" && (pathname.startsWith("/survey/") || pathname.startsWith("/results/"))) return true;
    if (href === "/deals" && pathname.startsWith("/opportunity")) return true;
    return false;
  };

  if (crmShell) {
    return (
      <>
        <aside className="crm-side-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Logo width={38} onDark />
            <div>
              <strong style={{ display: "block", color: "var(--bone)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>Meridian</strong>
              <span style={{ display: "block", color: "var(--brass)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>CRM</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {(isVaUser(user) ? vaLinks : crmLinks).map(link => {
              const baseHref = link.href.split("?")[0];
              const linkView = new URLSearchParams(link.href.split("?")[1] ?? "").get("view");
              const linkTab = new URLSearchParams(link.href.split("?")[1] ?? "").get("tab") || (baseHref === "/va" ? "today" : null);
              const active = link.href === "/crm"
                ? pathname === "/crm" && !crmView
                : linkView
                  ? pathname === "/crm" && crmView === linkView
                  : linkTab
                    ? pathname === "/va" && vaTab === linkTab
                  : pathname === baseHref || pathname.startsWith(baseHref + "/");
              return (
                <button
                  key={link.href}
                  onClick={() => {
                    setCrmView(linkView);
                    setVaTab(linkTab);
                    if (linkTab) window.dispatchEvent(new CustomEvent("meridian-va-tab", { detail: linkTab }));
                    router.push(link.href);
                  }}
                  className={active ? "crm-side-link crm-side-link-active" : "crm-side-link"}
                >
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: "auto", border: "1px solid rgba(214,205,183,0.18)", borderRadius: 8, padding: 10 }}>
            <span style={{ display: "block", color: "rgba(237,230,214,0.62)", fontSize: 10, marginBottom: 4 }}>Signed in</span>
            <strong style={{ display: "block", color: "var(--bone)", fontSize: 12 }}>{user}</strong>
            <button
              onClick={handleSignOut}
              style={{ marginTop: 8, background: "transparent", border: "none", color: "var(--brass)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em" }}
            >
              Sign out
            </button>
          </div>
        </aside>
        <nav className="crm-top-bar">
          <button onClick={() => router.push("/dashboard")} style={crmPortalButton}>Member Portal</button>
          <button onClick={() => router.push(isVaUser(user) ? "/va?tab=packet" : "/va")} style={crmCreateButton}>{isVaUser(user) ? "+ Deal Brief" : "+ Create"}</button>
          <span style={{ color: "var(--fog)", fontSize: 12 }}>●</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 999, background: "var(--obsidian)", color: "var(--bone)", fontSize: 11 }}>{user.split(/\s+/).map(part => part[0]).join("").slice(0, 2)}</span>
            <span style={{ color: "var(--ink)", fontSize: 12 }}>{user}</span>
          </div>
        </nav>
      </>
    );
  }

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
        <Logo width={42} onDark style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => router.push(isVaUser(user) ? "/va" : "/dashboard")} />
        {!isVaUser(user) && (
          <div style={{ display: "grid", lineHeight: 1.05, flexShrink: 0 }}>
            <strong style={{ color: "var(--bone)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>Member</strong>
            <span style={{ color: "var(--brass)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>Portal</span>
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 2, overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {links.map(l => {
            const active = isActive(l.href);
            return (
              <button
                key={l.href}
                onClick={() => {
                  setMoreOpen(false);
                  router.push(l.href);
                }}
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
          {!isVaUser(user) && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setMoreOpen(open => !open)}
                style={{
                  background: moreOpen ? "rgba(201,168,120,0.16)" : "transparent",
                  color: moreOpen || secondaryMemberLinks.some(l => isActive(l.href)) ? "var(--brass)" : "var(--fog)",
                  border: "1px solid rgba(214,205,183,0.18)",
                  borderRadius: 7,
                  padding: "8px 12px",
                  fontSize: 11,
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                More
              </button>
              {moreOpen && (
                <div style={{
                  position: "absolute",
                  top: 38,
                  right: 0,
                  minWidth: 210,
                  background: "var(--obsidian)",
                  border: "1px solid rgba(201,168,120,0.32)",
                  borderRadius: 10,
                  padding: 8,
                  boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
                  display: "grid",
                  gap: 2,
                }}>
                  {secondaryMemberLinks.map(l => {
                    const active = isActive(l.href);
                    return (
                      <button
                        key={l.href}
                        onClick={() => {
                          setMoreOpen(false);
                          router.push(l.href);
                        }}
                        style={{
                          background: active ? "rgba(201,168,120,0.16)" : "transparent",
                          color: active ? "var(--brass)" : "var(--fog)",
                          border: "none",
                          borderRadius: 7,
                          padding: "10px 11px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: active ? 700 : 600,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {!isVaUser(user) && (
          <button onClick={() => router.push("/va")} style={crmCreateButton}>
            New Deal Brief
          </button>
        )}
        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          color: "var(--brass)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}>{user}</span>
        <button
          onClick={handleSignOut}
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
