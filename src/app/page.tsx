"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

// Last name (or full name for single-name members) used for self-service password reset verification
const MEMBER_VERIFICATION: Record<string, string> = {
  "Courtney Mosely": "mosely",
  "Aaliyah Thomas": "thomas",
  "Raquel Twine": "twine",
  "Odessa Patterson": "patterson",
  "Tiffany Stallworth": "stallworth",
  "Peggee": "peggee",
};

export default function LoginPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetName, setResetName] = useState("");
  const [verificationAnswer, setVerificationAnswer] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
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
      router.push("/dashboard");
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

    // Returning user — update last_login and go straight in
    await supabase
      .from("meridian_members")
      .update({ last_login: new Date().toISOString() })
      .eq("name", name);
    localStorage.setItem("meridian_user", name);
    router.push("/dashboard");
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

    // First-time password set — update last_login and go in
    await supabase
      .from("meridian_members")
      .update({ last_login: new Date().toISOString() })
      .eq("name", name);
    localStorage.setItem("meridian_user", name);
    router.push("/dashboard");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetName) { setError("Please select your name."); return; }
    if (!verificationAnswer.trim()) { setError("Please enter your last name."); return; }

    const expected = MEMBER_VERIFICATION[resetName];
    if (!expected || verificationAnswer.trim().toLowerCase() !== expected) {
      setError("That doesn't match our records. Try again.");
      return;
    }

    setLoading(true);
    setError("");

    if (!supabase) { setError("Database not available."); setLoading(false); return; }

    const { error: updateErr } = await supabase
      .from("meridian_members")
      .update({ password: "meridian2026", password_changed: false })
      .eq("name", resetName);

    if (updateErr) {
      setError("Could not reset password. Try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setResetSuccess(true);
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bone)",
    border: "1px solid var(--fog)",
    color: "var(--ink)",
    borderRadius: 4,
    padding: "14px 14px",
    fontSize: 15,
    width: "100%",
    minHeight: 48,
    fontFamily: "var(--font-body)",
  };

  const selectStyle = (hasValue: boolean): React.CSSProperties => ({
    ...inputStyle,
    color: hasValue ? "var(--ink)" : "var(--muted)",
    appearance: "none",
    WebkitAppearance: "none",
  });

  const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
    background: "var(--brass)",
    color: "var(--obsidian)",
    border: "none",
    borderRadius: 4,
    padding: "14px 16px",
    minHeight: 48,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontFamily: "var(--font-body)",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "default" : "pointer",
    transition: "opacity 0.2s, background 0.2s",
  });

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--brass)",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: 44,
    fontWeight: 400,
    letterSpacing: "-0.025em",
    lineHeight: 1.0,
    color: "var(--ink)",
    marginBottom: 8,
  };

  const subheadingStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--muted)",
    lineHeight: 1.6,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bone)",
    border: "1px solid var(--fog)",
    borderRadius: 6,
    padding: "44px 36px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
  };

  const pageWrap: React.CSSProperties = {
    minHeight: "100vh",
    width: "100%",
    background: "var(--obsidian)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    gap: 36,
  };

  const monogramWrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  };

  if (showSetPassword) {
    return (
      <div style={pageWrap}>
        <div style={monogramWrap}>
          <Logo width={120} onDark />
        </div>
        <div style={cardStyle}>
          <p style={{ ...eyebrowStyle, marginBottom: 14 }}>Welcome</p>
          <h1 style={headingStyle}>Set your password</h1>
          <p style={{ ...subheadingStyle, marginBottom: 28 }}>
            <span style={{ color: "var(--brass)", fontWeight: 500 }}>{name}</span>
            {" — "}create a personal password so only you can access your account.
          </p>

          <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

            {error && <p style={{ color: "#A0392E", fontSize: 13, marginTop: 4 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{ ...primaryBtnStyle(loading), marginTop: 6 }}>
              {loading ? "Saving…" : "Set Password & Enter"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    if (resetSuccess) {
      return (
        <div style={pageWrap}>
          <div style={monogramWrap}>
            <Logo width={120} onDark />
          </div>
          <div style={cardStyle}>
            <p style={{ ...eyebrowStyle, marginBottom: 14 }}>Account</p>
            <h1 style={headingStyle}>Password reset</h1>
            <p style={{ ...subheadingStyle, marginBottom: 8 }}>
              Your password has been reset to the default.
            </p>
            <p style={{ ...subheadingStyle, marginBottom: 28 }}>
              Sign in as <span style={{ color: "var(--brass)" }}>{resetName}</span> with{" "}
              <span style={{ color: "var(--brass)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>meridian2026</span>{" "}
              and you&apos;ll be prompted to set a new personal password.
            </p>
            <button
              onClick={() => { setShowForgotPassword(false); setResetSuccess(false); setResetName(""); setVerificationAnswer(""); setName(resetName); }}
              style={primaryBtnStyle(false)}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={pageWrap}>
        <div style={monogramWrap}>
          <Logo width={120} onDark />
        </div>
        <div style={cardStyle}>
          <p style={{ ...eyebrowStyle, marginBottom: 14 }}>Account</p>
          <h1 style={headingStyle}>Reset password</h1>
          <p style={{ ...subheadingStyle, marginBottom: 28 }}>
            Verify your identity and we&apos;ll reset your password to the default.
          </p>

          <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <select
              value={resetName}
              onChange={e => { setResetName(e.target.value); setError(""); }}
              style={selectStyle(!!resetName)}
            >
              <option value="">Select your name</option>
              {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <input
              type="text"
              placeholder="Your last name"
              value={verificationAnswer}
              onChange={e => { setVerificationAnswer(e.target.value); setError(""); }}
              style={inputStyle}
              autoComplete="off"
            />

            {error && <p style={{ color: "#A0392E", fontSize: 13, marginTop: 4 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{ ...primaryBtnStyle(loading), marginTop: 6 }}>
              {loading ? "Verifying…" : "Reset My Password"}
            </button>
          </form>

          <button
            onClick={() => { setShowForgotPassword(false); setError(""); setResetName(""); setVerificationAnswer(""); }}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, marginTop: 20, padding: "10px 16px", cursor: "pointer", fontFamily: "var(--font-body)" }}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={monogramWrap}>
        <Logo width={140} onDark />
      </div>

      <div style={cardStyle}>
        <p style={{ ...eyebrowStyle, marginBottom: 14 }}>Partnership Hub</p>
        <h1 style={headingStyle}>Welcome back</h1>
        <p style={{ ...subheadingStyle, marginBottom: 28 }}>
          Sign in to continue your work with the Collective.
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <select
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
            style={selectStyle(!!name)}
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

          {error && <p style={{ color: "#A0392E", fontSize: 13, marginTop: 4 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...primaryBtnStyle(loading), marginTop: 6 }}>
            {loading ? "Signing in…" : "Enter"}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: "center" }}>
          <button
            onClick={() => { setShowForgotPassword(true); setError(""); setResetName(name); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--brass)",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            Forgot your password?
          </button>
        </p>
      </div>

      <p style={{ ...subheadingStyle, color: "rgba(237,230,214,0.55)", fontSize: 12, textAlign: "center" }}>
        Partnership Transparency Hub · Atlanta · Est. MMXXVI
      </p>
    </div>
  );
}
