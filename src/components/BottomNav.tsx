"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/survey", label: "Survey" },
  { href: "/results", label: "Results" },
  { href: "/decisions", label: "Decisions" },
  { href: "/hub", label: "Hub" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(localStorage.getItem("meridian_user"));
  }, []);

  if (!user || pathname === "/") return null;

  return (
    <nav className="bottom-nav">
      {links.map(l => {
        const active = pathname === l.href;
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
    </nav>
  );
}
