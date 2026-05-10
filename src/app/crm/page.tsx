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
  const dealCommunications = useMemo(() => selectedDeal ? data.communications.filter(event => event.matched_deal_id === selectedDeal.id) : [], [data.communications, selectedDeal]);
  const unmatchedMessages = useMemo(() => data.communications.filter(event => event.direction === "inbound" && !event.matched_deal_id && !event.matched_lead_id), [data.communications]);
  const hotDeals = useMemo(() => data.deals.filter(deal => deal.urgency === "hot" || deal.analysis.recommendation === "Strong Review"), [data.deals]);
  const selectedCampaigns = useMemo(() => selectedDeal ? data.campaigns.filter(campaign => campaign.deal_id === selectedDeal.id) : [], [data.campaigns, selectedDeal]);
  const selectedOffers = useMemo(() => selectedDeal ? data.offers.filter(offer => offer.deal_id === selectedDeal.id) : [], [data.offers, selectedDeal]);

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bone)", padding: "84px 20px 80px", color: "var(--ink)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <p style={eyebrow}>Meridian CRM</p>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 54px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: 0 }}>
              Acquisition + disposition command center
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 780, marginTop: 6 }}>
              One working surface for seller replies, buyer demand, deal packets, disposition campaigns, offers, and records.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["inbox", "deals", "buyers", "dispo", "records"] as CrmView[]).map(tab => (
              <button key={tab} onClick={() => setView(tab)} style={view === tab ? activeTab : tabButton}>{statusLabel(tab)}</button>
            ))}
          </div>
        </header>

        {message && <div style={{ ...panel, marginBottom: 12, borderColor: "var(--brass)" }}>{message}</div>}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }} className="number-grid">
          <Stat label="Deals" value={String(data.deals.length)} />
          <Stat label="Hot Deals" value={String(hotDeals.length)} tone={hotDeals.length ? "hot" : "calm"} />
          <Stat label="Unmatched SMS" value={String(unmatchedMessages.length)} tone={unmatchedMessages.length ? "hot" : "calm"} />
          <Stat label="Contacts" value={String(data.contacts.length)} />
          <Stat label="Buyers" value={String(data.buyers.length)} />
          <Stat label="Offers" value={String(data.offers.length)} tone={data.offers.length ? "hot" : "calm"} />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr) 340px", gap: 14 }} className="crm-grid">
          <aside style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>{view === "inbox" ? "Message queue" : "Deal queue"}</p>
                <h2 style={sectionTitle}>{view === "inbox" ? "Needs attention" : "Active packets"}</h2>
              </div>
              <button onClick={reload} style={secondaryButton}>{loading ? "Loading" : "Refresh"}</button>
            </div>
            {view === "inbox" && (
              <div style={stack}>
                {unmatchedMessages.slice(0, 10).map(event => <MessageCard key={event.id} event={event} />)}
                {unmatchedMessages.length === 0 && <EmptyText>No unmatched seller replies.</EmptyText>}
              </div>
            )}
            {view !== "inbox" && (
              <div style={stack}>
                {data.deals.slice(0, 18).map(deal => (
                  <button key={deal.id} onClick={() => setSelectedDealId(deal.id)} style={{ ...queueButton, background: selectedDeal?.id === deal.id ? "rgba(176,137,84,0.14)" : "var(--surface)" }}>
                    <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{deal.title}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{deal.address || deal.parcel_id || "Location pending"}</span>
                    <span style={{ color: "var(--brass)", fontSize: 11 }}>{deal.analysis.recommendation} · {deal.analysis.disposition.exitConfidence} exit</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main style={panel}>
            {!selectedDeal || !selectedAnalysis ? <EmptyText>Select a deal to review the connected CRM packet.</EmptyText> : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Live deal packet</p>
                    <h2 style={{ ...sectionTitle, fontSize: 30 }}>{selectedDeal.title}</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13 }}>{selectedDeal.address || selectedDeal.parcel_id || "Location pending"} · {selectedDeal.seller_name || "Seller pending"}</p>
                  </div>
                  <button onClick={() => router.push(`/deals?deal=${selectedDeal.id}`)} style={primaryButton}>Open Deal</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }} className="number-grid">
                  <Stat label="Recommended Offer" value={money(selectedAnalysis.acquisition.recommendedOffer)} />
                  <Stat label="Max Offer" value={money(selectedAnalysis.acquisition.maxOffer)} />
                  <Stat label="Target Resale" value={money(selectedAnalysis.disposition.targetResale)} />
                  <Stat label="Spread @ Ask" value={money(selectedAnalysis.acquisition.projectedSpreadAtAsk)} tone={(selectedAnalysis.acquisition.projectedSpreadAtAsk ?? 0) > 0 ? "hot" : "calm"} />
                  <Stat label="Minimum Sale" value={money(selectedAnalysis.disposition.minimumAcceptable)} />
                  <Stat label="Best Offer" value={money(selectedAnalysis.disposition.bestBuyerOffer)} />
                  <Stat label="Total Costs" value={money(selectedAnalysis.acquisition.totalCosts)} />
                  <Stat label="Exit Confidence" value={selectedAnalysis.disposition.exitConfidence} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Acquisition</p>
                    <p style={bodyText}>{selectedAnalysis.summary}</p>
                    <p style={miniLabel}>Missing</p>
                    <p style={bodyText}>{selectedAnalysis.missingInfo.length ? selectedAnalysis.missingInfo.join(", ") : "Core information present."}</p>
                  </div>
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Disposition</p>
                    <p style={bodyText}>{selectedDeal.exit_strategy || "Exit strategy pending."}</p>
                    <p style={miniLabel}>Buyer demand</p>
                    <p style={bodyText}>{selectedDeal.buyer_demand_evidence || "No buyer evidence recorded yet."}</p>
                  </div>
                </div>
                <div style={{ ...subPanel, marginTop: 12 }}>
                  <p style={eyebrowSmall}>Communications</p>
                  <div style={{ display: "grid", gap: 8, maxHeight: 220, overflow: "auto", marginTop: 8 }}>
                    {dealCommunications.map(event => <MessageCard key={event.id} event={event} compact />)}
                    {dealCommunications.length === 0 && <EmptyText>No messages attached to this deal yet.</EmptyText>}
                  </div>
                </div>
              </div>
            )}
          </main>

          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  {["seller", "buyer", "agent", "builder", "neighbor", "title", "lender", "vendor", "other"].map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}
                </select>
                <input placeholder="Display name" value={contactDraft.display_name} onChange={e => setContactDraft({ ...contactDraft, display_name: e.target.value })} />
                <input placeholder="Phone" value={contactDraft.phone} onChange={e => setContactDraft({ ...contactDraft, phone: e.target.value })} />
                <input placeholder="Email" value={contactDraft.email} onChange={e => setContactDraft({ ...contactDraft, email: e.target.value })} />
                <input placeholder="County" value={contactDraft.county} onChange={e => setContactDraft({ ...contactDraft, county: e.target.value })} />
                <button onClick={createContact} style={primaryButton}>Create Contact</button>
              </QuickCreate>
            )}

            <CrmList title="Disposition campaigns" items={selectedCampaigns.length ? selectedCampaigns : data.campaigns.slice(0, 5)} render={campaign => (
              <>
                <strong>{campaign.campaign_name}</strong>
                <span>{statusLabel(campaign.status)} · {money(campaign.target_price)}</span>
              </>
            )} />
            <CrmList title="Buyer offers" items={selectedOffers.length ? selectedOffers : data.offers.slice(0, 5)} render={offer => (
              <>
                <strong>{offer.buyer_name}</strong>
                <span>{money(offer.offer_amount)} · {statusLabel(offer.status)}</span>
              </>
            )} />
            <CrmList title="Buyers" items={data.buyers.slice(0, 5)} render={buyer => (
              <>
                <strong>{buyer.buyer_name}</strong>
                <span>{buyer.markets.join(", ") || buyer.buyer_type || "Buy box pending"}</span>
              </>
            )} />
          </aside>
        </section>
      </div>
      <style jsx>{`
        @media (max-width: 1050px) {
          .crm-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .number-grid, .two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, tone = "calm" }: { label: string; value: string; tone?: "calm" | "hot" }) {
  return (
    <div style={{ border: "1px solid var(--fog)", borderRadius: 8, background: tone === "hot" ? "rgba(176,137,84,0.12)" : "var(--surface)", padding: 12 }}>
      <p style={miniLabel}>{label}</p>
      <strong style={{ color: "var(--obsidian)", fontSize: 18 }}>{value}</strong>
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
const subPanel: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 };
const queueButton: React.CSSProperties = { border: "1px solid var(--fog)", borderRadius: 8, padding: 10, cursor: "pointer", display: "grid", gap: 5, textAlign: "left" };
const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 700, marginBottom: 8 };
const eyebrowSmall: React.CSSProperties = { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brass)", fontWeight: 700 };
const miniLabel: React.CSSProperties = { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 };
const sectionTitle: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0 };
const tabButton: React.CSSProperties = { border: "1px solid var(--fog)", background: "var(--surface)", color: "var(--ink)", borderRadius: 8, padding: "9px 11px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer" };
const activeTab: React.CSSProperties = { ...tabButton, background: "var(--obsidian)", color: "var(--bone)", borderColor: "var(--obsidian)" };
const primaryButton: React.CSSProperties = { border: "1px solid var(--obsidian)", background: "var(--obsidian)", color: "var(--bone)", borderRadius: 8, padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", textDecoration: "none" };
const secondaryButton: React.CSSProperties = { border: "1px solid var(--fog)", background: "var(--surface)", color: "var(--obsidian)", borderRadius: 8, padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer" };
