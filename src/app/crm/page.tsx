"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateDealAnalysis } from "@/lib/deals";
import {
  createBuyerOffer,
  createCrmBuyer,
  createCrmContact,
  createDispositionCampaign,
  fetchCrmDashboardData,
  type CrmDashboardData,
  type CrmContactType,
} from "@/lib/crm";
import type { CommunicationEvent } from "@/lib/communications";

const DISPLAY_FONT = "var(--font-display)";
type CrmView = "inbox" | "deals" | "buyers" | "dispo" | "records";

const EMPTY_DATA: CrmDashboardData = {
  deals: [],
  contacts: [],
  properties: [],
  buyers: [],
  campaigns: [],
  offers: [],
  communications: [],
  templates: [],
};

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

function statusLabel(value: string): string {
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function CrmPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [data, setData] = useState<CrmDashboardData>(EMPTY_DATA);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [view, setView] = useState<CrmView>("inbox");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [contactDraft, setContactDraft] = useState({ contact_type: "seller" as CrmContactType, display_name: "", phone: "", email: "", county: "", tags: "", notes: "" });
  const [buyerDraft, setBuyerDraft] = useState({ buyer_name: "", buyer_type: "", markets: "", max_price: "", buy_box: "", notes: "" });
  const [campaignDraft, setCampaignDraft] = useState({ campaign_name: "", owner: "", notes: "" });
  const [offerDraft, setOfferDraft] = useState({ buyer_name: "", offer_amount: "", earnest_money: "", close_date: "", notes: "" });

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchCrmDashboardData();
    setData(rows);
    setSelectedDealId(prev => prev && rows.deals.some(deal => deal.id === prev) ? prev : rows.deals[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const current = localStorage.getItem("meridian_user");
    if (!current) { router.push("/"); return; }
    setUser(current);
    void reload();
  }, [router, reload]);

  const selectedDeal = useMemo(() => data.deals.find(deal => deal.id === selectedDealId) ?? data.deals[0] ?? null, [data.deals, selectedDealId]);
  const selectedAnalysis = useMemo(() => selectedDeal ? calculateDealAnalysis(selectedDeal) : null, [selectedDeal]);
  const unmatchedMessages = useMemo(() => data.communications.filter(event => event.direction === "inbound" && !event.matched_deal_id && !event.matched_lead_id), [data.communications]);
  const hotDeals = useMemo(() => data.deals.filter(deal => deal.urgency === "hot" || deal.analysis.recommendation === "Strong Review"), [data.deals]);
  const selectedCampaigns = useMemo(() => selectedDeal ? data.campaigns.filter(campaign => campaign.deal_id === selectedDeal.id) : [], [data.campaigns, selectedDeal]);

  if (!user) return null;

  const createContact = async () => {
    const { error } = await createCrmContact(contactDraft, user);
    if (error) { setMessage(error); return; }
    setContactDraft({ contact_type: "seller", display_name: "", phone: "", email: "", county: "", tags: "", notes: "" });
    setMessage("Contact created.");
    await reload();
  };

  const createBuyer = async () => {
    const { error } = await createCrmBuyer({ ...buyerDraft, max_price: buyerDraft.max_price ? Number(buyerDraft.max_price) : null }, user);
    if (error) { setMessage(error); return; }
    setBuyerDraft({ buyer_name: "", buyer_type: "", markets: "", max_price: "", buy_box: "", notes: "" });
    setMessage("Buyer created.");
    await reload();
  };

  const createCampaign = async () => {
    if (!selectedDeal) { setMessage("Select a deal first."); return; }
    const { error } = await createDispositionCampaign({
      deal_id: selectedDeal.id,
      campaign_name: campaignDraft.campaign_name || `${selectedDeal.title} disposition`,
      exit_strategy: selectedDeal.exit_strategy,
      target_buyer_type: selectedDeal.target_buyer_type,
      target_price: selectedDeal.target_resale_price ?? selectedDeal.arv ?? null,
      minimum_price: selectedDeal.minimum_acceptable_price ?? null,
      owner: campaignDraft.owner || user,
      notes: campaignDraft.notes,
    }, user);
    if (error) { setMessage(error); return; }
    setCampaignDraft({ campaign_name: "", owner: "", notes: "" });
    setMessage("Disposition campaign created.");
    await reload();
  };

  const createOffer = async () => {
    if (!selectedDeal) { setMessage("Select a deal first."); return; }
    const campaign = selectedCampaigns[0];
    const { error } = await createBuyerOffer({
      deal_id: selectedDeal.id,
      disposition_campaign_id: campaign?.id ?? null,
      buyer_name: offerDraft.buyer_name,
      offer_amount: offerDraft.offer_amount ? Number(offerDraft.offer_amount) : null,
      earnest_money: offerDraft.earnest_money ? Number(offerDraft.earnest_money) : null,
      close_date: offerDraft.close_date || null,
      notes: offerDraft.notes,
    }, user);
    if (error) { setMessage(error); return; }
    setOfferDraft({ buyer_name: "", offer_amount: "", earnest_money: "", close_date: "", notes: "" });
    setMessage("Buyer offer recorded.");
    await reload();
  };

  const views: Array<{ id: CrmView; label: string; detail: string; count: number }> = [
    { id: "inbox", label: "Inbox", detail: "Seller replies and unmatched messages", count: unmatchedMessages.length },
    { id: "deals", label: "Deals", detail: "Packets, votes, calculators, approvals", count: data.deals.length },
    { id: "buyers", label: "Buyers", detail: "Buyer demand and buy boxes", count: data.buyers.length },
    { id: "dispo", label: "Dispo", detail: "Campaigns, offers, exit tracking", count: data.campaigns.length + data.offers.length },
    { id: "records", label: "Records", detail: "Contacts and property records", count: data.contacts.length + data.properties.length },
  ];

  const workSummary = [
    { label: "Deals", value: String(data.deals.length), sub: `${hotDeals.length} hot`, tone: hotDeals.length ? "hot" as const : "calm" as const },
    { label: "Inbox", value: String(unmatchedMessages.length), sub: "unmatched SMS", tone: unmatchedMessages.length ? "hot" as const : "calm" as const },
    { label: "Buyers", value: String(data.buyers.length), sub: "active records" },
    { label: "Campaigns", value: String(data.campaigns.length), sub: `${data.offers.length} offers` },
  ];

  const renderDealRows = (limit = 12) => (
    <div style={stack}>
      {data.deals.slice(0, limit).map(deal => (
        <button key={deal.id} onClick={() => setSelectedDealId(deal.id)} style={{ ...workRow, borderColor: selectedDeal?.id === deal.id ? "var(--brass)" : "var(--fog)" }}>
          <span style={rowTop}>
            <strong style={rowTitle}>{deal.title}</strong>
            <span style={pill}>{deal.analysis.recommendation}</span>
          </span>
          <span style={rowMeta}>{deal.address || deal.parcel_id || "Location pending"}</span>
          <span style={rowMeta}>{deal.analysis.disposition.exitConfidence} exit confidence · {money(deal.analysis.acquisition.recommendedOffer)} target offer</span>
        </button>
      ))}
      {data.deals.length === 0 && (
        <EmptyState
          title="No deal packets yet"
          body="Once the VA imports lists, logs interested sellers, or submits deal briefs, this becomes the live packet queue for member review."
          actionLabel="Open VA imports"
          onAction={() => router.push("/va")}
        />
      )}
    </div>
  );

  const renderWorkspace = () => {
    if (view === "inbox") {
      return (
        <WorkspacePanel title="Seller inbox" eyebrow="Needs review" action={<button onClick={reload} style={secondaryButton}>{loading ? "Loading" : "Refresh"}</button>}>
          <div style={stack}>
            {unmatchedMessages.slice(0, 16).map(event => <MessageCard key={event.id} event={event} />)}
            {unmatchedMessages.length === 0 && (
              <EmptyState
                title="No unmatched seller replies"
                body="Inbound Sakari messages that cannot be matched to a list lead or deal will land here so the VA can create or connect the right record."
                actionLabel="Open VA desk"
                onAction={() => router.push("/va")}
              />
            )}
          </div>
        </WorkspacePanel>
      );
    }

    if (view === "buyers") {
      return (
        <WorkspacePanel title="Buyer demand" eyebrow="Buy boxes">
          <div style={recordGrid}>
            {data.buyers.map(buyer => (
              <RecordCard key={buyer.id} title={buyer.buyer_name} meta={buyer.markets.join(", ") || buyer.buyer_type || "Market pending"}>
                <span>Max: {money(buyer.max_price)}</span>
                <span>{statusLabel(buyer.relationship_strength)} · POF {statusLabel(buyer.proof_of_funds_status)}</span>
                <span>{buyer.buy_box || "Buy box needs detail."}</span>
              </RecordCard>
            ))}
            {data.buyers.length === 0 && (
              <EmptyState title="No buyers loaded" body="Add repeat buyers here so disposition campaigns can match each deal to real demand instead of starting from scratch." />
            )}
          </div>
        </WorkspacePanel>
      );
    }

    if (view === "dispo") {
      return (
        <WorkspacePanel title="Disposition board" eyebrow="Campaigns + offers">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
            <CrmList title="Campaigns" items={data.campaigns} render={campaign => (
              <>
                <strong>{campaign.campaign_name}</strong>
                <span>{statusLabel(campaign.status)} · Target {money(campaign.target_price)}</span>
                <span>{campaign.owner || "Owner pending"}</span>
              </>
            )} />
            <CrmList title="Offers" items={data.offers} render={offer => (
              <>
                <strong>{offer.buyer_name}</strong>
                <span>{money(offer.offer_amount)} · {statusLabel(offer.status)}</span>
                <span>{offer.close_date ? `Close ${formatDate(offer.close_date)}` : "Close date pending"}</span>
              </>
            )} />
          </div>
        </WorkspacePanel>
      );
    }

    if (view === "records") {
      return (
        <WorkspacePanel title="CRM records" eyebrow="Contacts + properties">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
            <CrmList title="Contacts" items={data.contacts} render={contact => (
              <>
                <strong>{contact.display_name}</strong>
                <span>{statusLabel(contact.contact_type)} · {contact.phone || contact.email || "No phone/email"}</span>
                <span>{contact.county || "County pending"} · SMS {statusLabel(contact.sms_opt_status)}</span>
              </>
            )} />
            <CrmList title="Properties" items={data.properties} render={property => (
              <>
                <strong>{property.address || property.parcel_id || "Property record"}</strong>
                <span>{property.county || "County pending"} · {property.acreage ?? "N/A"} acres</span>
                <span>{property.zoning || property.land_use || "Use pending"}</span>
              </>
            )} />
          </div>
        </WorkspacePanel>
      );
    }

    return (
      <WorkspacePanel title="Deal packets" eyebrow="Member review queue">
        {renderDealRows(16)}
      </WorkspacePanel>
    );
  };

  const renderRightRail = () => (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {selectedDeal && selectedAnalysis ? (
        <div style={darkPanel}>
          <p style={{ ...eyebrowSmall, color: "var(--brass)" }}>Selected packet</p>
          <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 24, fontWeight: 500, color: "var(--bone)", marginTop: 6 }}>{selectedDeal.title}</h3>
          <p style={{ color: "rgba(247,242,232,0.72)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{selectedDeal.address || selectedDeal.parcel_id || "Location pending"}</p>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <DecisionMetric label="Offer target" value={money(selectedAnalysis.acquisition.recommendedOffer)} />
            <DecisionMetric label="Max offer" value={money(selectedAnalysis.acquisition.maxOffer)} />
            <DecisionMetric label="Exit target" value={money(selectedAnalysis.disposition.targetResale)} />
            <DecisionMetric label="Confidence" value={selectedAnalysis.disposition.exitConfidence} />
          </div>
          <button onClick={() => router.push(`/opportunity?deal=${selectedDeal.id}`)} style={{ ...primaryButton, width: "100%", marginTop: 14, background: "var(--bone)", color: "var(--obsidian)", borderColor: "var(--bone)" }}>Open shared file</button>
        </div>
      ) : (
        <div style={panel}>
          <p style={eyebrowSmall}>Start here</p>
          <h3 style={smallHeading}>Build the queue</h3>
          <p style={bodyText}>Import a list, connect inbound replies, or have the VA submit a deal brief. The CRM will organize the packet from there.</p>
        </div>
      )}

      {(view === "buyers" || view === "records") && (
        <QuickCreate title="New buyer">
          <input placeholder="Buyer name" value={buyerDraft.buyer_name} onChange={e => setBuyerDraft({ ...buyerDraft, buyer_name: e.target.value })} />
          <input placeholder="Buyer type" value={buyerDraft.buyer_type} onChange={e => setBuyerDraft({ ...buyerDraft, buyer_type: e.target.value })} />
          <input placeholder="Markets, comma separated" value={buyerDraft.markets} onChange={e => setBuyerDraft({ ...buyerDraft, markets: e.target.value })} />
          <input placeholder="Max price" value={buyerDraft.max_price} onChange={e => setBuyerDraft({ ...buyerDraft, max_price: e.target.value })} />
          <textarea rows={3} placeholder="Buy box" value={buyerDraft.buy_box} onChange={e => setBuyerDraft({ ...buyerDraft, buy_box: e.target.value })} />
          <button onClick={createBuyer} style={primaryButton}>Create Buyer</button>
        </QuickCreate>
      )}

      {(view === "dispo" || view === "deals") && selectedDeal && (
        <>
          <QuickCreate title="Disposition campaign">
            <input placeholder={`${selectedDeal.title} disposition`} value={campaignDraft.campaign_name} onChange={e => setCampaignDraft({ ...campaignDraft, campaign_name: e.target.value })} />
            <input placeholder="Owner" value={campaignDraft.owner} onChange={e => setCampaignDraft({ ...campaignDraft, owner: e.target.value })} />
            <textarea rows={3} placeholder="Campaign notes" value={campaignDraft.notes} onChange={e => setCampaignDraft({ ...campaignDraft, notes: e.target.value })} />
            <button onClick={createCampaign} style={primaryButton}>Create Campaign</button>
          </QuickCreate>
          <QuickCreate title="Buyer offer">
            <input placeholder="Buyer name" value={offerDraft.buyer_name} onChange={e => setOfferDraft({ ...offerDraft, buyer_name: e.target.value })} />
            <input placeholder="Offer amount" value={offerDraft.offer_amount} onChange={e => setOfferDraft({ ...offerDraft, offer_amount: e.target.value })} />
            <input placeholder="Earnest money" value={offerDraft.earnest_money} onChange={e => setOfferDraft({ ...offerDraft, earnest_money: e.target.value })} />
            <input type="date" value={offerDraft.close_date} onChange={e => setOfferDraft({ ...offerDraft, close_date: e.target.value })} />
            <textarea rows={2} placeholder="Offer notes" value={offerDraft.notes} onChange={e => setOfferDraft({ ...offerDraft, notes: e.target.value })} />
            <button onClick={createOffer} style={primaryButton}>Record Offer</button>
          </QuickCreate>
        </>
      )}

      {view === "records" && (
        <QuickCreate title="New contact">
          <select value={contactDraft.contact_type} onChange={e => setContactDraft({ ...contactDraft, contact_type: e.target.value as CrmContactType })}>
            {["seller", "buyer", "agent", "broker", "builder", "neighbor", "title", "lender", "vendor", "member", "other"].map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}
          </select>
          <input placeholder="Display name" value={contactDraft.display_name} onChange={e => setContactDraft({ ...contactDraft, display_name: e.target.value })} />
          <input placeholder="Phone" value={contactDraft.phone} onChange={e => setContactDraft({ ...contactDraft, phone: e.target.value })} />
          <input placeholder="Email" value={contactDraft.email} onChange={e => setContactDraft({ ...contactDraft, email: e.target.value })} />
          <input placeholder="County" value={contactDraft.county} onChange={e => setContactDraft({ ...contactDraft, county: e.target.value })} />
          <button onClick={createContact} style={primaryButton}>Create Contact</button>
        </QuickCreate>
      )}
    </aside>
  );

  return (
    <div className="crm-page" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8f2e7 0%, #efe6d6 100%)", padding: "72px 20px 80px", color: "var(--ink)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 18, alignItems: "end", marginBottom: 16 }} className="topbar">
          <div>
            <p style={eyebrow}>Meridian CRM</p>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 0.95, fontWeight: 500, color: "var(--obsidian)", letterSpacing: 0 }}>
              CRM command center
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 720, marginTop: 8 }}>
              Seller replies, deal packets, buyer demand, dispositions, offers, and records in one working system.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/va")} style={secondaryButton}>VA desk</button>
            <button onClick={() => router.push("/deals")} style={primaryButton}>Deal desk</button>
          </div>
        </header>

        {message && <div style={{ ...panel, marginBottom: 12, borderColor: "var(--brass)" }}>{message}</div>}

        <section style={summaryStrip} className="summary-strip">
          {workSummary.map(item => <SummaryStat key={item.label} {...item} />)}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "270px minmax(0, 1fr) 320px", gap: 14 }} className="crm-grid">
          <aside style={navPanel}>
            <div style={{ marginBottom: 12 }}>
              <p style={eyebrowSmall}>Workspace</p>
              <h2 style={smallHeading}>What are we working?</h2>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {views.map(item => (
                <button key={item.id} onClick={() => setView(item.id)} style={view === item.id ? activeViewButton : viewButton}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong>{item.label}</strong>
                    <span style={countBadge}>{item.count}</span>
                  </span>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
            <div style={{ ...subPanel, marginTop: 14 }}>
              <p style={eyebrowSmall}>Next best action</p>
              <p style={{ ...bodyText, marginTop: 6 }}>
                {view === "inbox" ? "Clear unmatched messages first so interested sellers become searchable leads or deal packets." :
                  view === "buyers" ? "Add buyer criteria before launching disposition campaigns so offers have context." :
                  view === "dispo" ? "Create campaigns from approved packets, then track every buyer response and offer." :
                  view === "records" ? "Keep people and properties clean so the VA does not re-enter the same data." :
                  "Use calculators and communication history before sending packets for member approval."}
              </p>
            </div>
          </aside>

          {renderWorkspace()}
          {renderRightRail()}
        </section>
      </div>
      <style jsx global>{`
        .crm-page input,
        .crm-page select,
        .crm-page textarea {
          width: 100%;
          border: 1px solid var(--fog);
          border-radius: 8px;
          background: rgba(255, 252, 245, 0.88);
          color: var(--obsidian);
          font: inherit;
          font-size: 13px;
          padding: 10px 11px;
          outline: none;
        }
        .crm-page textarea { resize: vertical; min-height: 76px; }
        .crm-page input:focus,
        .crm-page select:focus,
        .crm-page textarea:focus {
          border-color: var(--brass);
          box-shadow: 0 0 0 3px rgba(176, 137, 84, 0.14);
        }
        .crm-page button { font: inherit; }
        .crm-page button:focus { outline: none; }
        .crm-page button:focus-visible {
          box-shadow: 0 0 0 3px rgba(176, 137, 84, 0.22);
        }
        @media (max-width: 1050px) {
          .crm-grid { grid-template-columns: 1fr !important; }
          .topbar { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .summary-strip, .two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function SummaryStat({ label, value, sub, tone = "calm" }: { label: string; value: string; sub: string; tone?: "calm" | "hot" }) {
  return (
    <div style={{ borderRight: "1px solid rgba(247,242,232,0.16)", padding: "2px 16px" }}>
      <p style={{ ...miniLabel, color: "rgba(247,242,232,0.58)" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 5 }}>
        <strong style={{ color: tone === "hot" ? "var(--brass)" : "var(--bone)", fontSize: 26, lineHeight: 1 }}>{value}</strong>
        <span style={{ color: "rgba(247,242,232,0.62)", fontSize: 12 }}>{sub}</span>
      </div>
    </div>
  );
}

function WorkspacePanel({ title, eyebrow: label, action, children }: { title: string; eyebrow: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div>
          <p style={eyebrowSmall}>{label}</p>
          <h2 style={sectionTitle}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </main>
  );
}

function EmptyState({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={{ ...subPanel, minHeight: 180, display: "grid", alignContent: "center", justifyItems: "start" }}>
      <p style={eyebrowSmall}>Empty</p>
      <h3 style={smallHeading}>{title}</h3>
      <p style={{ ...bodyText, maxWidth: 560, marginTop: 5 }}>{body}</p>
      {actionLabel && onAction && <button onClick={onAction} style={{ ...secondaryButton, marginTop: 12 }}>{actionLabel}</button>}
    </div>
  );
}

function RecordCard({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div style={subPanel}>
      <strong style={rowTitle}>{title}</strong>
      <p style={{ ...rowMeta, marginTop: 4 }}>{meta}</p>
      <div style={{ display: "grid", gap: 4, marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{children}</div>
    </div>
  );
}

function DecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid rgba(247,242,232,0.14)", paddingBottom: 7 }}>
      <span style={{ color: "rgba(247,242,232,0.58)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      <strong style={{ color: "var(--bone)", fontSize: 13 }}>{value}</strong>
    </div>
  );
}

function MessageCard({ event, compact = false }: { event: CommunicationEvent; compact?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--fog)", borderRadius: 8, background: event.direction === "inbound" ? "rgba(176,137,84,0.08)" : "var(--surface)", padding: compact ? 8 : 10 }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: "var(--obsidian)", marginBottom: 4 }}>
        {event.contact_name || event.contact_number || event.from_number || "Unknown"} · {event.direction}
      </p>
      <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>{event.body || event.status || event.provider_event_type}</p>
      <p style={{ ...miniLabel, marginTop: 6 }}>{formatDate(event.provider_created_at || event.created_at)}</p>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>{children}</p>;
}

function QuickCreate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{children}</div>
    </div>
  );
}

function CrmList<T extends { id: string }>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {items.map(item => (
          <div key={item.id} style={{ borderBottom: "1px solid var(--fog)", paddingBottom: 8, display: "grid", gap: 3, fontSize: 12, color: "var(--muted)" }}>
            {render(item)}
          </div>
        ))}
        {items.length === 0 && <EmptyText>Nothing here yet.</EmptyText>}
      </div>
    </div>
  );
}

const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, maxHeight: 760, overflow: "auto" };
const bodyText: React.CSSProperties = { color: "var(--ink)", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" };
const panel: React.CSSProperties = { background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 14, boxShadow: "0 10px 28px rgba(20,17,13,0.06)" };
const navPanel: React.CSSProperties = { ...panel, background: "rgba(255,252,245,0.72)", boxShadow: "0 12px 34px rgba(20,17,13,0.08)" };
const subPanel: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 };
const darkPanel: React.CSSProperties = { background: "linear-gradient(180deg, #1b1712 0%, #2c241a 100%)", border: "1px solid rgba(27,23,18,0.8)", borderRadius: 8, padding: 14, boxShadow: "0 16px 34px rgba(20,17,13,0.16)" };
const summaryStrip: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, background: "var(--obsidian)", border: "1px solid rgba(20,17,13,0.86)", borderRadius: 8, padding: "14px 2px", marginBottom: 14, boxShadow: "0 14px 36px rgba(20,17,13,0.13)" };
const recordGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 };
const workRow: React.CSSProperties = { background: "rgba(255,252,245,0.78)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12, cursor: "pointer", display: "grid", gap: 6, textAlign: "left", boxShadow: "0 8px 18px rgba(20,17,13,0.04)" };
const rowTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const rowTitle: React.CSSProperties = { color: "var(--obsidian)", fontSize: 13, lineHeight: 1.25 };
const rowMeta: React.CSSProperties = { color: "var(--muted)", fontSize: 12, lineHeight: 1.35 };
const pill: React.CSSProperties = { border: "1px solid rgba(176,137,84,0.38)", borderRadius: 999, padding: "3px 7px", color: "var(--brass)", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", background: "rgba(176,137,84,0.09)" };
const smallHeading: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0, marginTop: 3 };
const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 700, marginBottom: 8 };
const eyebrowSmall: React.CSSProperties = { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brass)", fontWeight: 700 };
const miniLabel: React.CSSProperties = { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 };
const sectionTitle: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0 };
const viewButton: React.CSSProperties = { border: "1px solid transparent", background: "transparent", color: "var(--muted)", borderRadius: 8, padding: 10, cursor: "pointer", display: "grid", gap: 4, textAlign: "left", fontSize: 12, lineHeight: 1.35 };
const activeViewButton: React.CSSProperties = { ...viewButton, background: "var(--obsidian)", color: "var(--bone)", borderColor: "var(--obsidian)", boxShadow: "0 10px 22px rgba(20,17,13,0.1)" };
const countBadge: React.CSSProperties = { minWidth: 24, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(20,17,13,0.08)", color: "var(--obsidian)", fontSize: 11, fontWeight: 800 };
const primaryButton: React.CSSProperties = { border: "1px solid var(--obsidian)", background: "var(--obsidian)", color: "var(--bone)", borderRadius: 8, padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", textDecoration: "none" };
const secondaryButton: React.CSSProperties = { border: "1px solid var(--fog)", background: "var(--surface)", color: "var(--obsidian)", borderRadius: 8, padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer" };
