"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  calculateDealAnalysis,
  createDealActivity,
  fetchDealActivity,
  fetchDealAgreement,
  fetchDealAttachments,
  fetchDealChecklist,
  fetchDealVotes,
  fetchDeals,
  type Deal,
  type DealActivity,
  type DealAgreement,
  type DealAttachment,
  type DealDueDiligenceItem,
  type DealVote,
} from "@/lib/deals";
import {
  createImportedLandLeadActivity,
  fetchImportedLandLeadActivities,
  fetchImportedLandLeads,
  type ImportedLandLead,
  type ImportedLandLeadActivity,
} from "@/lib/land-leads";
import { fetchCommunicationEvents, type CommunicationEvent } from "@/lib/communications";
import { fetchCrmDashboardData, type BuyerOffer, type CrmBuyer, type DispositionCampaign } from "@/lib/crm";
import ConversationPanel from "@/components/ConversationPanel";
import { labelForStatus } from "@/lib/status-map";
import { getDealNextAction, getLeadNextAction } from "@/lib/workflow-actions";

const DISPLAY_FONT = "var(--font-display)";

type OpportunitySection = "overview" | "notes" | "calculator" | "timeline" | "review";

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "N/A";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusLabel(value: string | null | undefined): string {
  return labelForStatus(value);
}

type SharedNote = {
  id: string;
  at: string;
  actor: string;
  body: string;
  source: "Deal" | "Lead";
};

export default function OpportunityPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 1280, margin: "0 auto", padding: "84px 20px 100px" }}>Loading file...</main>}>
      <OpportunityContent />
    </Suspense>
  );
}

function OpportunityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dealParam = searchParams.get("deal");
  const leadParam = searchParams.get("lead");
  const [user, setUser] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<ImportedLandLead[]>([]);
  const [leadActivities, setLeadActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [dealActivity, setDealActivity] = useState<DealActivity[]>([]);
  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [checklist, setChecklist] = useState<DealDueDiligenceItem[]>([]);
  const [votes, setVotes] = useState<DealVote[]>([]);
  const [attachments, setAttachments] = useState<DealAttachment[]>([]);
  const [agreement, setAgreement] = useState<DealAgreement | null>(null);
  const [campaigns, setCampaigns] = useState<DispositionCampaign[]>([]);
  const [offers, setOffers] = useState<BuyerOffer[]>([]);
  const [buyers, setBuyers] = useState<CrmBuyer[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [activeSection, setActiveSection] = useState<OpportunitySection>("overview");

  useEffect(() => {
    const current = localStorage.getItem("meridian_user");
    if (!current) { router.push("/"); return; }
    setUser(current);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const [dealRows, leadRows, crmRows] = await Promise.all([
        fetchDeals(),
        fetchImportedLandLeads(1500),
        fetchCrmDashboardData(),
      ]);
      setDeals(dealRows);
      setLeads(leadRows);
      setCampaigns(crmRows.campaigns);
      setOffers(crmRows.offers);
      setBuyers(crmRows.buyers);
      setLoading(false);
    }
    void load();
  }, [user]);

  const selectedLead = useMemo(() => {
    if (leadParam) return leads.find(lead => lead.id === leadParam) ?? null;
    if (dealParam) return leads.find(lead => lead.deal_id === dealParam) ?? null;
    return leads.find(lead => lead.deal_id) ?? leads[0] ?? null;
  }, [dealParam, leadParam, leads]);

  const selectedDeal = useMemo(() => {
    if (dealParam) return deals.find(deal => deal.id === dealParam) ?? null;
    if (selectedLead?.deal_id) return deals.find(deal => deal.id === selectedLead.deal_id) ?? null;
    return deals[0] ?? null;
  }, [dealParam, deals, selectedLead]);

  const analysis = useMemo(() => selectedDeal ? selectedDeal.analysis ?? calculateDealAnalysis(selectedDeal) : null, [selectedDeal]);
  const relatedCampaigns = useMemo(() => selectedDeal ? campaigns.filter(campaign => campaign.deal_id === selectedDeal.id) : [], [campaigns, selectedDeal]);
  const relatedOffers = useMemo(() => selectedDeal ? offers.filter(offer => offer.deal_id === selectedDeal.id) : [], [offers, selectedDeal]);
  const matchedBuyers = useMemo(() => {
    if (!selectedDeal) return buyers.slice(0, 6);
    const county = selectedLead?.county?.toLowerCase() || selectedDeal.address?.toLowerCase() || "";
    return buyers.filter(buyer => buyer.markets.some(market => county.includes(market.toLowerCase()) || market.toLowerCase().includes(county))).slice(0, 6);
  }, [buyers, selectedDeal, selectedLead]);
  const sharedNotes = useMemo<SharedNote[]>(() => {
    const leadNotes = leadActivities
      .filter(activity => activity.activity_type === "note")
      .map(activity => ({
        id: `lead-note-${activity.id}`,
        at: activity.created_at,
        actor: activity.actor || "VA",
        body: activity.summary,
        source: "Lead" as const,
      }));
    const dealNotes = dealActivity
      .filter(activity => activity.activity_type === "note")
      .map(activity => ({
        id: `deal-note-${activity.id}`,
        at: activity.created_at,
        actor: activity.actor || "Member",
        body: activity.summary,
        source: "Deal" as const,
      }));
    return [...leadNotes, ...dealNotes].sort((a, b) => b.at.localeCompare(a.at));
  }, [dealActivity, leadActivities]);
  const conversationActivities = useMemo(() => [
    ...leadActivities.map(activity => ({
      id: `lead-${activity.id}`,
      title: statusLabel(activity.activity_type),
      date: activity.created_at,
      body: activity.summary,
      meta: activity.next_follow_up_date ? `Follow up ${activity.next_follow_up_date}` : undefined,
    })),
    ...dealActivity.map(activity => ({
      id: `deal-${activity.id}`,
      title: statusLabel(activity.activity_type),
      date: activity.created_at,
      body: activity.summary,
      meta: activity.actor || undefined,
    })),
  ], [dealActivity, leadActivities]);
  const nextWorkflowAction = useMemo(() => {
    if (selectedDeal) {
      return getDealNextAction({
        deal: selectedDeal,
        votes,
        agreement,
        checklist,
        communications,
        currentUser: user,
      });
    }
    if (selectedLead) return getLeadNextAction(selectedLead);
    return null;
  }, [agreement, checklist, communications, selectedDeal, selectedLead, user, votes]);

  const loadFileDetails = useCallback(async () => {
    if (!selectedLead && !selectedDeal) return;
    const leadId = selectedLead?.id ?? null;
    const dealId = selectedDeal?.id ?? null;
    const [leadActivityRows, leadComms, dealActivityRows, dealComms, checklistRows, voteRows, attachmentRows, agreementRow] = await Promise.all([
      leadId ? fetchImportedLandLeadActivities(leadId, 80) : Promise.resolve([]),
      leadId ? fetchCommunicationEvents({ leadId, limit: 50 }) : Promise.resolve([]),
      dealId ? fetchDealActivity(dealId) : Promise.resolve([]),
      dealId ? fetchCommunicationEvents({ dealId, limit: 50 }) : Promise.resolve([]),
      dealId ? fetchDealChecklist(dealId) : Promise.resolve([]),
      dealId ? fetchDealVotes(dealId) : Promise.resolve([]),
      dealId ? fetchDealAttachments(dealId) : Promise.resolve([]),
      dealId ? fetchDealAgreement(dealId) : Promise.resolve(null),
    ]);
    setLeadActivities(leadActivityRows);
    setDealActivity(dealActivityRows);
    setCommunications([...leadComms, ...dealComms].sort((a, b) => (b.provider_created_at || b.created_at).localeCompare(a.provider_created_at || a.created_at)));
    setChecklist(checklistRows);
    setVotes(voteRows);
    setAttachments(attachmentRows);
    setAgreement(agreementRow);
  }, [selectedDeal, selectedLead]);

  useEffect(() => {
    void loadFileDetails();
  }, [loadFileDetails]);

  if (!user) return null;

  const title = selectedDeal?.title || selectedLead?.property_address || selectedLead?.parcel_id || selectedLead?.owner_name || "Opportunity file";
  const clearedChecklist = checklist.filter(item => item.status === "cleared" || item.status === "not-applicable").length;
  const approvedVotes = votes.filter(vote => ["make-offer", "counter", "urgent-review"].includes(vote.vote)).length;
  const sellerPhone = selectedDeal?.seller_phone || selectedLead?.phone || selectedLead?.phone_2 || "";
  const smsDisabled = smsSending || !sellerPhone || selectedLead?.sms_opt_status === "opted-out";

  const sendOpportunitySms = async () => {
    if (!sellerPhone) { setSmsMessage("This file does not have a seller phone number yet."); return; }
    if (selectedLead?.sms_opt_status === "opted-out") { setSmsMessage("This seller has opted out. Do not text this number."); return; }
    const body = smsDraft.trim();
    if (!body) { setSmsMessage("Write a text message before sending."); return; }
    setSmsSending(true);
    setSmsMessage("");
    try {
      const response = await fetch("/api/sakari/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: sellerPhone,
          message: body,
          actor: user,
          leadId: selectedLead?.id ?? null,
          dealId: selectedDeal?.id ?? null,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setSmsMessage(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      setSmsMessage("SMS sent and added to this file.");
      await loadFileDetails();
    } catch (error) {
      setSmsMessage(`SMS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSmsSending(false);
    }
  };
  const opportunityCrmUrl = selectedDeal ? `/crm?view=records&deal=${selectedDeal.id}` : "/crm?view=records";
  const opportunityDispoUrl = selectedDeal ? `/crm?view=dispo&deal=${selectedDeal.id}` : "/crm?view=dispo";
  const opportunityDealReviewUrl = selectedDeal ? `/deals?deal=${selectedDeal.id}` : "/deals";
  const quickActions = [
    {
      label: "Assign VA Task",
      detail: "Send follow-up, research, or cleanup work to the VA queue.",
      onClick: () => router.push("/actions?new=va"),
      disabled: false,
    },
    {
      label: "Open Deal Review",
      detail: "Review votes, calculator, agreement, and member packet.",
      onClick: () => router.push(opportunityDealReviewUrl),
      disabled: !selectedDeal,
    },
    {
      label: "Records",
      detail: "Check linked seller, property, buyer, and cleanup records.",
      onClick: () => router.push(opportunityCrmUrl),
      disabled: false,
    },
    {
      label: "Disposition Desk",
      detail: "Work buyer matches, campaigns, offers, and exit path.",
      onClick: () => router.push(opportunityDispoUrl),
      disabled: !selectedDeal,
    },
    {
      label: "Conversation",
      detail: "Read seller texts, VA notes, and activity timeline.",
      onClick: () => setActiveSection("timeline"),
      disabled: false,
    },
    {
      label: "VA Workdesk",
      detail: "Return to lead queues, calls, texts, and daily brief.",
      onClick: () => router.push("/va"),
      disabled: false,
    },
  ];
  const fileSections: { id: OpportunitySection; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "notes", label: "Notes", count: sharedNotes.length },
    { id: "calculator", label: "Calculator", count: analysis?.missingInfo.length ?? 0 },
    { id: "timeline", label: "Timeline", count: communications.length + leadActivities.length + dealActivity.length },
    { id: "review", label: "Review", count: votes.length + checklist.length },
  ];
  const opportunityDecisionPath = selectedDeal ? [
    {
      label: "1. Handoff",
      title: selectedDeal.submission_summary ? "VA packet ready" : "Review packet",
      detail: selectedDeal.requested_next_step || "Confirm the member decision being requested.",
      state: selectedDeal.status === "under-review" ? "active" : "done",
      section: "overview" as OpportunitySection,
    },
    {
      label: "2. Calculator",
      title: analysis?.recommendation || "Needs numbers",
      detail: analysis ? `${money(analysis.acquisition.recommendedOffer)} recommended · ${analysis.disposition.exitConfidence} confidence` : "Add price, value, and exit details.",
      state: analysis && analysis.missingInfo.length === 0 ? "done" : "active",
      section: "calculator" as OpportunitySection,
    },
    {
      label: "3. Review",
      title: votes.length ? `${approvedVotes}/${votes.length} support` : "No votes yet",
      detail: votes.length ? "Member votes are attached to this shared file." : "Members need to vote or request information.",
      state: votes.length ? "done" : selectedDeal.status === "under-review" ? "active" : "open",
      section: "review" as OpportunitySection,
    },
    {
      label: "4. Agreement",
      title: agreement ? statusLabel(agreement.status) : "Not started",
      detail: agreement ? "Deal terms are saved for this opportunity." : "Define capital, roles, guarantees, and economics.",
      state: agreement && ["approved", "signed"].includes(agreement.status) ? "done" : votes.length ? "active" : "open",
      section: "review" as OpportunitySection,
    },
    {
      label: "5. Disposition",
      title: relatedCampaigns.length ? "Campaign active" : "Not started",
      detail: relatedOffers.length ? `${relatedOffers.length} buyer offer${relatedOffers.length === 1 ? "" : "s"} recorded.` : "Launch buyer outreach after member direction.",
      state: relatedCampaigns.length || relatedOffers.length ? "active" : "open",
      section: "review" as OpportunitySection,
    },
  ] : [];

  async function saveSharedNote() {
    const summary = noteDraft.trim();
    if (!summary) {
      setNoteMessage("Write a note first.");
      return;
    }
    if (!selectedDeal && !selectedLead) {
      setNoteMessage("Select a lead or deal first.");
      return;
    }
    setNoteSaving(true);
    setNoteMessage("");
    if (selectedDeal) {
      const { error } = await createDealActivity({
        deal_id: selectedDeal.id,
        actor: user || "Unknown",
        activity_type: "note",
        summary,
        field_changes: { note: summary, source: "opportunity-file" },
      });
      if (error) {
        setNoteMessage(error);
      } else {
        setDealActivity(await fetchDealActivity(selectedDeal.id));
        setNoteDraft("");
        setNoteMessage("Note saved to the shared deal file.");
      }
    } else if (selectedLead) {
      const { error } = await createImportedLandLeadActivity({
        leadId: selectedLead.id,
        actor: user || "Unknown",
        activityType: "note",
        summary,
      });
      if (error) {
        setNoteMessage(error);
      } else {
        setLeadActivities(await fetchImportedLandLeadActivities(selectedLead.id, 80));
        setNoteDraft("");
        setNoteMessage("Note saved to the shared lead file.");
      }
    }
    setNoteSaving(false);
  }

  return (
    <div className="opportunity-page" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8f2e7 0%, #efe6d6 100%)", padding: "72px 20px 96px", color: "var(--ink)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 18, alignItems: "end", marginBottom: 16 }} className="topbar">
          <div>
            <p style={eyebrow}>One Main File</p>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(32px, 4vw, 46px)", lineHeight: 0.96, fontWeight: 500, color: "var(--obsidian)" }}>
              {title}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 780, marginTop: 8 }}>
              This is the shared record from imported lead to VA work, deal brief, calculator, member review, buyer outreach, offers, and close.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => document.getElementById("opportunity-sms")?.focus()} style={secondaryButton}>Send Text</button>
            <button onClick={() => router.push("/dashboard")} style={secondaryButton}>Member Home</button>
            <button onClick={() => router.push("/va")} style={secondaryButton}>VA Desk</button>
            <button onClick={() => router.push(selectedDeal ? `/deals?deal=${selectedDeal.id}` : "/deals")} style={secondaryButton}>Deal Reviews</button>
            <button onClick={() => router.push("/crm")} style={primaryButton}>CRM</button>
          </div>
        </header>

        <section style={summaryStrip} className="summary-strip">
          <SummaryMetric label="Lead status" value={statusLabel(selectedLead?.status || selectedDeal?.status)} />
          <SummaryMetric label="Calculator" value={analysis?.recommendation || "Needs Info"} tone={analysis?.recommendation === "Strong Review" ? "hot" : "calm"} />
          <SummaryMetric label="Checklist" value={checklist.length ? `${clearedChecklist}/${checklist.length}` : "Not Started"} />
          <SummaryMetric label="Votes" value={votes.length ? `${approvedVotes}/${votes.length} support` : "No Votes"} />
          <SummaryMetric label="Best Offer" value={money(analysis?.disposition.bestBuyerOffer ?? relatedOffers[0]?.offer_amount)} tone={relatedOffers.length ? "hot" : "calm"} />
        </section>

        {selectedDeal && (
          <section className="opportunity-decision-path">
            {opportunityDecisionPath.map(item => (
              <button
                key={item.label}
                onClick={() => setActiveSection(item.section)}
                className={`opportunity-path-card ${item.state}`}
              >
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </button>
            ))}
          </section>
        )}

        {loading && <div style={panel}>Loading opportunity file...</div>}
        {!loading && !selectedLead && !selectedDeal && (
          <div style={panel}>
            <p style={eyebrowSmall}>No file selected</p>
            <h2 style={sectionTitle}>Start from the VA Desk or CRM</h2>
            <p style={bodyText}>Upload or select a land lead, then open its shared file. Once a lead becomes a deal, this same file carries the member packet and disposition work.</p>
          </div>
        )}

        {!loading && (selectedLead || selectedDeal) && (
          <>
          <nav className="file-tabs" aria-label="Opportunity file sections">
            {fileSections.map(section => (
              <FileTabButton
                key={section.id}
                label={section.label}
                count={section.count}
                active={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
              />
            ))}
          </nav>
          <div style={{ display: "grid", gridTemplateColumns: "270px minmax(0, 1fr) 340px", gap: 14 }} className="opportunity-grid">
            <aside style={panel}>
              <p style={eyebrowSmall}>File path</p>
              <h2 style={smallHeading}>Where this stands</h2>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <PathStep label="Imported lead" detail={selectedLead ? selectedLead.source_system : "No source lead linked"} state={selectedLead ? "done" : "open"} />
                <PathStep label="VA work" detail={`${leadActivities.length} lead activities · ${communications.length} messages`} state={leadActivities.length || communications.length ? "done" : "open"} />
                <PathStep label="Deal brief" detail={selectedDeal ? statusLabel(selectedDeal.status) : "Not converted yet"} state={selectedDeal ? "done" : "open"} />
                <PathStep label="Calculator" detail={analysis?.recommendation || "Needs deal numbers"} state={analysis ? "done" : "open"} />
                <PathStep label="Member review" detail={votes.length ? `${votes.length} vote records` : "No member votes yet"} state={votes.length ? "done" : selectedDeal?.status === "under-review" ? "active" : "open"} />
                <PathStep label="Disposition" detail={`${relatedCampaigns.length} campaigns · ${relatedOffers.length} offers`} state={relatedCampaigns.length || relatedOffers.length ? "active" : "open"} />
              </div>
            </aside>

            <main style={{ display: "grid", gap: 14 }}>
              {activeSection === "overview" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Shared summary</p>
                    <h2 style={sectionTitle}>What everyone should know</h2>
                  </div>
                  <span style={selectedDeal?.urgency === "hot" || selectedLead?.status === "interested" ? hotPill : pill}>
                    {selectedDeal?.urgency ? statusLabel(selectedDeal.urgency) : statusLabel(selectedLead?.status)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                  <InfoBlock title="Seller / owner">
                    <InfoLine label="Name" value={selectedDeal?.seller_name || selectedLead?.owner_name || "Unknown"} />
                    <InfoLine label="Phone" value={selectedDeal?.seller_phone || selectedLead?.phone || selectedLead?.phone_2 || "Missing"} />
                    <InfoLine label="Email" value={selectedLead?.email || "Missing"} />
                    <InfoLine label="Next follow-up" value={selectedDeal?.next_follow_up_date || selectedLead?.next_follow_up_date || "Not set"} />
                  </InfoBlock>
                  <InfoBlock title="Property">
                    <InfoLine label="Address" value={selectedDeal?.address || selectedLead?.property_address || "Missing"} />
                    <InfoLine label="Parcel" value={selectedDeal?.parcel_id || selectedLead?.parcel_id || "Missing"} />
                    <InfoLine label="County" value={selectedLead?.county || "Check notes"} />
                    <InfoLine label="Acreage" value={String(selectedDeal?.acreage ?? selectedLead?.acreage ?? "Missing")} />
                  </InfoBlock>
                </div>
                <div style={{ ...subPanel, marginTop: 12 }}>
                  <p style={eyebrowSmall}>VA notes to members</p>
                  <p style={bodyText}>{selectedDeal?.submission_summary || selectedDeal?.notes || selectedLead?.notes || "No summary has been added yet."}</p>
                  {selectedDeal?.requested_next_step && <p style={{ ...bodyText, marginTop: 8 }}><strong>Requested next step:</strong> {selectedDeal.requested_next_step}</p>}
                  {selectedDeal?.submit_uncertainties && <p style={{ ...bodyText, marginTop: 8 }}><strong>Open questions:</strong> {selectedDeal.submit_uncertainties}</p>}
                </div>
              </section>
              )}

              {activeSection === "notes" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }} className="notes-header">
                  <div>
                    <p style={eyebrowSmall}>Shared notes</p>
                    <h2 style={sectionTitle}>Leave the working record here</h2>
                  </div>
                  <span style={pill}>{sharedNotes.length} note{sharedNotes.length === 1 ? "" : "s"}</span>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={event => setNoteDraft(event.target.value)}
                  placeholder="Add a VA/member note, seller context, research finding, or handoff detail..."
                  rows={4}
                  style={noteTextarea}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 10 }} className="note-actions">
                  <p style={{ ...bodyText, color: noteMessage.toLowerCase().includes("saved") ? "var(--success)" : "var(--muted)" }}>{noteMessage || "Notes stay with this file so the next person does not have to hunt for context."}</p>
                  <button type="button" onClick={saveSharedNote} disabled={noteSaving} style={{ ...primaryButton, opacity: noteSaving ? 0.6 : 1 }}>
                    {noteSaving ? "Saving..." : "Save Note"}
                  </button>
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 12, maxHeight: 260, overflow: "auto" }}>
                  {sharedNotes.map(note => (
                    <div key={note.id} style={noteItem}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{note.actor}</strong>
                        <span style={miniLabel}>{note.source} · {formatDate(note.at)}</span>
                      </div>
                      <p style={{ ...bodyText, marginTop: 6 }}>{note.body}</p>
                    </div>
                  ))}
                  {sharedNotes.length === 0 && <p style={bodyText}>No shared notes yet.</p>}
                </div>
              </section>
              )}

              {activeSection === "calculator" && (
              <section style={panel}>
                <p style={eyebrowSmall}>Calculator + decision packet</p>
                <h2 style={sectionTitle}>{analysis?.recommendation || "Calculator starts after conversion"}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }} className="number-grid">
                  <MiniStat label="Asking" value={money(selectedDeal?.asking_price ?? selectedLead?.asking_price)} />
                  <MiniStat label="Target resale" value={money(analysis?.disposition.targetResale ?? selectedDeal?.target_resale_price ?? selectedLead?.market_value)} />
                  <MiniStat label="Recommended offer" value={money(analysis?.acquisition.recommendedOffer)} />
                  <MiniStat label="Max offer" value={money(analysis?.acquisition.maxOffer)} />
                  <MiniStat label="Spread @ ask" value={money(analysis?.acquisition.projectedSpreadAtAsk)} />
                  <MiniStat label="Minimum sale" value={money(analysis?.disposition.minimumAcceptable)} />
                  <MiniStat label="Exit confidence" value={analysis?.disposition.exitConfidence || "N/A"} />
                  <MiniStat label="Status" value={statusLabel(selectedDeal?.disposition_status)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }} className="two-col">
                  <InfoBlock title="Missing or risky">
                    {(analysis?.missingInfo.length ? analysis.missingInfo : ["No calculator issues available yet."]).map(item => <p key={item} style={bodyText}>• {item}</p>)}
                    {analysis?.riskFlags.map(item => <p key={item} style={bodyText}>• {item}</p>)}
                  </InfoBlock>
                  <InfoBlock title="Diligence">
                    <p style={bodyText}>{checklist.length ? `${clearedChecklist} of ${checklist.length} checklist items cleared.` : "Checklist will appear after a deal brief is saved."}</p>
                    <p style={{ ...bodyText, marginTop: 6 }}>{attachments.length} research attachment{attachments.length === 1 ? "" : "s"} linked.</p>
                    <p style={{ ...bodyText, marginTop: 6 }}>Agreement: {agreement ? statusLabel(agreement.status) : "Not started"}</p>
                  </InfoBlock>
                </div>
              </section>
              )}

              {activeSection === "timeline" && (
              <section style={panel}>
                <p style={eyebrowSmall}>Communication + activity timeline</p>
                <h2 style={sectionTitle}>What happened so far</h2>
                <div style={{ marginTop: 12 }}>
                  <ConversationPanel
                    eyebrow="Shared timeline"
                    title="Conversation panel"
                    subject={selectedDeal?.seller_phone || selectedLead?.phone || selectedLead?.phone_2 || "No seller phone"}
                    communications={communications}
                    activities={conversationActivities}
                    emptyText="No activity has been logged yet."
                    maxHeight={420}
                  />
                </div>
              </section>
              )}

              {activeSection === "review" && (
              <section style={panel}>
                <p style={eyebrowSmall}>Member review packet</p>
                <h2 style={sectionTitle}>Votes, agreement, and diligence</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }} className="number-grid">
                  <MiniStat label="Votes" value={votes.length ? `${approvedVotes}/${votes.length} support` : "No votes"} />
                  <MiniStat label="Checklist" value={checklist.length ? `${clearedChecklist}/${checklist.length} cleared` : "Not started"} />
                  <MiniStat label="Agreement" value={agreement ? statusLabel(agreement.status) : "Not started"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }} className="two-col">
                  <InfoBlock title="Member votes">
                    {votes.map(vote => (
                      <p key={vote.id} style={bodyText}>
                        <strong>{vote.member_name}</strong>: {statusLabel(vote.vote)}{vote.note ? ` - ${vote.note}` : ""}
                      </p>
                    ))}
                    {votes.length === 0 && <p style={bodyText}>No member votes yet.</p>}
                  </InfoBlock>
                  <InfoBlock title="Checklist blockers">
                    {checklist.filter(item => item.status === "blocked").map(item => (
                      <p key={item.id} style={bodyText}>• {item.title}</p>
                    ))}
                    {checklist.filter(item => item.status === "blocked").length === 0 && (
                      <p style={bodyText}>{checklist.length ? "No blocked diligence items." : "No checklist has been generated yet."}</p>
                    )}
                  </InfoBlock>
                </div>
                <div style={{ ...subPanel, marginTop: 12 }}>
                  <p style={eyebrowSmall}>Agreement status</p>
                  <p style={bodyText}>
                    {agreement
                      ? `${statusLabel(agreement.status)}. Offer authority ${money(agreement.offer_authority)}. Capital needed ${money(agreement.capital_needed)}.`
                      : "Deal-specific agreement terms have not been saved yet."}
                  </p>
                </div>
              </section>
              )}
            </main>

            <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <section style={darkPanel}>
                <p style={{ ...eyebrowSmall, color: "var(--brass)" }}>Next best action</p>
                <h3 style={{ fontFamily: DISPLAY_FONT, color: "var(--bone)", fontSize: 24, fontWeight: 500, marginTop: 6 }}>
                  {nextWorkflowAction?.title || "Choose the next stage"}
                </h3>
                <p style={{ color: "rgba(247,242,232,0.72)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                  {nextWorkflowAction?.detail || "Use the calculator and communication history to decide whether to submit, pass, or launch disposition."}
                </p>
                {nextWorkflowAction && (
                  <button
                    type="button"
                    onClick={() => setActiveSection(nextWorkflowAction.target === "communications" ? "timeline" : nextWorkflowAction.target === "vote" || nextWorkflowAction.target === "agreement" || nextWorkflowAction.target === "diligence" ? "review" : nextWorkflowAction.target === "packet" ? "overview" : "calculator")}
                    style={{ ...primaryButton, background: "var(--bone)", borderColor: "var(--bone)", color: "var(--obsidian)", marginTop: 12 }}
                  >
                    {nextWorkflowAction.primary}
                  </button>
                )}
              </section>

              <section style={panel}>
                <p style={eyebrowSmall}>Quick actions</p>
                <h3 style={smallHeading}>Move this file forward</h3>
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {quickActions.map(action => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      style={{
                        ...quickActionButton,
                        opacity: action.disabled ? 0.52 : 1,
                        cursor: action.disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <span>{action.label}</span>
                      <small>{action.detail}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 8 }}>
                  <div>
                    <p style={eyebrowSmall}>Text seller</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>Send from this file</h3>
                  </div>
                  <span style={pill}>{sellerPhone || "No phone"}</span>
                </div>
                <textarea
                  id="opportunity-sms"
                  rows={4}
                  value={smsDraft}
                  onChange={e => setSmsDraft(e.target.value)}
                  placeholder="Type the SMS to send through Sakari."
                  disabled={!sellerPhone}
                  style={textareaStyle}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{smsDraft.trim().length} chars</span>
                  <button
                    onClick={sendOpportunitySms}
                    disabled={smsDisabled}
                    style={{ ...primaryButton, opacity: smsDisabled ? 0.6 : 1 }}
                  >
                    {smsSending ? "Sending..." : "Send SMS"}
                  </button>
                </div>
                {selectedLead?.sms_opt_status === "opted-out" && <p style={{ ...bodyText, color: "#8d3f31", marginTop: 8 }}>Seller opted out. Do not text.</p>}
                {smsMessage && <p style={{ ...bodyText, marginTop: 8 }}>{smsMessage}</p>}
                {communications[0] && (
                  <div style={{ borderTop: "1px solid var(--fog)", marginTop: 10, paddingTop: 10 }}>
                    <p style={miniLabel}>Latest message</p>
                    <p style={{ ...bodyText, marginTop: 5 }}>{communications[0].body || communications[0].status || communications[0].provider_event_type}</p>
                  </div>
                )}
              </section>

              <CrmList title="Buyer matches" empty="No buyer matches yet." items={matchedBuyers} render={buyer => (
                <>
                  <strong>{buyer.buyer_name}</strong>
                  <span>{buyer.markets.join(", ") || buyer.buyer_type || "Market pending"}</span>
                  <span>Max {money(buyer.max_price)} · {statusLabel(buyer.relationship_strength)}</span>
                </>
              )} />

              <CrmList title="Disposition campaigns" empty="No campaign started yet." items={relatedCampaigns} render={campaign => (
                <>
                  <strong>{campaign.campaign_name}</strong>
                  <span>{statusLabel(campaign.status)} · Target {money(campaign.target_price)}</span>
                  <span>{campaign.owner || "Owner pending"}</span>
                </>
              )} />

              <CrmList title="Offers" empty="No buyer offers recorded yet." items={relatedOffers} render={offer => (
                <>
                  <strong>{offer.buyer_name}</strong>
                  <span>{money(offer.offer_amount)} · {statusLabel(offer.status)}</span>
                  <span>{offer.close_date ? `Close ${formatDate(offer.close_date)}` : "Close date pending"}</span>
                </>
              )} />

              <CrmList title="Member votes" empty="No member votes yet." items={votes} render={vote => (
                <>
                  <strong>{vote.member_name}</strong>
                  <span>{statusLabel(vote.vote)}</span>
                  <span>{vote.note || "No note"}</span>
                </>
              )} />
            </aside>
          </div>
          </>
        )}
      </div>
      <style jsx global>{`
        .opportunity-page button { font: inherit; }
        .opportunity-decision-path {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 14px;
        }
        .opportunity-path-card {
          appearance: none;
          background: rgba(255, 252, 245, 0.78);
          border: 1px solid var(--fog);
          border-radius: 8px;
          color: var(--ink);
          cursor: pointer;
          min-height: 128px;
          padding: 14px;
          text-align: left;
          transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
        }
        .opportunity-path-card:hover {
          border-color: rgba(176, 137, 84, 0.55);
          transform: translateY(-1px);
        }
        .opportunity-path-card.active {
          background: rgba(176, 137, 84, 0.12);
          border-color: var(--brass);
        }
        .opportunity-path-card.done {
          border-color: rgba(176, 137, 84, 0.42);
        }
        .opportunity-path-card.open {
          opacity: 0.78;
        }
        .opportunity-path-card span {
          color: var(--brass);
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .opportunity-path-card strong {
          color: var(--obsidian);
          display: block;
          font-size: 14px;
          line-height: 1.28;
          margin-bottom: 8px;
        }
        .opportunity-path-card p {
          color: var(--ink);
          font-size: 12px;
          line-height: 1.42;
          opacity: 0.68;
        }
        .file-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 0 0 12px;
          margin: -2px 0 8px;
          scrollbar-width: thin;
        }
        @media (max-width: 1080px) {
          .opportunity-grid { grid-template-columns: 1fr !important; }
          .topbar { grid-template-columns: 1fr !important; }
          .opportunity-decision-path { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .summary-strip, .two-col, .number-grid { grid-template-columns: 1fr !important; }
          .opportunity-decision-path { grid-template-columns: 1fr !important; }
          .notes-header, .note-actions { display: grid !important; justify-content: stretch !important; }
        }
      `}</style>
    </div>
  );
}

function FileTabButton({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 40,
        border: active ? "1px solid var(--obsidian)" : "1px solid var(--fog)",
        borderRadius: 999,
        background: active ? "var(--obsidian)" : "rgba(255,252,245,0.78)",
        color: active ? "var(--bone)" : "var(--ink)",
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      {label}
      {typeof count === "number" && (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 22,
          height: 22,
          borderRadius: 999,
          background: active ? "rgba(237,230,214,0.16)" : "var(--bone)",
          color: active ? "var(--bone)" : "var(--muted)",
          fontSize: 10,
          letterSpacing: 0,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function SummaryMetric({ label, value, tone = "calm" }: { label: string; value: string; tone?: "calm" | "hot" }) {
  return (
    <div style={{ borderRight: "1px solid rgba(247,242,232,0.14)", padding: "2px 14px" }}>
      <p style={{ ...miniLabel, color: "rgba(247,242,232,0.58)" }}>{label}</p>
      <strong style={{ display: "block", color: tone === "hot" ? "var(--brass)" : "var(--bone)", fontSize: 18, marginTop: 5 }}>{value}</strong>
    </div>
  );
}

function PathStep({ label, detail, state }: { label: string; detail: string; state: "done" | "active" | "open" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 8, alignItems: "start" }}>
      <span style={{ width: 14, height: 14, borderRadius: 999, marginTop: 3, background: state === "done" ? "var(--brass)" : state === "active" ? "var(--obsidian)" : "transparent", border: state === "open" ? "1px solid var(--fog)" : "1px solid transparent" }} />
      <div>
        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{label}</strong>
        <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>{detail}</p>
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={subPanel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 5, marginTop: 8 }}>{children}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>
      <span>{label}</span>
      <strong style={{ color: "var(--obsidian)", textAlign: "right", fontWeight: 700 }}>{value}</strong>
    </p>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={subPanel}>
      <p style={miniLabel}>{label}</p>
      <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{value}</strong>
    </div>
  );
}

function CrmList<T extends { id: string }>({ title, items, empty, render }: { title: string; items: T[]; empty: string; render: (item: T) => React.ReactNode }) {
  return (
    <section style={panel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: "grid", gap: 3, borderBottom: "1px solid var(--fog)", paddingBottom: 8, color: "var(--muted)", fontSize: 12 }}>
            {render(item)}
          </div>
        ))}
        {items.length === 0 && <p style={bodyText}>{empty}</p>}
      </div>
    </section>
  );
}

const summaryStrip: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", background: "var(--obsidian)", border: "1px solid rgba(20,17,13,0.86)", borderRadius: 8, padding: "14px 2px", marginBottom: 14, boxShadow: "0 14px 36px rgba(20,17,13,0.13)" };
const panel: React.CSSProperties = { background: "rgba(255,252,245,0.78)", border: "1px solid var(--fog)", borderRadius: 8, padding: 14, boxShadow: "0 10px 28px rgba(20,17,13,0.06)" };
const subPanel: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 };
const darkPanel: React.CSSProperties = { background: "linear-gradient(180deg, #1b1712 0%, #2c241a 100%)", border: "1px solid rgba(27,23,18,0.8)", borderRadius: 8, padding: 14, boxShadow: "0 16px 34px rgba(20,17,13,0.16)" };
const noteItem: React.CSSProperties = { border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" };
const noteTextarea: React.CSSProperties = { width: "100%", minHeight: 112, resize: "vertical", border: "1px solid var(--fog)", borderRadius: 8, background: "var(--surface)", color: "var(--obsidian)", padding: 12, font: "inherit", fontSize: 13, lineHeight: 1.5, outline: "none" };
const bodyText: React.CSSProperties = { color: "var(--ink)", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" };
const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 700, marginBottom: 8 };
const eyebrowSmall: React.CSSProperties = { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brass)", fontWeight: 700 };
const miniLabel: React.CSSProperties = { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 };
const sectionTitle: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0 };
const smallHeading: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0, marginTop: 3 };
const pill: React.CSSProperties = { border: "1px solid var(--fog)", borderRadius: 999, color: "var(--muted)", fontSize: 10, fontWeight: 800, padding: "5px 8px", textTransform: "uppercase", letterSpacing: "0.08em", background: "var(--surface)" };
const hotPill: React.CSSProperties = { ...pill, color: "var(--obsidian)", borderColor: "rgba(176,137,84,0.5)", background: "rgba(176,137,84,0.14)" };
const primaryButton: React.CSSProperties = { border: "1px solid var(--obsidian)", background: "var(--obsidian)", color: "var(--bone)", borderRadius: 8, padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", textDecoration: "none" };
const secondaryButton: React.CSSProperties = { border: "1px solid var(--fog)", background: "var(--surface)", color: "var(--obsidian)", borderRadius: 8, padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", textDecoration: "none" };
const textareaStyle: React.CSSProperties = { width: "100%", minHeight: 104, border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", color: "var(--ink)", fontSize: 13, lineHeight: 1.45, resize: "vertical", fontFamily: "var(--font-body)" };
const quickActionButton: React.CSSProperties = { appearance: "none", border: "1px solid var(--fog)", borderRadius: 8, background: "rgba(255,252,245,0.82)", color: "var(--obsidian)", padding: "10px 11px", textAlign: "left", display: "grid", gap: 4 };
