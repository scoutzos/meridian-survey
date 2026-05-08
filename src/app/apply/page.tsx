"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import { createMembershipCandidate, parseMoney, type CandidateDraft } from "@/lib/membership-candidates";

const joinOptions = [
  "As an individual",
  "Through my LLC",
  "I'm not sure yet",
];

const participationOptions = [
  "Yes, I'm ready to participate consistently",
  "Yes, but my availability may vary",
  "I want to be involved but cannot commit consistently right now",
  "I'm still deciding",
];

const readinessOptions = [
  "Immediately",
  "Within 1 week",
  "Within 2 weeks",
  "Within 30 days",
  "More than 30 days",
  "It depends on the deal",
];

const creditPullOptions = [
  "Yes, no concerns",
  "Yes, but I want notice first",
  "I have concerns and want to discuss first",
  "No, not right now",
];

const monthlyDuesOptions = [
  "Yes, I am comfortable with monthly dues",
  "Maybe, but I would want to review the budget first",
  "No, I am not comfortable with monthly dues right now",
];

export default function ApplyPage() {
  const [submittedName, setSubmittedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    contact_email: "",
    contact_phone: "",
    join_as: joinOptions[0],
    entity_name: "",
    entity_state: "",
    entity_title: "",
    participation: participationOptions[0],
    max_deal_contribution: "",
    cash_available: "",
    credit_available: "",
    monthly_dues_comfort: monthlyDuesOptions[0],
    monthly_dues_max: "",
    deal_readiness: readinessOptions[0],
    credit_pull_comfort: creditPullOptions[0],
    table_contribution: "",
    relationships: "",
    first_90_days: "",
    support_requested: "",
    member_notes: "",
  });

  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.full_name.trim()) { setError("Please enter your full legal name."); return; }
    if (!form.table_contribution.trim()) { setError("Please share what you bring to the table."); return; }
    setSaving(true);

    const draft: CandidateDraft = {
      full_name: form.full_name.trim(),
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      join_as: form.join_as,
      entity_name: form.entity_name,
      entity_state: form.entity_state,
      entity_title: form.entity_title,
      participation: form.participation,
      max_deal_contribution: parseMoney(form.max_deal_contribution),
      cash_available: parseMoney(form.cash_available),
      credit_available: parseMoney(form.credit_available),
      monthly_dues_comfort: form.monthly_dues_comfort,
      monthly_dues_max: parseMoney(form.monthly_dues_max),
      deal_readiness: form.deal_readiness,
      credit_pull_comfort: form.credit_pull_comfort,
      table_contribution: form.table_contribution,
      relationships: form.relationships,
      first_90_days: form.first_90_days,
      support_requested: form.support_requested,
      member_notes: form.member_notes,
    };

    const result = await createMembershipCandidate(draft);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSubmittedName(form.full_name.trim());
  }

  if (submittedName) {
    return (
      <main style={pageStyle}>
        <section style={successCard}>
          <Logo width={84} />
          <p style={eyebrow}>Submitted</p>
          <h1 style={heading}>Thank you, {submittedName.split(" ")[0]}</h1>
          <p style={mutedText}>
            Your membership readiness review has been sent to current Meridian members for review and voting.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={submit} style={formCard}>
        <Logo width={74} />
        <div>
          <p style={eyebrow}>Meridian Collective</p>
          <h1 style={heading}>Membership Readiness & Contribution Review</h1>
          <p style={mutedText}>
            Meridian reviews potential members based on readiness, participation, capital capacity, credit access,
            business resources, relationships, and what each person can bring to the group. Your responses may be
            summarized for current members to review and vote on.
          </p>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <Section title="Who Are You?">
          <Field label="Full legal name" value={form.full_name} onChange={v => update("full_name", v)} required />
          <div className="apply-grid">
            <Field label="Email" value={form.contact_email} onChange={v => update("contact_email", v)} />
            <Field label="Phone" value={form.contact_phone} onChange={v => update("contact_phone", v)} />
          </div>
          <Select label="Are you seeking to join as an individual or through your own LLC?" value={form.join_as} options={joinOptions} onChange={v => update("join_as", v)} />
          {form.join_as === "Through my LLC" && (
            <div className="apply-grid">
              <Field label="Legal entity name" value={form.entity_name} onChange={v => update("entity_name", v)} />
              <Field label="State formed" value={form.entity_state} onChange={v => update("entity_state", v)} />
              <Field label="Your title" value={form.entity_title} onChange={v => update("entity_title", v)} />
            </div>
          )}
        </Section>

        <Section title="Readiness">
          <Select label="Are you committed to actively participating in Meridian business?" value={form.participation} options={participationOptions} onChange={v => update("participation", v)} />
          <div className="apply-grid">
            <Field label="Most you could contribute to a single deal, between cash and credit" value={form.max_deal_contribution} onChange={v => update("max_deal_contribution", v)} placeholder="$10,000" />
            <Field label="How much of that is cash?" value={form.cash_available} onChange={v => update("cash_available", v)} placeholder="$5,000" />
            <Field label="How much is available credit?" value={form.credit_available} onChange={v => update("credit_available", v)} placeholder="$15,000" />
          </div>
          <div className="apply-grid">
            <Select label="Would you be comfortable paying monthly dues for shared operating costs like VA support, software, call tools, and admin?" value={form.monthly_dues_comfort} options={monthlyDuesOptions} onChange={v => update("monthly_dues_comfort", v)} />
            <Field label="If yes, what is the most you would be comfortable paying per month?" value={form.monthly_dues_max} onChange={v => update("monthly_dues_max", v)} placeholder="$250" />
          </div>
          <Select label="If the group found a deal tomorrow, how quickly could you have your contribution ready?" value={form.deal_readiness} options={readinessOptions} onChange={v => update("deal_readiness", v)} />
          <Select label="Are you comfortable with a lender pulling your credit if required for financing?" value={form.credit_pull_comfort} options={creditPullOptions} onChange={v => update("credit_pull_comfort", v)} />
        </Section>

        <Section title="What Do You Bring?">
          <TextArea label="What else do you bring to the table besides money?" value={form.table_contribution} onChange={v => update("table_contribution", v)} required />
          <TextArea label="Do you have relationships or resources that could help Meridian find, fund, renovate, manage, or sell deals?" value={form.relationships} onChange={v => update("relationships", v)} />
          <TextArea label="What would you be able to contribute in your first 90 days?" value={form.first_90_days} onChange={v => update("first_90_days", v)} />
          <TextArea label="What support would you be looking for from Meridian Collective?" value={form.support_requested} onChange={v => update("support_requested", v)} />
          <TextArea label="Is there anything current members should know before voting on your membership?" value={form.member_notes} onChange={v => update("member_notes", v)} />
        </Section>

        <button disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Submitting..." : "Submit for Member Review"}
        </button>
      </form>
      <style jsx>{`
        .apply-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 14px;
        }
      `}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 14, borderTop: "1px solid var(--fog)", paddingTop: 22 }}>
      <h2 style={{ fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--obsidian)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label style={labelStyle}>
      {label}
      <input required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label style={labelStyle}>
      {label}
      <textarea required={required} value={value} onChange={e => onChange(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
    </label>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--obsidian)",
  padding: "56px 18px 90px",
};

const formCard: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  background: "var(--bone)",
  border: "1px solid rgba(201,168,120,0.35)",
  borderRadius: 8,
  padding: "34px",
  display: "grid",
  gap: 28,
};

const successCard: React.CSSProperties = {
  ...formCard,
  maxWidth: 560,
  textAlign: "center",
  justifyItems: "center",
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--brass)",
  marginBottom: 8,
};

const heading: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(34px, 6vw, 54px)",
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--obsidian)",
  marginBottom: 12,
};

const mutedText: React.CSSProperties = {
  color: "var(--ink)",
  opacity: 0.68,
  fontSize: 14,
  lineHeight: 1.7,
  maxWidth: 760,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 650,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  background: "#fffaf0",
  color: "var(--ink)",
  padding: "13px 12px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};

const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "none",
  borderRadius: 6,
  minHeight: 52,
  padding: "14px 18px",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "rgba(122,41,53,0.08)",
  border: "1px solid rgba(122,41,53,0.35)",
  color: "#7a2935",
  borderRadius: 6,
  padding: 12,
  fontSize: 13,
};
