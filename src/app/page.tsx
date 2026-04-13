"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError("Please select your name."); return; }
    if (!code) { setError("Please enter your password."); return; }
    setLoading(true);
    setError("");

    if (!supabase) {
      // Fallback if no Supabase — use old hardcoded code
      if (code !== "meridian2026") { setError("Invalid password."); setLoading(false); return; }
      localStorage.setItem("meridian_user", name);
      router.push("/surveys");
      return;
    }

    // Check password against DB
    const { data, error: dbErr } = await supabase
      .from("meridian_members")
      .select("password, password_changed")
      .eq("name", name)
      .single();

    if (dbErr || !data) {
      setError("Could not verify. Try again.");
      setLoading(false);
      return;
    }

    if (data.password !== code) {
      setError("Invalid password.");
      setLoading(false);
      return;
    }

    // Password is correct
    if (!data.password_changed) {
      // First login — prompt to set personal password
      setShowSetPassword(true);
      setLoading(false);
      return;
    }

    // Returning user — go straight in
    localStorage.setItem("meridian_user", name);
    router.push("/surveys");
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (newPassword === "meridian2026") { setError("Please choose a different password than the default."); return; }
    setLoading(true);
    setError("");

    if (!supabase) { setError("Database not available."); setLoading(false); return; }

    const { error: updateErr } = await supabase
      .from("meridian_members")
      .update({ password: newPassword, password_changed: true })
      .eq("name", name);

    if (updateErr) {
      setError("Could not save password. Try again.");
      setLoading(false);
      return;
    }

    localStorage.setItem("meridian_user", name);
    router.push("/surveys");
  };

  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)",
    borderRadius: 8, padding: "12px 16px", fontSize: 15, width: "100%",
  };

  if (showSetPassword) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>◆</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Set Your Password</h1>
          <p style={{ color: "var(--muted)", marginBottom: 8, fontSize: 14 }}>
            Welcome, <span style={{ color: "var(--gold)" }}>{name}</span>
          </p>
          <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 13 }}>
            Create a personal password so only you can access your account.
          </p>

          <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError(""); }}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
              style={inputStyle}
            />

            {error && <p style={{ color: "#e55", fontSize: 13 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "var(--gold)", color: "var(--bg)", border: "none",
                borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 600,
                opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Saving..." : "Set Password & Enter"}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            placeholder="Password"
            value={code}
            onChange={e => { setCode(e.target.value); setError(""); }}
            style={inputStyle}
          />

          {error && <p style={{ color: "#e55", fontSize: 13 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--gold)", color: "var(--bg)", border: "none",
              borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 600,
              opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Signing in..." : "Enter"}
          </button>
        </form>

        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 32 }}>
          View everyone&apos;s answers →{" "}
          <a href="/surveys" style={{ color: "var(--gold)", textDecoration: "none" }}>Surveys</a>
          {" · "}
          <a href="/decisions" style={{ color: "var(--gold)", textDecoration: "none" }}>Decisions</a>
          {" · "}
          <a href="/hub" style={{ color: "var(--gold)", textDecoration: "none" }}>Hub</a>
        </p>
      </div>
    </div>
  );
}
