"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError("Please select your name."); return; }
    if (code !== "meridian2026") { setError("Invalid access code."); return; }
    localStorage.setItem("meridian_user", name);
    router.push("/survey");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>◆</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.5px" }}>Meridian Collective</h1>
        <p style={{ color: "var(--muted)", marginBottom: 32, fontSize: 14 }}>Partnership Transparency Hub</p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <select
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)", color: name ? "var(--fg)" : "var(--muted)",
              borderRadius: 8, padding: "12px 16px", fontSize: 15, appearance: "none", WebkitAppearance: "none",
            }}
          >
            <option value="">Select your name</option>
            {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <input
            type="password"
            placeholder="Access code"
            value={code}
            onChange={e => { setCode(e.target.value); setError(""); }}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)",
              borderRadius: 8, padding: "12px 16px", fontSize: 15,
            }}
          />

          {error && <p style={{ color: "#e55", fontSize: 13 }}>{error}</p>}

          <button
            type="submit"
            style={{
              background: "var(--gold)", color: "var(--bg)", border: "none",
              borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 600,
              transition: "opacity 0.2s",
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}
          >
            Enter Survey
          </button>
        </form>

        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 32 }}>
          View everyone&apos;s answers →{" "}
          <a href="/results" style={{ color: "var(--gold)", textDecoration: "none" }}>Results</a>
          {" · "}
          <a href="/hub" style={{ color: "var(--gold)", textDecoration: "none" }}>Hub</a>
        </p>
      </div>
    </div>
  );
}
