"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import BuildDealAnalysisPanel from "@/components/BuildDealAnalysisPanel";
import DealAiAnalysisPanel from "@/components/DealAiAnalysisPanel";
import { createActionItem } from "@/lib/action-items";
import type { DealAiAnalysisResult } from "@/lib/deal-ai";
import {
  buildDealDraftFromIntake,
  moneyToNumber,
  type DealIntakeInput,
  type DealIntakeMatch,
} from "@/lib/deal-intake";
import {
  calculateDealAnalysis,
  createDeal,
  createDealActivity,
  type Deal,
  type DealInput,
  type DealPropertyType,
  type DealUrgency,
} from "@/lib/deals";
import { getCurrentMeridianUser, isVaUser } from "@/lib/identity";
import {
  createImportedLandLeadActivity,
  fetchImportedLandLeads,
  leadToDealDraft,
  updateImportedLandLeadStatus,
  type ImportedLandLead,
} from "@/lib/land-leads";
import { fetchActiveMemberNames } from "@/lib/members";
import { createNotification } from "@/lib/operations";

type IntakeForm = {
  query: string;
  property_type: DealPropertyType;
  address: string;
  parcel_id: string;
  seller_name: string;
  seller_phone: string;
  listing_url: string;
  asking_price: string;
  acreage: string;
  target_resale_price: string;
  exit_strategy: string;
  target_buyer_type: string;
  buyer_demand_evidence: string;
  notes: string;
  urgency: DealUrgency;
};

const EMPTY_FORM: IntakeForm = {
  query: "",
  property_type: "land",
  address: "",
  parcel_id: "",
  seller_name: "",
  seller_phone: "",
  listing_url: "",
  asking_price: "",
  acreage: "",
  target_resale_price: "",
  exit_strategy: "Build new construction and sell; wholesale or assignment as backup if build risk does not clear",
  target_buyer_type: "Retail new-build buyer / builder investor backup",
  buyer_demand_evidence: "",
  notes: "",
  urgency: "routine",
};

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatAcreage(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`;
}

function mergeText(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  return parts
    .flatMap(part => String(part || "").split(/\n{2,}/g))
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n");
}

function compactLocation(match: DealIntakeMatch): string {
  return [match.city, match.county, match.state].filter(Boolean).join(", ") || "Location pending";
}

function confidenceLabel(match: DealIntakeMatch): string {
  if (match.confidence === "exact") return "Exact match";
  if (match.confidence === "strong") return "Strong match";
  return "Possible match";
}

function stringFromNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function matchFromLead(lead: ImportedLandLead): DealIntakeMatch {
  return {
    id: lead.id,
    source: "va-lead",
    confidence: "exact",
    score: 100,
    label: lead.property_address || lead.parcel_id || lead.owner_name || "VA property record",
    address: lead.property_address,
    parcel_id: lead.parcel_id,
    county: lead.county,
    city: lead.city,
    state: lead.state,
    acreage: lead.acreage,
    asking_price: lead.asking_price,
    market_value: lead.market_value ?? lead.total_parcel_value ?? null,
    zoning: lead.zoning,
    land_use: lead.land_use,
    status: lead.status,
    deal_id: lead.deal_id,
    href: lead.deal_id ? `/opportunity?deal=${lead.deal_id}` : `/lead/${lead.id}`,
    source_label: "VA property record",
    reasons: ["opened from property record"],
  };
}

function formFromLead(lead: ImportedLandLead): IntakeForm {
  const draft = leadToDealDraft(lead);
  const location = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
  return {
    ...EMPTY_FORM,
    query: [
      lead.property_address,
      lead.parcel_id ? `Parcel/APN: ${lead.parcel_id}` : "",
      lead.owner_name ? `Owner: ${lead.owner_name}` : "",
      lead.county ? `County: ${lead.county}` : "",
      lead.land_use ? `Land use: ${lead.land_use}` : "",
    ].filter(Boolean).join("\n"),
    property_type: "land",
    address: String(draft.address || location || lead.property_address || ""),
    parcel_id: String(draft.parcel_id || lead.parcel_id || ""),
    seller_name: String(draft.seller_name || lead.owner_name || ""),
    seller_phone: String(draft.seller_phone || lead.phone || lead.phone_2 || ""),
    listing_url: lead.property_url || lead.parcel_link || lead.google_map_url || "",
    asking_price: stringFromNumber(draft.asking_price ?? lead.asking_price),
    acreage: stringFromNumber(draft.acreage ?? lead.acreage),
    target_resale_price: stringFromNumber(draft.target_resale_price ?? draft.arv),
    exit_strategy: draft.exit_strategy || EMPTY_FORM.exit_strategy,
    target_buyer_type: draft.target_buyer_type || EMPTY_FORM.target_buyer_type,
    buyer_demand_evidence: draft.buyer_demand_evidence || "",
    notes: draft.notes || "",
    urgency: draft.urgency || "routine",
  };
}

export default function AnalyzeDealPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const [matches, setMatches] = useState<DealIntakeMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<DealIntakeMatch | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [analysis, setAnalysis] = useState<DealAiAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [createdDeal, setCreatedDeal] = useState<Deal | null>(null);
  const [requestedLeadId, setRequestedLeadId] = useState<string | null>(null);
  const [prefilledLeadId, setPrefilledLeadId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedLeadId(params.get("lead") || params.get("leadId"));
  }, []);

  useEffect(() => {
    const current = getCurrentMeridianUser();
    if (!current) {
      router.push("/");
      return;
    }
    if (isVaUser(current)) {
      router.push("/va?tab=packet");
      return;
    }
    setUser(current);
  }, [router]);

  useEffect(() => {
    if (!user || !requestedLeadId || prefilledLeadId === requestedLeadId) return;
    let cancelled = false;
    void fetchImportedLandLeads(5000).then(rows => {
      if (cancelled) return;
      const lead = rows.find(row => row.id === requestedLeadId);
      if (!lead) {
        setMessage("I could not find that property record. You can still paste the property details here.");
        setPrefilledLeadId(requestedLeadId);
        return;
      }
      const match = matchFromLead(lead);
      setForm(formFromLead(lead));
      setMatches([match]);
      setSelectedMatch(match);
      setAnalysis(null);
      setAiError("");
      setCreatedDeal(null);
      setMessage("Property record loaded into the analyzer. Run AI Analysis to review the build assumptions.");
      setPrefilledLeadId(requestedLeadId);
    });
    return () => { cancelled = true; };
  }, [prefilledLeadId, requestedLeadId, user]);

  const updateField = useCallback(<K extends keyof IntakeForm>(field: K, value: IntakeForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setAnalysis(null);
    setAiError("");
    setCreatedDeal(null);
    setMessage("");
  }, []);

  const intakeInput = useMemo<DealIntakeInput>(() => ({
    query: form.query,
    property_type: form.property_type,
    address: form.address,
    parcel_id: form.parcel_id,
    seller_name: form.seller_name,
    seller_phone: form.seller_phone,
    listing_url: form.listing_url,
    asking_price: moneyToNumber(form.asking_price),
    acreage: moneyToNumber(form.acreage),
    target_resale_price: moneyToNumber(form.target_resale_price),
    exit_strategy: form.exit_strategy,
    target_buyer_type: form.target_buyer_type,
    buyer_demand_evidence: form.buyer_demand_evidence,
    notes: form.notes,
    urgency: form.urgency,
  }), [form]);

  const liveDraft = useMemo(() => buildDealDraftFromIntake(intakeInput, selectedMatch), [intakeInput, selectedMatch]);
  const calculator = useMemo(() => calculateDealAnalysis(liveDraft), [liveDraft]);
  const missingInfo = calculator.missingInfo.slice(0, 6);

  const runMatch = useCallback(async (): Promise<DealIntakeMatch[]> => {
    setMatching(true);
    setMatchError("");
    try {
      const response = await fetch("/api/deal-intake/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intakeInput),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || response.statusText || "Match lookup failed.");
      const rows = Array.isArray(data.matches) ? data.matches as DealIntakeMatch[] : [];
      setMatches(rows);
      const preferred = rows.find(row => row.confidence === "exact" || row.confidence === "strong") || rows[0] || null;
      setSelectedMatch(preferred);
      setMessage(rows.length ? "I found internal portal records that may match this property." : "No internal match yet. You can still run AI and submit the deal from your inputs.");
      return rows;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Match lookup failed.";
      setMatchError(text);
      setMessage(text);
      return [];
    } finally {
      setMatching(false);
    }
  }, [intakeInput]);

  const runAnalyze = useCallback(async () => {
    if (!form.query.trim() && !form.address.trim() && !form.parcel_id.trim() && !form.listing_url.trim()) {
      setAiError("Add an address, parcel/APN, listing link, or pasted property notes first.");
      return;
    }
    setAnalyzing(true);
    setAiError("");
    setMessage("");
    try {
      let draftForAnalysis = liveDraft;
      if (matches.length === 0) {
        const rows = await runMatch();
        const preferred = rows.find(row => row.confidence === "exact" || row.confidence === "strong") || rows[0] || null;
        draftForAnalysis = buildDealDraftFromIntake(intakeInput, preferred);
      }
      const response = await fetch("/api/deals/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal: draftForAnalysis,
          context: [
            "This is a member-submitted Analyze My Deal intake.",
            "Assume MLS/FMLS sold comps are not connected yet.",
            "Use only the provided portal record match, member-entered details, calculator outputs, and build analysis assumptions.",
            "Call out exactly which new-build sold comps, property records, and construction/financing assumptions still need verification.",
          ].join("\n"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || response.statusText || "AI analysis failed.");
      setAnalysis(data as DealAiAnalysisResult);
      setMessage(data.note ? String(data.note) : "AI analysis is ready. Review the suggested next steps before submitting.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "AI analysis failed.";
      setAiError(text);
      setMessage(text);
    } finally {
      setAnalyzing(false);
    }
  }, [form.address, form.listing_url, form.parcel_id, form.query, intakeInput, liveDraft, matches.length, runMatch]);

  const applyAiSuggestions = useCallback(() => {
    if (!analysis) return;
    const suggestions = analysis.field_suggestions;
    setForm(prev => ({
      ...prev,
      exit_strategy: suggestions.exit_strategy || prev.exit_strategy,
      target_buyer_type: suggestions.target_buyer_type || prev.target_buyer_type,
      buyer_demand_evidence: suggestions.buyer_demand_evidence || prev.buyer_demand_evidence,
      notes: mergeText(prev.notes, suggestions.calculator_notes, suggestions.build_analysis_notes),
    }));
    setMessage("AI suggestions applied to the intake draft. Review them before saving.");
  }, [analysis]);

  const buildSavePayload = useCallback((submitForReview: boolean): DealInput => {
    const suggestions = analysis?.field_suggestions;
    const now = new Date().toISOString();
    return {
      ...liveDraft,
      status: submitForReview ? "under-review" : "lead",
      urgency: form.urgency,
      submitted_by: user,
      assigned_to: user,
      review_intent: "needs-info-review",
      submission_summary: suggestions?.submission_summary || liveDraft.submission_summary || calculator.summary,
      requested_next_step: suggestions?.requested_next_step || liveDraft.requested_next_step || "Verify property records, sold new-build comps, zoning/utilities, construction budget, and financing assumptions.",
      submit_uncertainties: suggestions?.submit_uncertainties || liveDraft.submit_uncertainties || (missingInfo.length ? missingInfo.map(item => `- ${item}`).join("\n") : "No calculator gaps flagged yet."),
      first_submitted_at: submitForReview ? now : null,
      last_submitted_at: submitForReview ? now : null,
      review_round: submitForReview ? 1 : 0,
      last_review_notification_at: submitForReview ? now : null,
      calculator_notes: mergeText(
        liveDraft.calculator_notes,
        analysis?.pricing_guidance,
        suggestions?.calculator_notes,
        suggestions?.build_analysis_notes,
      ),
      notes: mergeText(
        liveDraft.notes,
        analysis?.executive_summary ? `AI summary: ${analysis.executive_summary}` : "",
        selectedMatch ? `Internal match selected: ${selectedMatch.source_label} (${selectedMatch.confidence}).` : "",
      ),
      buyer_demand_evidence: suggestions?.buyer_demand_evidence || liveDraft.buyer_demand_evidence,
      exit_strategy: suggestions?.exit_strategy || liveDraft.exit_strategy,
      target_buyer_type: suggestions?.target_buyer_type || liveDraft.target_buyer_type,
      links: Array.from(new Set((liveDraft.links || []).filter(Boolean))),
    };
  }, [analysis, calculator.summary, form.urgency, liveDraft, missingInfo, selectedMatch, user]);

  const notifyReviewWork = useCallback(async (deal: Deal): Promise<string[]> => {
    const members = await fetchActiveMemberNames();
    const body = [
      `${deal.analysis?.recommendation ?? "Needs Review"} from member-submitted deal intake.`,
      deal.address || deal.parcel_id || "Location pending",
      analysis?.executive_summary || "",
    ].filter(Boolean).join(" ");
    const results = await Promise.all(members.flatMap(member => [
      createNotification({
        title: `Member deal ready: ${deal.title}`,
        body,
        priority: deal.urgency === "hot" ? "urgent" : "high",
        assigned_to: member,
        href: `/opportunity?deal=${deal.id}`,
        source_table: "meridian_deals",
        source_id: deal.id,
        notification_type: "deal_vote",
        dedupe: true,
      }, user || "Member"),
      createActionItem({
        title: `Review member deal: ${deal.title}`,
        description: body,
        assigned_to: member,
        due_date: addDays(deal.urgency === "hot" ? 1 : 2),
        task_type: "deal-follow-up",
        priority: deal.urgency === "hot" ? "urgent" : "high",
        source_table: "meridian_deals",
        source_id: deal.id,
      }, user || "Member"),
    ]));
    return results.map(result => result.error).filter((error): error is string => !!error);
  }, [analysis?.executive_summary, user]);

  const saveDeal = useCallback(async (submitForReview: boolean) => {
    if (!user) return;
    if (!form.query.trim() && !form.address.trim() && !form.parcel_id.trim() && !form.listing_url.trim()) {
      setMessage("Add an address, parcel/APN, listing link, or pasted property notes before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = buildSavePayload(submitForReview);
      const { data, error } = await createDeal(payload, user);
      if (error && !data) throw new Error(error);
      if (!data) throw new Error("Deal save failed.");

      await createDealActivity({
        deal_id: data.id,
        actor: user,
        activity_type: submitForReview ? "submitted-review" : "note",
        summary: submitForReview ? "Member submitted deal through Analyze My Deal." : "Member saved Analyze My Deal draft.",
        field_changes: {
          selected_match: selectedMatch,
          ai_recommendation: analysis?.recommendation ?? null,
          ai_confidence: analysis?.confidence ?? null,
        },
      });

      if (selectedMatch?.source === "va-lead") {
        await updateImportedLandLeadStatus(selectedMatch.id, submitForReview ? "converted" : "interested", data.id);
        await createImportedLandLeadActivity({
          leadId: selectedMatch.id,
          actor: user,
          activityType: submitForReview ? "converted" : "interested",
          summary: submitForReview
            ? `Member submitted matching deal packet: ${data.title}`
            : `Member saved deal draft from matching property record: ${data.title}`,
        });
      }

      const workErrors = submitForReview ? await notifyReviewWork(data) : [];
      setCreatedDeal(data);
      if (workErrors.length || error) {
        setMessage(`Deal saved, but one follow-up step needs attention: ${workErrors[0] || error}`);
      } else {
        setMessage(submitForReview ? "Deal submitted for member review." : "Deal draft saved.");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Deal save failed.";
      setMessage(text);
    } finally {
      setSaving(false);
    }
  }, [analysis, buildSavePayload, form.address, form.listing_url, form.parcel_id, form.query, notifyReviewWork, selectedMatch, user]);

  if (!user) return null;

  return (
    <main style={page}>
      <section style={headerBand}>
        <div>
          <p style={eyebrow}>Member portal</p>
          <h1 style={title}>Analyze My Deal</h1>
          <p style={lede}>
            Enter a property once. Meridian checks internal VA records, CRM property records, and existing deal packets, then builds an AI-assisted review packet for the member workflow.
          </p>
        </div>
        <div style={headerActions}>
          <button type="button" style={ghostButton} onClick={() => router.push("/deals")}>Deal Reviews</button>
          <button type="button" style={ghostButton} onClick={() => router.push("/crm")}>CRM</button>
        </div>
      </section>

      {message && <p style={messageBox}>{message}</p>}

      <section style={layout}>
        <form style={panel} onSubmit={(event) => event.preventDefault()}>
          <div style={sectionHead}>
            <div>
              <p style={eyebrow}>Step 1</p>
              <h2 style={panelTitle}>Property intake</h2>
            </div>
            <select
              value={form.urgency}
              onChange={event => updateField("urgency", event.target.value as DealUrgency)}
              style={select}
              aria-label="Deal urgency"
            >
              <option value="routine">Routine</option>
              <option value="time-sensitive">Time-sensitive</option>
              <option value="hot">Hot</option>
            </select>
          </div>

          <label style={field}>
            <span style={label}>Paste property notes, address, APN, or listing text</span>
            <textarea
              value={form.query}
              onChange={event => updateField("query", event.target.value)}
              style={{ ...textarea, minHeight: 96 }}
              placeholder="Paste whatever the member has: address, APN, seller text, Zillow/LandWatch notes, or property record details."
            />
          </label>

          <div style={twoCol}>
            <label style={field}>
              <span style={label}>Property type</span>
              <select
                value={form.property_type}
                onChange={event => updateField("property_type", event.target.value as DealPropertyType)}
                style={select}
              >
                <option value="land">Land / build</option>
                <option value="house">House</option>
                <option value="rental">Rental</option>
                <option value="commercial">Commercial</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style={field}>
              <span style={label}>Listing/source link</span>
              <input value={form.listing_url} onChange={event => updateField("listing_url", event.target.value)} style={input} placeholder="https://..." />
            </label>
          </div>

          <div style={twoCol}>
            <label style={field}>
              <span style={label}>Address</span>
              <input value={form.address} onChange={event => updateField("address", event.target.value)} style={input} placeholder="Street, city, state" />
            </label>
            <label style={field}>
              <span style={label}>Parcel/APN</span>
              <input value={form.parcel_id} onChange={event => updateField("parcel_id", event.target.value)} style={input} placeholder="Parcel ID" />
            </label>
          </div>

          <div style={twoCol}>
            <label style={field}>
              <span style={label}>Seller name</span>
              <input value={form.seller_name} onChange={event => updateField("seller_name", event.target.value)} style={input} placeholder="Optional" />
            </label>
            <label style={field}>
              <span style={label}>Seller phone</span>
              <input value={form.seller_phone} onChange={event => updateField("seller_phone", event.target.value)} style={input} placeholder="Optional" />
            </label>
          </div>

          <div style={threeCol}>
            <label style={field}>
              <span style={label}>Asking price</span>
              <input value={form.asking_price} onChange={event => updateField("asking_price", event.target.value)} style={input} placeholder="$" inputMode="decimal" />
            </label>
            <label style={field}>
              <span style={label}>Acreage</span>
              <input value={form.acreage} onChange={event => updateField("acreage", event.target.value)} style={input} placeholder="0.00" inputMode="decimal" />
            </label>
            <label style={field}>
              <span style={label}>Target resale / ARV</span>
              <input value={form.target_resale_price} onChange={event => updateField("target_resale_price", event.target.value)} style={input} placeholder="$" inputMode="decimal" />
            </label>
          </div>

          <div style={twoCol}>
            <label style={field}>
              <span style={label}>Exit strategy</span>
              <textarea value={form.exit_strategy} onChange={event => updateField("exit_strategy", event.target.value)} style={textarea} />
            </label>
            <label style={field}>
              <span style={label}>Target buyer</span>
              <textarea value={form.target_buyer_type} onChange={event => updateField("target_buyer_type", event.target.value)} style={textarea} />
            </label>
          </div>

          <label style={field}>
            <span style={label}>Buyer demand / comps evidence</span>
            <textarea
              value={form.buyer_demand_evidence}
              onChange={event => updateField("buyer_demand_evidence", event.target.value)}
              style={textarea}
              placeholder="Sold new builds, buyer calls, subdivision demand, builder appetite, or what still needs to be researched."
            />
          </label>

          <label style={field}>
            <span style={label}>Member notes</span>
            <textarea value={form.notes} onChange={event => updateField("notes", event.target.value)} style={textarea} placeholder="Anything else the member knows." />
          </label>

          <div style={actionRow}>
            <button type="button" onClick={runMatch} disabled={matching} style={secondaryButton}>
              {matching ? "Checking..." : "Find Internal Records"}
            </button>
            <button type="button" onClick={runAnalyze} disabled={analyzing} style={primaryButton}>
              {analyzing ? "Analyzing..." : "Run AI Analysis"}
            </button>
          </div>
        </form>

        <aside style={sideStack}>
          <section style={panel}>
            <div style={sectionHead}>
              <div>
                <p style={eyebrow}>Step 2</p>
                <h2 style={panelTitle}>Internal match</h2>
              </div>
              <span style={miniPill}>{matches.length} found</span>
            </div>
            {matchError && <p style={errorText}>{matchError}</p>}
            {!matches.length && !matching && (
              <p style={mutedText}>
                The portal will look for the same address, parcel/APN, listing link, seller phone, or pasted text inside VA property records, CRM records, and existing deal packets.
              </p>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {matches.map(match => {
                const active = selectedMatch?.id === match.id && selectedMatch?.source === match.source;
                return (
                  <button
                    key={`${match.source}-${match.id}`}
                    type="button"
                    onClick={() => setSelectedMatch(match)}
                    style={active ? selectedMatchCard : matchCard}
                  >
                    <span style={matchTop}>
                      <strong style={matchTitle}>{match.label}</strong>
                      <span style={confidencePill(match.confidence)}>{confidenceLabel(match)}</span>
                    </span>
                    <span style={mutedText}>{match.source_label} · {compactLocation(match)}</span>
                    <span style={matchFacts}>
                      <span>{formatMoney(match.asking_price)}</span>
                      <span>{formatAcreage(match.acreage)}</span>
                      <span>{match.parcel_id || "No APN"}</span>
                    </span>
                    {match.reasons.length > 0 && <span style={reasonText}>{match.reasons.join(", ")}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={panel}>
            <div style={sectionHead}>
              <div>
                <p style={eyebrow}>Live packet</p>
                <h2 style={panelTitle}>{liveDraft.title}</h2>
              </div>
              <span style={miniPill}>{calculator.recommendation}</span>
            </div>
            <div style={metricGrid}>
              <Metric label="Asking" value={formatMoney(liveDraft.asking_price)} />
              <Metric label="Target exit" value={formatMoney(liveDraft.target_resale_price)} />
              <Metric label="Acreage" value={formatAcreage(liveDraft.acreage)} />
              <Metric label="MAO" value={formatMoney(calculator.maxAllowableOffer)} />
            </div>
            {missingInfo.length > 0 && (
              <div style={noteBox}>
                <p style={noteTitle}>Missing before a real vote</p>
                {missingInfo.map(item => <p key={item} style={mutedText}>{item}</p>)}
              </div>
            )}
          </section>

          {liveDraft.property_type === "land" && (
            <BuildDealAnalysisPanel
              value={liveDraft.build_analysis}
              deal={liveDraft}
            />
          )}

          <DealAiAnalysisPanel
            result={analysis}
            loading={analyzing}
            error={aiError}
            onAnalyze={runAnalyze}
            onApply={applyAiSuggestions}
            canApply={Boolean(analysis)}
          />

          <section style={panel}>
            <div style={sectionHead}>
              <div>
                <p style={eyebrow}>Step 3</p>
                <h2 style={panelTitle}>Save or submit</h2>
              </div>
            </div>
            <p style={mutedText}>
              Save keeps it as a lead draft. Submit sends it into the existing deal review queue, notifies members, and creates review tasks.
            </p>
            <div style={actionRow}>
              <button type="button" onClick={() => saveDeal(false)} disabled={saving} style={secondaryButton}>
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button type="button" onClick={() => saveDeal(true)} disabled={saving} style={primaryButton}>
                {saving ? "Submitting..." : "Submit For Review"}
              </button>
            </div>
            {createdDeal && (
              <div style={createdBox}>
                <strong>{createdDeal.title}</strong>
                <span>{createdDeal.status} · {createdDeal.analysis.recommendation}</span>
                <button type="button" style={ghostButton} onClick={() => router.push(`/opportunity?deal=${createdDeal.id}`)}>
                  Open Deal File
                </button>
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function confidencePill(confidence: DealIntakeMatch["confidence"]): CSSProperties {
  const exact = confidence === "exact";
  const strong = confidence === "strong";
  return {
    border: exact ? "1px solid rgba(49,107,76,0.28)" : strong ? "1px solid rgba(146,106,45,0.28)" : "1px solid var(--fog)",
    background: exact ? "rgba(49,107,76,0.10)" : strong ? "rgba(146,106,45,0.12)" : "var(--surface)",
    color: exact ? "#316b4c" : strong ? "#7a5824" : "var(--muted)",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bone)",
  padding: "26px clamp(16px, 3vw, 36px) 46px",
  display: "grid",
  gap: 18,
};

const headerBand: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: 16,
  borderBottom: "1px solid var(--fog)",
  paddingBottom: 18,
};

const headerActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const eyebrow: CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const title: CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--obsidian)",
  fontSize: "clamp(34px, 5vw, 58px)",
  fontWeight: 500,
  lineHeight: 0.98,
  letterSpacing: 0,
};

const lede: CSSProperties = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 780,
  marginTop: 10,
};

const layout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
  gap: 14,
  alignItems: "start",
};

const sideStack: CSSProperties = {
  display: "grid",
  gap: 14,
  minWidth: 0,
};

const panel: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,252,245,0.88)",
  padding: 14,
  display: "grid",
  gap: 12,
  minWidth: 0,
};

const sectionHead: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const panelTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--obsidian)",
  fontSize: 25,
  lineHeight: 1.05,
  fontWeight: 500,
  letterSpacing: 0,
};

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 10,
};

const threeCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
  gap: 10,
};

const field: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const label: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const input: CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  background: "var(--surface)",
  color: "var(--obsidian)",
  padding: "10px 11px",
  fontSize: 14,
  outline: "none",
};

const select: CSSProperties = {
  ...input,
  minHeight: 41,
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 78,
  resize: "vertical",
  lineHeight: 1.45,
};

const actionRow: CSSProperties = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
};

const primaryButton: CSSProperties = {
  border: "1px solid var(--obsidian)",
  background: "var(--obsidian)",
  color: "var(--bone)",
  borderRadius: 7,
  minHeight: 40,
  padding: "10px 13px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "var(--surface)",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const ghostButton: CSSProperties = {
  ...secondaryButton,
  minHeight: 36,
  padding: "8px 11px",
};

const miniPill: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  background: "var(--surface)",
  padding: "5px 8px",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};

const mutedText: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.48,
};

const errorText: CSSProperties = {
  ...mutedText,
  color: "#8d3f31",
};

const messageBox: CSSProperties = {
  border: "1px solid rgba(49,107,76,0.22)",
  background: "rgba(49,107,76,0.08)",
  color: "#284f3a",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.45,
};

const matchCard: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 7,
  background: "var(--surface)",
  padding: 10,
  display: "grid",
  gap: 7,
  textAlign: "left",
  cursor: "pointer",
};

const selectedMatchCard: CSSProperties = {
  ...matchCard,
  border: "1px solid rgba(49,107,76,0.38)",
  boxShadow: "0 0 0 2px rgba(49,107,76,0.08)",
};

const matchTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "flex-start",
};

const matchTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 13,
  lineHeight: 1.25,
};

const matchFacts: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  color: "var(--obsidian)",
  fontSize: 11,
  fontWeight: 700,
};

const reasonText: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  lineHeight: 1.35,
};

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: 8,
};

const metric: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 7,
  background: "var(--surface)",
  padding: 9,
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const noteBox: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 7,
  background: "var(--surface)",
  padding: 10,
  display: "grid",
  gap: 5,
};

const noteTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const createdBox: CSSProperties = {
  border: "1px solid rgba(49,107,76,0.24)",
  borderRadius: 7,
  background: "rgba(49,107,76,0.08)",
  padding: 10,
  display: "grid",
  gap: 6,
  color: "var(--obsidian)",
  fontSize: 13,
};
