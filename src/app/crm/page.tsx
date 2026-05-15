"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ALL_MEMBERS_LABEL, createActionItem, resolveActionItemsForSource } from "@/lib/action-items";
import { calculateDealAnalysis } from "@/lib/deals";
import {
  createBuyerOffer,
  createCrmBuyer,
  createCrmContact,
  createDispositionCampaign,
  fetchCrmDashboardData,
  linkContactToOpportunity,
  updateBuyerOffer,
  updateBuyerOfferStatus,
  updateCrmBuyer,
  updateCrmContact,
  updateCrmProperty,
  updateDispositionCampaign,
  updateDispositionCampaignStatus,
  type CrmDashboardData,
  type CrmBuyer,
  type CrmContact,
  type CrmContactType,
  type CrmProperty,
  type BuyerOffer,
  type DispositionCampaign,
  type OpportunityContactRole,
} from "@/lib/crm";
import type { CommunicationEvent } from "@/lib/communications";
import ConversationPanel from "@/components/ConversationPanel";
import OperatingHeader from "@/components/OperatingHeader";
import { createNotification } from "@/lib/operations";
import { createProjectFromDeal } from "@/lib/projects";
import { labelForStatus } from "@/lib/status-map";
import { getDealNextAction } from "@/lib/workflow-actions";
import { fetchActiveMemberNames } from "@/lib/members";
import { isVaUser } from "@/lib/identity";

const DISPLAY_FONT = "var(--font-display)";
type CrmView = "inbox" | "deals" | "buyers" | "dispo" | "records";
const CRM_VIEWS: CrmView[] = ["inbox", "deals", "buyers", "dispo", "records"];
const DISPO_STAGES: Array<{ id: DispositionCampaign["status"]; label: string; detail: string }> = [
  { id: "not-started", label: "Not Started", detail: "Packet needs buyer plan" },
  { id: "buyer-list-built", label: "Buyer List", detail: "Targets identified" },
  { id: "marketed", label: "Marketed", detail: "Sent to buyers" },
  { id: "buyer-interest", label: "Interest", detail: "Replies to qualify" },
  { id: "offer-received", label: "Offers", detail: "Member decision needed" },
  { id: "buyer-under-contract", label: "Contract", detail: "Buyer under contract" },
  { id: "closing-scheduled", label: "Closing", detail: "Track final items" },
];

const EMPTY_DATA: CrmDashboardData = {
  deals: [],
  contacts: [],
  opportunityContacts: [],
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
  return labelForStatus(value);
}

function crmKey(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function phoneKey(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "").slice(-10);
}

function duplicateGroups<T>(rows: T[], keyFn: (row: T) => string): Array<{ key: string; rows: T[] }> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, rows: items }));
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", padding: "84px 20px" }}>Loading CRM...</div>}>
      <CrmContent />
    </Suspense>
  );
}

function CrmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<string | null>(null);
  const [data, setData] = useState<CrmDashboardData>(EMPTY_DATA);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [view, setView] = useState<CrmView>("inbox");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [contactDraft, setContactDraft] = useState({ contact_type: "seller" as CrmContactType, display_name: "", phone: "", email: "", county: "", tags: "", notes: "" });
  const [buyerDraft, setBuyerDraft] = useState({ buyer_name: "", buyer_type: "", markets: "", max_price: "", buy_box: "", notes: "" });
  const [campaignDraft, setCampaignDraft] = useState({ campaign_name: "", owner: "", notes: "" });
  const [offerDraft, setOfferDraft] = useState({ buyer_name: "", offer_amount: "", earnest_money: "", close_date: "", notes: "" });
  const [linkDraft, setLinkDraft] = useState({ contact_id: "", role: "seller" as OpportunityContactRole, notes: "" });
  const [smsDraft, setSmsDraft] = useState({ contact_id: "", body: "" });
  const [smsSending, setSmsSending] = useState(false);
  const [activeMemberNames, setActiveMemberNames] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [rows, members] = await Promise.all([fetchCrmDashboardData(), fetchActiveMemberNames()]);
    setData(rows);
    setActiveMemberNames(members);
    setSelectedDealId(prev => prev && rows.deals.some(deal => deal.id === prev) ? prev : rows.deals[0]?.id ?? null);
    setSelectedContactId(prev => prev && rows.contacts.some(contact => contact.id === prev) ? prev : rows.contacts[0]?.id ?? null);
    setSelectedBuyerId(prev => prev && rows.buyers.some(buyer => buyer.id === prev) ? prev : rows.buyers[0]?.id ?? null);
    setSelectedPropertyId(prev => prev && rows.properties.some(property => property.id === prev) ? prev : rows.properties[0]?.id ?? null);
    setSelectedCampaignId(prev => prev && rows.campaigns.some(campaign => campaign.id === prev) ? prev : rows.campaigns[0]?.id ?? null);
    setSelectedOfferId(prev => prev && rows.offers.some(offer => offer.id === prev) ? prev : rows.offers[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const current = localStorage.getItem("meridian_user");
    if (!current) { router.push("/"); return; }
    setUser(current);
    void reload();
  }, [router, reload]);

  useEffect(() => {
    const requested = searchParams.get("view");
    if (requested && CRM_VIEWS.includes(requested as CrmView)) {
      setView(requested as CrmView);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("create") !== "contact") return;
    setView("records");
    setMessage("New contact form is ready.");
    let attempts = 0;
    const focusTimer = window.setInterval(() => {
      attempts += 1;
      const target = document.getElementById("crm-new-contact-name") as HTMLInputElement | null;
      if (target) {
        target.focus();
        window.clearInterval(focusTimer);
      }
      if (attempts >= 20) window.clearInterval(focusTimer);
    }, 50);
    return () => window.clearInterval(focusTimer);
  }, [searchParams]);

  useEffect(() => {
    const requestedDeal = searchParams.get("deal");
    if (requestedDeal && data.deals.some(deal => deal.id === requestedDeal)) {
      setSelectedDealId(requestedDeal);
    }
  }, [data.deals, searchParams]);

  useEffect(() => {
    const requestedContact = searchParams.get("contact");
    const requestedProperty = searchParams.get("property");
    const requestedBuyer = searchParams.get("buyer");
    const requestedCampaign = searchParams.get("campaign");
    const requestedOffer = searchParams.get("offer");

    if (requestedContact && data.contacts.some(contact => contact.id === requestedContact)) {
      setSelectedContactId(requestedContact);
      setView("records");
    }

    if (requestedProperty && data.properties.some(property => property.id === requestedProperty)) {
      setSelectedPropertyId(requestedProperty);
      setView("records");
    }

    if (requestedBuyer && data.buyers.some(buyer => buyer.id === requestedBuyer)) {
      setSelectedBuyerId(requestedBuyer);
      setView("buyers");
    }

    if (requestedCampaign && data.campaigns.some(campaign => campaign.id === requestedCampaign)) {
      setSelectedCampaignId(requestedCampaign);
      const campaign = data.campaigns.find(row => row.id === requestedCampaign);
      if (campaign?.deal_id) setSelectedDealId(campaign.deal_id);
      setView("dispo");
    }

    if (requestedOffer && data.offers.some(offer => offer.id === requestedOffer)) {
      setSelectedOfferId(requestedOffer);
      const offer = data.offers.find(row => row.id === requestedOffer);
      if (offer?.deal_id) setSelectedDealId(offer.deal_id);
      if (offer?.buyer_id) setSelectedBuyerId(offer.buyer_id);
      if (offer?.disposition_campaign_id) setSelectedCampaignId(offer.disposition_campaign_id);
      setView("dispo");
    }
  }, [data.buyers, data.campaigns, data.contacts, data.offers, data.properties, searchParams]);

  const selectedDeal = useMemo(() => data.deals.find(deal => deal.id === selectedDealId) ?? data.deals[0] ?? null, [data.deals, selectedDealId]);
  const selectedContact = useMemo(() => data.contacts.find(contact => contact.id === selectedContactId) ?? data.contacts[0] ?? null, [data.contacts, selectedContactId]);
  const selectedBuyer = useMemo(() => data.buyers.find(buyer => buyer.id === selectedBuyerId) ?? data.buyers[0] ?? null, [data.buyers, selectedBuyerId]);
  const selectedProperty = useMemo(() => data.properties.find(property => property.id === selectedPropertyId) ?? data.properties[0] ?? null, [data.properties, selectedPropertyId]);
  const selectedCampaign = useMemo(() => data.campaigns.find(campaign => campaign.id === selectedCampaignId) ?? data.campaigns[0] ?? null, [data.campaigns, selectedCampaignId]);
  const selectedOffer = useMemo(() => data.offers.find(offer => offer.id === selectedOfferId) ?? data.offers[0] ?? null, [data.offers, selectedOfferId]);
  const selectedAnalysis = useMemo(() => selectedDeal ? calculateDealAnalysis(selectedDeal) : null, [selectedDeal]);
  const unmatchedMessages = useMemo(() => data.communications.filter(event => event.direction === "inbound" && !event.matched_deal_id && !event.matched_lead_id), [data.communications]);
  const selectedMessage = useMemo(() => unmatchedMessages.find(event => event.id === selectedMessageId) ?? unmatchedMessages[0] ?? null, [selectedMessageId, unmatchedMessages]);
  const hotDeals = useMemo(() => data.deals.filter(deal => deal.urgency === "hot" || deal.analysis.recommendation === "Strong Review"), [data.deals]);
  const dealsNeedingMemberReview = useMemo(() => data.deals.filter(deal => ["lead", "under-review"].includes(deal.status)), [data.deals]);
  const campaignsNeedingOffers = useMemo(() => data.campaigns.filter(campaign => !data.offers.some(offer => offer.disposition_campaign_id === campaign.id || offer.deal_id === campaign.deal_id)), [data.campaigns, data.offers]);
  const offersNeedingDecision = useMemo(() => data.offers.filter(offer => ["received", "countered"].includes(offer.status)), [data.offers]);
  const recordsNeedingCleanup = useMemo(() => data.contacts.filter(contact => !contact.phone && !contact.email).length + data.properties.filter(property => !property.parcel_id && !property.address).length, [data.contacts, data.properties]);
  const duplicateContacts = useMemo(() => [
    ...duplicateGroups(data.contacts, contact => phoneKey(contact.phone || contact.phone_2)).map(group => ({ ...group, type: "phone" as const })),
    ...duplicateGroups(data.contacts, contact => crmKey(contact.email)).map(group => ({ ...group, type: "email" as const })),
    ...duplicateGroups(data.contacts, contact => crmKey(contact.display_name)).map(group => ({ ...group, type: "name" as const })),
  ], [data.contacts]);
  const duplicateProperties = useMemo(() => [
    ...duplicateGroups(data.properties, property => crmKey(property.parcel_id)).map(group => ({ ...group, type: "parcel" as const })),
    ...duplicateGroups(data.properties, property => crmKey(property.address)).map(group => ({ ...group, type: "address" as const })),
  ], [data.properties]);
  const duplicateBuyers = useMemo(() => duplicateGroups(data.buyers, buyer => crmKey(buyer.buyer_name)), [data.buyers]);
  const selectedCampaigns = useMemo(() => selectedDeal ? data.campaigns.filter(campaign => campaign.deal_id === selectedDeal.id) : [], [data.campaigns, selectedDeal]);
  const selectedCommunicationEvents = useMemo(() => selectedDeal ? data.communications.filter(event => event.matched_deal_id === selectedDeal.id) : [], [data.communications, selectedDeal]);
  const selectedWorkflowAction = useMemo(() => selectedDeal ? getDealNextAction({
    deal: selectedDeal,
    communications: selectedCommunicationEvents,
    currentUser: user,
  }) : null, [selectedCommunicationEvents, selectedDeal, user]);
  const opportunityCountByContact = useMemo(() => data.opportunityContacts.reduce<Record<string, number>>((acc, link) => {
    acc[link.contact_id] = (acc[link.contact_id] ?? 0) + 1;
    return acc;
  }, {}), [data.opportunityContacts]);
  const selectedOpportunityContacts = useMemo(() => selectedDeal ? data.opportunityContacts.filter(link => link.deal_id === selectedDeal.id) : [], [data.opportunityContacts, selectedDeal]);
  const selectedLinkedContacts = useMemo(() => selectedOpportunityContacts
    .map(link => ({ link, contact: data.contacts.find(contact => contact.id === link.contact_id) ?? null }))
    .filter((item): item is { link: typeof item.link; contact: NonNullable<typeof item.contact> } => !!item.contact),
  [data.contacts, selectedOpportunityContacts]);
  const textableLinkedContacts = useMemo(() => selectedLinkedContacts.filter(item => item.contact.phone && item.contact.sms_opt_status !== "opted-out"), [selectedLinkedContacts]);

  if (!user) return null;

  const selectView = (nextView: CrmView) => {
    setView(nextView);
    router.replace(nextView === "inbox" ? "/crm" : `/crm?view=${nextView}`, { scroll: false });
  };

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
    const { data: offer, error } = await createBuyerOffer({
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
    if (offer) {
      const due = offer.close_date || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const description = [
        `${offer.buyer_name} offered ${money(offer.offer_amount)} for ${selectedDeal.title}.`,
        offer.close_date ? `Proposed close: ${formatDate(offer.close_date)}.` : "Close date is not set.",
        offer.notes ? `Notes: ${offer.notes}` : null,
        "Review in CRM Dispo and choose accept, counter, reject, or continue negotiation.",
      ].filter(Boolean).join("\n");
      const workResults = await Promise.all(activeMemberNames.flatMap(member => [
        createNotification({
          title: `Buyer offer needs decision: ${selectedDeal.title}`,
          body: `${offer.buyer_name} offered ${money(offer.offer_amount)}. Review in CRM Dispo.`,
          priority: "high",
          assigned_to: member,
          href: "/crm?view=dispo",
          source_table: "meridian_buyer_offers",
          source_id: offer.id,
          notification_type: "buyer-offer-decision",
          dedupe: true,
        }, user),
        createActionItem({
          title: `Review buyer offer: ${selectedDeal.title}`,
          description,
          assigned_to: member,
          due_date: due,
          task_type: "deal-follow-up",
          priority: "high",
          source_table: "meridian_buyer_offers",
          source_id: offer.id,
        }, user),
      ]));
      const firstError = workResults.find(result => result.error)?.error;
      setMessage(firstError ? `Buyer offer recorded, but member tasks had an issue: ${firstError}` : "Buyer offer recorded and member decision tasks created.");
    } else {
      setMessage("Buyer offer recorded.");
    }
    await reload();
  };

  const changeCampaignStage = async (campaign: DispositionCampaign, status: DispositionCampaign["status"]) => {
    const { error } = await updateDispositionCampaignStatus(campaign, status, user);
    if (error) { setMessage(error); return; }
    setMessage(`Campaign moved to ${statusLabel(status)}.`);
    await reload();
  };

  const changeOfferStatus = async (offer: BuyerOffer, status: BuyerOffer["status"]) => {
    const { error } = await updateBuyerOfferStatus(offer, status, user);
    if (error) { setMessage(error); return; }
    const actor = user || "Meridian";
    const resolution = ["accepted", "countered", "rejected", "withdrawn"].includes(status)
      ? await resolveActionItemsForSource(
        "meridian_buyer_offers",
        offer.id,
        actor,
        `Offer marked ${statusLabel(status)} in CRM Dispo.`,
      )
      : { count: 0, error: null };
    const relatedDeal = data.deals.find(deal => deal.id === offer.deal_id) ?? selectedDeal;
    const relatedCampaign = data.campaigns.find(campaign => campaign.id === offer.disposition_campaign_id || campaign.deal_id === offer.deal_id);
    let handoffMessage = "";

    if (status === "accepted" && relatedDeal) {
      if (relatedCampaign) await updateDispositionCampaignStatus(relatedCampaign, "buyer-under-contract", actor);
      const projectResult = await createProjectFromDeal(relatedDeal, actor);
      if (projectResult.error) {
        handoffMessage = ` Project handoff had an issue: ${projectResult.error}`;
      } else if (projectResult.data) {
        const project = projectResult.data;
        const due = offer.close_date || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const checklist = [
          "Confirm buyer contract, assignment terms, and earnest money receipt.",
          "Send deal packet, buyer offer, and seller/buyer contact details to title or closing owner.",
          "Confirm closing timeline, open risks, and final member update before close.",
        ];
        const taskResults = await Promise.all(checklist.map((title, index) => createActionItem({
          title: `Closing handoff ${index + 1}: ${relatedDeal.title}`,
          description: `${title}\n\nBuyer: ${offer.buyer_name}\nOffer: ${money(offer.offer_amount)}\nClose date: ${offer.close_date ? formatDate(offer.close_date) : "Not set"}`,
          assigned_to: index === 2 ? ALL_MEMBERS_LABEL : actor,
          due_date: due,
          task_type: "project-task",
          priority: "high",
          source_table: "meridian_projects",
          source_id: project.id,
        }, actor)));
        const taskError = taskResults.find(result => result.error)?.error;
        handoffMessage = taskError ? ` Closing project created, but checklist tasks had an issue: ${taskError}` : " Closing project and handoff checklist created.";
      }
    }

    if ((status === "rejected" || status === "withdrawn") && relatedDeal) {
      const followUp = await createActionItem({
        title: `Disposition follow-up: ${relatedDeal.title}`,
        description: `${offer.buyer_name}'s offer was marked ${statusLabel(status)}. Record why it fell through, confirm whether to re-market, and identify the next buyer path.`,
        assigned_to: relatedCampaign?.owner || actor,
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        task_type: "deal-follow-up",
        priority: "high",
        source_table: "meridian_buyer_offers",
        source_id: offer.id,
      }, actor);
      if (followUp.error) handoffMessage = ` Follow-up task had an issue: ${followUp.error}`;
      else if (relatedCampaign) await updateDispositionCampaignStatus(relatedCampaign, "fell-through", actor);
      else handoffMessage = " Fall-through follow-up task created.";
    }

    setMessage(resolution.error
      ? `Offer marked ${statusLabel(status)}, but related tasks could not be resolved: ${resolution.error}`
      : `Offer marked ${statusLabel(status)}${resolution.count ? ` and ${resolution.count} related task${resolution.count === 1 ? "" : "s"} completed` : ""}.${handoffMessage}`);
    await reload();
  };

  const linkContact = async () => {
    if (!selectedDeal) { setMessage("Select an opportunity first."); return; }
    if (!linkDraft.contact_id) { setMessage("Choose a CRM contact to link."); return; }
    const { error } = await linkContactToOpportunity({
      deal_id: selectedDeal.id,
      contact_id: linkDraft.contact_id,
      role: linkDraft.role,
      is_primary: linkDraft.role === "seller" || linkDraft.role === "owner",
      relationship_notes: linkDraft.notes,
    }, user);
    if (error) { setMessage(error); return; }
    setLinkDraft({ contact_id: "", role: "seller", notes: "" });
    setMessage("Contact linked to opportunity.");
    await reload();
  };

  const sendSelectedSms = async () => {
    if (!selectedDeal) { setMessage("Select an opportunity first."); return; }
    const selected = textableLinkedContacts.find(item => item.contact.id === smsDraft.contact_id) ?? textableLinkedContacts[0];
    if (!selected?.contact.phone) { setMessage("Choose a linked contact with a phone number."); return; }
    if (!smsDraft.body.trim()) { setMessage("Write a message before sending."); return; }
    setSmsSending(true);
    setMessage("");
    const response = await fetch("/api/sakari/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toNumber: selected.contact.phone,
        message: smsDraft.body,
        actor: user,
        dealId: selectedDeal.id,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSmsSending(false);
    if (!response.ok) { setMessage(result.error || "SMS failed."); return; }
    setSmsDraft({ contact_id: selected.contact.id, body: "" });
    setMessage("SMS sent and logged to the opportunity.");
    await reload();
  };

  const saveContact = async (contact: CrmContact, patch: Parameters<typeof updateCrmContact>[1]) => {
    const { error } = await updateCrmContact(contact.id, patch, user);
    if (error) { setMessage(error); return; }
    setMessage("Contact updated.");
    await reload();
  };

  const saveProperty = async (property: CrmProperty, patch: Parameters<typeof updateCrmProperty>[1]) => {
    const { error } = await updateCrmProperty(property.id, patch, user);
    if (error) { setMessage(error); return; }
    setMessage("Property updated.");
    await reload();
  };

  const saveBuyer = async (buyer: CrmBuyer, patch: Parameters<typeof updateCrmBuyer>[1]) => {
    const { error } = await updateCrmBuyer(buyer.id, patch, user);
    if (error) { setMessage(error); return; }
    setMessage("Buyer updated.");
    await reload();
  };

  const saveCampaign = async (campaign: DispositionCampaign, patch: Parameters<typeof updateDispositionCampaign>[1]) => {
    const { error } = await updateDispositionCampaign(campaign.id, patch, user);
    if (error) { setMessage(error); return; }
    setMessage("Campaign updated.");
    await reload();
  };

  const saveOffer = async (offer: BuyerOffer, patch: Parameters<typeof updateBuyerOffer>[1]) => {
    const { error } = await updateBuyerOffer(offer.id, patch, user);
    if (error) { setMessage(error); return; }
    setMessage("Offer updated.");
    await reload();
  };

  const views: Array<{ id: CrmView; label: string; detail: string; count: number }> = [
    { id: "inbox", label: "Seller Inbox", detail: "Replies, triage, and lead matching", count: unmatchedMessages.length },
    { id: "deals", label: "Opportunities", detail: "Shared files, packets, votes, calculators", count: data.deals.length },
    { id: "buyers", label: "Buyers", detail: "Buyer demand and buy boxes", count: data.buyers.length },
    { id: "dispo", label: "Disposition", detail: "Campaigns, offers, exit tracking", count: data.campaigns.length + data.offers.length },
    { id: "records", label: "Records", detail: "Sellers, properties, buyers, cleanup", count: data.contacts.length + data.properties.length },
  ];

  const workSummary = [
    { label: "Seller Replies", value: String(unmatchedMessages.length), sub: "need matching", tone: unmatchedMessages.length ? "hot" as const : "calm" as const },
    { label: "Opportunities", value: String(data.deals.length), sub: `${hotDeals.length} hot`, tone: hotDeals.length ? "hot" as const : "calm" as const },
    { label: "Buyers", value: String(data.buyers.length), sub: "active records" },
    { label: "Offers", value: String(data.offers.length), sub: `${offersNeedingDecision.length} decisions`, tone: offersNeedingDecision.length ? "hot" as const : "calm" as const },
  ];
  const cleanupCount = recordsNeedingCleanup + duplicateContacts.length + duplicateProperties.length + duplicateBuyers.length;
  const recordsSummary = [
    { label: "Contacts", value: String(data.contacts.length), sub: "sellers, buyers, vendors" },
    { label: "Properties", value: String(data.properties.length), sub: "parcel records" },
    { label: "Buyers", value: String(data.buyers.length), sub: "buy box records" },
    { label: "Cleanup", value: String(cleanupCount), sub: "needs attention", tone: cleanupCount ? "hot" as const : "calm" as const },
  ];
  const recordsMode = view === "records";
  const vaMode = isVaUser(user);
  const headerSummary = recordsMode ? recordsSummary : workSummary;

  const workflowCards = [
    {
      label: "Seller Inbox",
      value: unmatchedMessages.length,
      body: "Seller replies should be matched to a lead, contact, deal, or VA follow-up.",
      action: "Open Inbox",
      onAction: () => selectView("inbox"),
      hot: unmatchedMessages.length > 0,
    },
    {
      label: "Opportunity File",
      value: dealsNeedingMemberReview.length,
      body: "Every seller, message, calculator, vote, and packet should point to the same file.",
      action: "Open Files",
      onAction: () => selectView("deals"),
      hot: dealsNeedingMemberReview.length > 0,
    },
    {
      label: "Disposition",
      value: campaignsNeedingOffers.length,
      body: "Buyer outreach, offers, and closing handoff stay attached to the opportunity.",
      action: "Open Dispo",
      onAction: () => selectView("dispo"),
      hot: campaignsNeedingOffers.length > 0,
    },
    {
      label: "Offer Decision",
      value: offersNeedingDecision.length,
      body: "New and countered buyer offers need a member-facing decision path.",
      action: "Offers",
      onAction: () => selectView("dispo"),
      hot: offersNeedingDecision.length > 0,
    },
    {
      label: "Records",
      value: recordsNeedingCleanup + duplicateContacts.length + duplicateProperties.length + duplicateBuyers.length,
      body: "People and properties stay clean so the VA and members do not duplicate work.",
      action: "Clean Records",
      onAction: () => selectView("records"),
      hot: recordsNeedingCleanup > 0 || duplicateContacts.length > 0 || duplicateProperties.length > 0 || duplicateBuyers.length > 0,
    },
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
        <WorkspacePanel title="Seller Inbox + Opportunity File" eyebrow="Relationship triage" action={<button onClick={reload} style={secondaryButton}>{loading ? "Loading" : "Refresh"}</button>}>
          <div className="seller-inbox-layout">
            <div style={subPanel}>
              <p style={eyebrowSmall}>Reply queue</p>
              <div style={{ ...stack, maxHeight: 620, marginTop: 10 }}>
                {unmatchedMessages.slice(0, 16).map(event => (
                  <button key={event.id} onClick={() => setSelectedMessageId(event.id)} style={{ ...workRow, borderColor: selectedMessage?.id === event.id ? "var(--brass)" : "var(--fog)" }}>
                    <span style={rowTop}>
                      <strong style={rowTitle}>{event.contact_name || event.contact_number || event.from_number || "Unknown seller"}</strong>
                      <span style={pill}>Unmatched</span>
                    </span>
                    <span style={rowMeta}>{event.body || event.status || event.provider_event_type}</span>
                    <span style={rowMeta}>{formatDate(event.provider_created_at || event.created_at)}</span>
                  </button>
                ))}
                {unmatchedMessages.length === 0 && (
                  <EmptyState
                    title="No unmatched seller replies"
                    body="Inbound Sakari messages that cannot be matched to a list lead or deal will land here so the VA can create or connect the right record."
                    actionLabel="Open VA desk"
                    onAction={() => router.push("/va")}
                  />
                )}
              </div>
            </div>

            <div style={subPanel}>
              <p style={eyebrowSmall}>Selected conversation</p>
              {selectedMessage ? (
                <>
                  <div style={{ ...darkPanel, marginTop: 10, boxShadow: "none" }}>
                    <p style={{ ...miniLabel, color: "rgba(247,242,232,0.58)" }}>{formatDate(selectedMessage.provider_created_at || selectedMessage.created_at)}</p>
                    <h3 style={{ fontFamily: DISPLAY_FONT, color: "var(--bone)", fontSize: 24, fontWeight: 500, letterSpacing: 0, marginTop: 6 }}>
                      {selectedMessage.contact_name || selectedMessage.contact_number || selectedMessage.from_number || "Unknown seller"}
                    </h3>
                    <p style={{ color: "rgba(247,242,232,0.76)", fontSize: 13, lineHeight: 1.55, marginTop: 10 }}>
                      {selectedMessage.body || selectedMessage.status || selectedMessage.provider_event_type}
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }} className="triage-actions">
                    <button onClick={() => router.push("/va")} style={primaryButton}>Match Reply</button>
                    <button onClick={() => router.push("/actions?new=va")} style={secondaryButton}>Assign VA Task</button>
                    <button onClick={() => selectView("records")} style={secondaryButton}>Create Contact</button>
                  </div>
                  <div style={{ ...subPanel, background: "rgba(176,137,84,0.08)", marginTop: 10 }}>
                    <p style={eyebrowSmall}>Why this matters</p>
                    <p style={{ ...bodyText, fontSize: 12, marginTop: 5 }}>
                      This reply should become part of the shared opportunity trail: list lead, CRM contact, deal packet, or follow-up task.
                    </p>
                  </div>
                </>
              ) : (
                <EmptyText>Select a seller reply to triage it.</EmptyText>
              )}
            </div>
          </div>
        </WorkspacePanel>
      );
    }

    if (view === "buyers") {
      return (
        <WorkspacePanel title="Buyer Demand" eyebrow="Buy boxes tied to disposition">
          <div style={recordGrid}>
            {data.buyers.map(buyer => (
              <RecordCard key={buyer.id} title={buyer.buyer_name} meta={buyer.markets.join(", ") || buyer.buyer_type || "Market pending"} active={selectedBuyer?.id === buyer.id} onClick={() => setSelectedBuyerId(buyer.id)}>
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
      const campaignsByStage = DISPO_STAGES.map(stage => ({
        ...stage,
        campaigns: data.campaigns.filter(campaign => campaign.status === stage.id),
      }));
      return (
        <WorkspacePanel title="Disposition + Buyer Offers" eyebrow="Campaigns, offers, member decisions">
          <div className="dispo-stage-grid">
            {campaignsByStage.map(stage => (
              <div key={stage.id} style={subPanel}>
                <p style={eyebrowSmall}>{stage.label}</p>
                <strong style={{ color: "var(--obsidian)", fontSize: 22 }}>{stage.campaigns.length}</strong>
                <p style={{ ...rowMeta, marginTop: 4 }}>{stage.detail}</p>
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {stage.campaigns.slice(0, 3).map(campaign => (
                    <button
                      key={campaign.id}
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        if (campaign.deal_id) setSelectedDealId(campaign.deal_id);
                      }}
                      style={{ ...viewButton, background: "rgba(255,252,245,0.72)", borderColor: "var(--fog)", color: "var(--ink)" }}
                    >
                      <strong>{campaign.campaign_name}</strong>
                      <span>{money(campaign.target_price)} target</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
            <CrmList title="Campaigns" items={data.campaigns} render={campaign => (
              <>
                <strong>{campaign.campaign_name}</strong>
                <span>{statusLabel(campaign.status)} · Target {money(campaign.target_price)}</span>
                <span>{campaign.owner || "Owner pending"}</span>
                <span>{data.offers.filter(offer => offer.disposition_campaign_id === campaign.id || offer.deal_id === campaign.deal_id).length} buyer offer(s)</span>
              </>
            )} onSelect={campaign => {
              setSelectedCampaignId(campaign.id);
              if (campaign.deal_id) setSelectedDealId(campaign.deal_id);
            }} selectedId={selectedCampaign?.id} />
            <CrmList title="Offers" items={data.offers} render={offer => (
              <>
                <strong>{offer.buyer_name}</strong>
                <span>{money(offer.offer_amount)} · {statusLabel(offer.status)}</span>
                <span>{offer.close_date ? `Close ${formatDate(offer.close_date)}` : "Close date pending"}</span>
                <span>{offer.status === "received" || offer.status === "countered" ? "Member decision needed" : "Decision recorded"}</span>
              </>
            )} onSelect={offer => {
              setSelectedOfferId(offer.id);
              if (offer.deal_id) setSelectedDealId(offer.deal_id);
            }} selectedId={selectedOffer?.id} />
          </div>
          <div style={{ ...panel, marginTop: 12 }}>
            <p style={eyebrowSmall}>Member offer decisions</p>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {offersNeedingDecision.map(offer => (
                <div key={offer.id} style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <div>
                      <strong style={rowTitle}>{offer.buyer_name} · {money(offer.offer_amount)}</strong>
                      <p style={rowMeta}>{offer.close_date ? `Close ${formatDate(offer.close_date)}` : "Close date pending"} · {statusLabel(offer.status)}</p>
                    </div>
                    <button onClick={() => {
                      setSelectedOfferId(offer.id);
                      if (offer.deal_id) setSelectedDealId(offer.deal_id);
                    }} style={secondaryButton}>Review</button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => changeOfferStatus(offer, "accepted")} style={primaryButton}>Accept</button>
                    <button onClick={() => changeOfferStatus(offer, "countered")} style={secondaryButton}>Counter</button>
                    <button onClick={() => changeOfferStatus(offer, "rejected")} style={secondaryButton}>Reject</button>
                  </div>
                </div>
              ))}
              {offersNeedingDecision.length === 0 && <EmptyText>No buyer offers are waiting on member direction.</EmptyText>}
            </div>
          </div>
        </WorkspacePanel>
      );
    }

    if (view === "records") {
      return (
        <WorkspacePanel title="Records Database" eyebrow="Sellers, properties, buyers">
          <div style={{ ...panel, marginBottom: 12 }}>
            <p style={eyebrowSmall}>Cleanup prompts</p>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {duplicateContacts.slice(0, 5).map(group => (
                <DuplicatePrompt
                  key={`contact-${group.type}-${group.key}`}
                  label={`Duplicate contacts by ${group.type}`}
                  detail={`${group.rows.length} records share ${group.type === "phone" ? "phone" : group.type === "email" ? "email" : "name"}: ${group.key}`}
                  names={group.rows.map(contact => contact.display_name)}
                  onClick={() => setSelectedContactId(group.rows[0].id)}
                />
              ))}
              {duplicateProperties.slice(0, 5).map(group => (
                <DuplicatePrompt
                  key={`property-${group.type}-${group.key}`}
                  label={`Duplicate properties by ${group.type}`}
                  detail={`${group.rows.length} records share ${group.type}: ${group.key}`}
                  names={group.rows.map(property => property.address || property.parcel_id || "Property record")}
                  onClick={() => setSelectedPropertyId(group.rows[0].id)}
                />
              ))}
              {duplicateBuyers.slice(0, 4).map(group => (
                <DuplicatePrompt
                  key={`buyer-${group.key}`}
                  label="Duplicate buyers by name"
                  detail={`${group.rows.length} buyer records share this name.`}
                  names={group.rows.map(buyer => buyer.buyer_name)}
                  onClick={() => {
                    setSelectedBuyerId(group.rows[0].id);
                    selectView("buyers");
                  }}
                />
              ))}
              {duplicateContacts.length === 0 && duplicateProperties.length === 0 && duplicateBuyers.length === 0 && recordsNeedingCleanup === 0 && (
                <EmptyText>No duplicate or missing-core-field prompts right now.</EmptyText>
              )}
              {recordsNeedingCleanup > 0 && (
                <div style={{ ...subPanel, background: "rgba(176,137,84,0.08)" }}>
                  <strong style={rowTitle}>{recordsNeedingCleanup} record{recordsNeedingCleanup === 1 ? "" : "s"} need core fields</strong>
                  <p style={rowMeta}>Open the contact or property detail panel and fill in phone/email, parcel/address, county, acreage, or use details.</p>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
            <CrmList title="Contacts" items={data.contacts} render={contact => {
              const linkedCount = opportunityCountByContact[contact.id] ?? 0;
              const cleanup = (!contact.phone && !contact.phone_2 && !contact.email) || contact.sms_opt_status === "unknown" || linkedCount === 0;
              return (
                <>
                  <strong>{contact.display_name}</strong>
                  <span>{statusLabel(contact.contact_type)} · {contact.company_name || contact.mailing_address || contact.phone || contact.email || "Identity details pending"}</span>
                  <span>{linkedCount} linked opportunit{linkedCount === 1 ? "y" : "ies"} · SMS {statusLabel(contact.sms_opt_status)} · {cleanup ? "Needs cleanup" : statusLabel(contact.relationship_status || "new")}</span>
                </>
              );
            }} onSelect={contact => setSelectedContactId(contact.id)} selectedId={selectedContact?.id} />
            <CrmList title="Properties" items={data.properties} render={property => (
              <>
                <strong>{property.address || property.parcel_id || "Property record"}</strong>
                <span>{property.county || "County pending"} · {property.acreage ?? "N/A"} acres</span>
                <span>{property.zoning || property.land_use || "Use pending"}</span>
              </>
            )} onSelect={property => setSelectedPropertyId(property.id)} selectedId={selectedProperty?.id} />
          </div>
        </WorkspacePanel>
      );
    }

    return (
      <WorkspacePanel title="Opportunity Files" eyebrow="Deal packets, calculator, member review">
        {renderDealRows(16)}
      </WorkspacePanel>
    );
  };

  const renderRightRail = () => (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {view === "records" && selectedContact && (
        <ContactDetailCard
          key={selectedContact.id}
          contact={selectedContact}
          links={data.opportunityContacts.filter(link => link.contact_id === selectedContact.id)}
          deals={data.deals}
          communications={data.communications.filter(event => {
            const phone = selectedContact.phone || selectedContact.phone_2;
            return !!phone && [event.contact_number, event.from_number, event.to_number].some(value => value?.replace(/\D/g, "").endsWith(phone.replace(/\D/g, "").slice(-10)));
          })}
          onOpenDeal={dealId => {
            setSelectedDealId(dealId);
            selectView("deals");
          }}
          onSave={patch => saveContact(selectedContact, patch)}
        />
      )}

      {view === "records" && selectedProperty && (
        <PropertyDetailCard key={selectedProperty.id} property={selectedProperty} deals={data.deals.filter(deal => deal.parcel_id === selectedProperty.parcel_id || deal.address === selectedProperty.address)} onOpenDeal={dealId => {
          setSelectedDealId(dealId);
          selectView("deals");
        }} onSave={patch => saveProperty(selectedProperty, patch)} />
      )}

      {view === "buyers" && selectedBuyer && (
        <BuyerDetailCard key={selectedBuyer.id} buyer={selectedBuyer} offers={data.offers.filter(offer => offer.buyer_id === selectedBuyer.id || offer.buyer_name === selectedBuyer.buyer_name)} onSave={patch => saveBuyer(selectedBuyer, patch)} />
      )}

      {view === "dispo" && selectedCampaign && (
        <CampaignDetailCard
          key={selectedCampaign.id}
          campaign={selectedCampaign}
          offers={data.offers.filter(offer => offer.disposition_campaign_id === selectedCampaign.id || offer.deal_id === selectedCampaign.deal_id)}
          communications={data.communications.filter(event => selectedCampaign.deal_id && event.matched_deal_id === selectedCampaign.deal_id)}
          onChangeStage={status => changeCampaignStage(selectedCampaign, status)}
          onSave={patch => saveCampaign(selectedCampaign, patch)}
          onOpenDeal={dealId => {
            setSelectedDealId(dealId);
            selectView("deals");
          }}
        />
      )}

      {view === "dispo" && selectedOffer && (
        <OfferDetailCard key={selectedOffer.id} offer={selectedOffer} onChangeStatus={status => changeOfferStatus(selectedOffer, status)} onSave={patch => saveOffer(selectedOffer, patch)} onOpenDeal={dealId => {
          setSelectedDealId(dealId);
          selectView("deals");
        }} />
      )}

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
          <div style={{ borderTop: "1px solid rgba(247,242,232,0.16)", marginTop: 14, paddingTop: 12 }}>
            <p style={{ ...miniLabel, color: "rgba(247,242,232,0.58)" }}>Linked CRM contacts</p>
            <p style={{ color: "rgba(247,242,232,0.72)", fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>
              {selectedLinkedContacts.length
                ? `${selectedLinkedContacts.length} contact${selectedLinkedContacts.length === 1 ? "" : "s"} attached to this opportunity.`
                : "No CRM contacts linked yet."}
            </p>
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

      {(view === "dispo" || view === "deals" || view === "records") && selectedDeal && (
        <>
          <ConversationPanel
            eyebrow="Opportunity communications"
            title="Conversation panel"
            subject={selectedDeal.title}
            communications={selectedCommunicationEvents}
            emptyText="No messages are attached to this opportunity yet."
            maxHeight={320}
            compact
            composer={textableLinkedContacts.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                <select value={smsDraft.contact_id || textableLinkedContacts[0]?.contact.id || ""} onChange={e => setSmsDraft({ ...smsDraft, contact_id: e.target.value })}>
                  {textableLinkedContacts.map(({ link, contact }) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.display_name} · {statusLabel(link.role)} · {contact.phone}
                    </option>
                  ))}
                </select>
                <textarea rows={4} placeholder="Write a seller or buyer text..." value={smsDraft.body} onChange={e => setSmsDraft({ ...smsDraft, body: e.target.value })} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <span style={rowMeta}>{Math.max(1, Math.ceil(smsDraft.body.trim().length / 160))} segment estimate</span>
                  <button onClick={sendSelectedSms} disabled={smsSending || !smsDraft.body.trim()} style={{ ...primaryButton, opacity: smsSending || !smsDraft.body.trim() ? 0.55 : 1 }}>
                    {smsSending ? "Sending" : "Send SMS"}
                  </button>
                </div>
              </div>
            ) : (
              <EmptyText>Link a seller, owner, buyer, or agent contact with a phone number before sending from CRM.</EmptyText>
            )}
          />
          <QuickCreate title="Link contact">
            <select value={linkDraft.contact_id} onChange={e => setLinkDraft({ ...linkDraft, contact_id: e.target.value })}>
              <option value="">Choose CRM contact</option>
              {data.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.display_name}</option>)}
            </select>
            <select value={linkDraft.role} onChange={e => setLinkDraft({ ...linkDraft, role: e.target.value as OpportunityContactRole })}>
              {["seller", "owner", "co-owner", "buyer", "agent", "broker", "builder", "neighbor", "title", "lender", "attorney", "other"].map(role => <option key={role} value={role}>{statusLabel(role)}</option>)}
            </select>
            <textarea rows={2} placeholder="Relationship notes" value={linkDraft.notes} onChange={e => setLinkDraft({ ...linkDraft, notes: e.target.value })} />
            <button onClick={linkContact} style={primaryButton}>Link To Opportunity</button>
          </QuickCreate>
        </>
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
          <input id="crm-new-contact-name" placeholder="Display name" value={contactDraft.display_name} onChange={e => setContactDraft({ ...contactDraft, display_name: e.target.value })} />
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
        <OperatingHeader
          eyebrow={recordsMode ? "Records" : "Meridian Relationship Layer"}
          title={recordsMode ? "Records Database" : "Relationship Command Center"}
          subtitle={recordsMode
            ? "Look up sellers, properties, buyers, deals, disposition, and activity. This is the database, not the work queue."
            : "Seller replies, buyers, offers, tasks, and disposition work tied back to the same Meridian opportunity file."}
          user={user}
          mode="crm"
          actions={
            <>
            {!vaMode && <button onClick={() => router.push("/dashboard")} style={secondaryButton}>Member Portal</button>}
            <button onClick={() => router.push("/va")} style={secondaryButton}>VA Desk</button>
            <button onClick={() => router.push(recordsMode ? "/crm?view=inbox" : "/deals")} style={primaryButton}>{recordsMode ? "Seller Inbox" : "Deal Reviews"}</button>
            </>
          }
          stats={headerSummary.map(item => ({
            label: item.label,
            value: item.value,
            detail: item.sub,
            tone: item.tone === "hot" ? "hot" : "default",
          }))}
        />

        {message && <div style={{ ...panel, marginBottom: 12, borderColor: "var(--brass)" }}>{message}</div>}

        {!recordsMode && (
          <>
            <section className="crm-file-path">
              <ConnectedStep label="Seller Reply" active={view === "inbox"} ready={unmatchedMessages.length > 0 || data.communications.length > 0} />
              <ConnectedStep label="Opportunity File" active={view === "deals"} ready={data.deals.length > 0} />
              <ConnectedStep label="Buyer Demand" active={view === "buyers"} ready={data.buyers.length > 0} />
              <ConnectedStep label="Disposition" active={view === "dispo"} ready={data.campaigns.length > 0} />
              <ConnectedStep label="Offer / Project" active={view === "dispo" && !!selectedOffer} ready={data.offers.length > 0} />
            </section>

            <section className="crm-workflow-strip">
              {workflowCards.map(card => (
                <WorkflowCard key={card.label} {...card} />
              ))}
            </section>
          </>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "270px minmax(0, 1fr) 320px", gap: 14 }} className="crm-grid">
          <aside style={navPanel}>
            <div style={{ marginBottom: 12 }}>
              <p style={eyebrowSmall}>{recordsMode ? "Database" : "Workspace"}</p>
              <h2 style={smallHeading}>{recordsMode ? "Record Sections" : "What are we working?"}</h2>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {views.map(item => (
                <button key={item.id} onClick={() => selectView(item.id)} style={view === item.id ? activeViewButton : viewButton}>
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
              {selectedWorkflowAction && view !== "inbox" && (
                <p style={{ color: "var(--obsidian)", fontSize: 13, fontWeight: 800, marginTop: 6 }}>{selectedWorkflowAction.title}</p>
              )}
              <p style={{ ...bodyText, marginTop: 6 }}>
                {selectedWorkflowAction && view !== "inbox" ? selectedWorkflowAction.detail :
                  view === "inbox" ? "Clear unmatched messages first so interested sellers become searchable leads or deal packets." :
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
        .crm-workflow-strip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .crm-file-path {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0;
          margin-bottom: 14px;
          border: 1px solid rgba(201,168,120,0.24);
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255,252,245,0.64);
        }
        .seller-inbox-layout {
          display: grid;
          grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
          gap: 12px;
        }
        .dispo-stage-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(150px, 1fr));
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        @media (max-width: 1200px) {
          .crm-workflow-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .crm-file-path { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .summary-strip, .two-col, .seller-inbox-layout, .triage-actions { grid-template-columns: 1fr !important; }
          .crm-workflow-strip { grid-template-columns: 1fr !important; }
          .crm-file-path { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function ConnectedStep({ label, active, ready }: { label: string; active: boolean; ready: boolean }) {
  return (
    <div style={{
      padding: "12px 13px",
      borderRight: "1px solid rgba(201,168,120,0.18)",
      background: active ? "var(--obsidian)" : ready ? "rgba(176,137,84,0.08)" : "transparent",
      color: active ? "var(--bone)" : "var(--ink)",
      minHeight: 62,
      display: "grid",
      alignContent: "center",
      gap: 3,
    }}>
      <span style={{ ...miniLabel, color: active ? "var(--brass)" : "var(--muted)" }}>{ready ? "Connected" : "Waiting"}</span>
      <strong style={{ fontSize: 13, color: active ? "var(--bone)" : "var(--obsidian)" }}>{label}</strong>
    </div>
  );
}

function WorkflowCard({ label, value, body, action, onAction, hot }: { label: string; value: number; body: string; action: string; onAction: () => void; hot: boolean }) {
  return (
    <article style={{ ...panel, minHeight: 158, display: "grid", gap: 8, alignContent: "start", borderColor: hot ? "rgba(176,137,84,0.56)" : "var(--fog)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <p style={eyebrowSmall}>{label}</p>
        <strong style={{ color: hot ? "var(--brass)" : "var(--obsidian)", fontSize: 24, lineHeight: 1 }}>{value}</strong>
      </div>
      <p style={{ ...bodyText, fontSize: 12 }}>{body}</p>
      <button onClick={onAction} style={{ ...secondaryButton, justifySelf: "start", marginTop: 2 }}>{action}</button>
    </article>
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

function RecordCard({ title, meta, children, active = false, onClick }: { title: string; meta: string; children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  const content = (
    <>
      <strong style={rowTitle}>{title}</strong>
      <p style={{ ...rowMeta, marginTop: 4 }}>{meta}</p>
      <div style={{ display: "grid", gap: 4, marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{children}</div>
    </>
  );
  if (!onClick) return <div style={subPanel}>{content}</div>;
  return (
    <button
      onClick={onClick}
      style={{
        ...subPanel,
        textAlign: "left",
        cursor: "pointer",
        borderColor: active ? "var(--brass)" : "var(--fog)",
        boxShadow: active ? "0 0 0 3px rgba(176,137,84,0.12)" : subPanel.boxShadow,
      }}
    >
      {content}
    </button>
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

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>{children}</p>;
}

function DuplicatePrompt({
  label,
  detail,
  names,
  onClick,
}: {
  label: string;
  detail: string;
  names: string[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...subPanel,
        background: "rgba(255,252,245,0.78)",
        textAlign: "left",
        cursor: "pointer",
        borderColor: "rgba(176,137,84,0.32)",
      }}
    >
      <p style={eyebrowSmall}>{label}</p>
      <strong style={{ ...rowTitle, display: "block", marginTop: 5 }}>{detail}</strong>
      <p style={{ ...rowMeta, marginTop: 5 }}>{names.slice(0, 4).join(" / ")}{names.length > 4 ? ` +${names.length - 4} more` : ""}</p>
      <p style={{ ...rowMeta, color: "var(--brass)", fontWeight: 800, marginTop: 7 }}>Open first record to clean up fields</p>
    </button>
  );
}

function QuickCreate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{children}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <span style={miniLabel}>{label}</span>
      <strong style={{ color: "var(--obsidian)", fontSize: 13, lineHeight: 1.3 }}>{value || "N/A"}</strong>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={subPanel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{children}</div>
    </div>
  );
}

function HygieneChecklist({ items }: { items: Array<{ label: string; ok: boolean }> }) {
  const missing = items.filter(item => !item.ok);
  return (
    <DetailSection title="Record hygiene">
      {items.map(item => (
        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <span style={{ ...rowMeta, color: item.ok ? "var(--muted)" : "var(--obsidian)" }}>{item.label}</span>
          <span style={{ ...pill, color: item.ok ? "#2f7d4c" : "var(--brass)", borderColor: item.ok ? "rgba(47,125,76,0.26)" : "rgba(176,137,84,0.38)", background: item.ok ? "rgba(47,125,76,0.08)" : "rgba(176,137,84,0.09)" }}>
            {item.ok ? "Ready" : "Needs"}
          </span>
        </div>
      ))}
      <p style={{ ...rowMeta, marginTop: 2 }}>
        {missing.length === 0 ? "This record has the core fields needed for routing and review." : `${missing.length} cleanup item${missing.length === 1 ? "" : "s"} before this record is clean.`}
      </p>
    </DetailSection>
  );
}

function ContactDetailCard({
  contact,
  links,
  deals,
  communications,
  onOpenDeal,
  onSave,
}: {
  contact: CrmContact;
  links: CrmDashboardData["opportunityContacts"];
  deals: CrmDashboardData["deals"];
  communications: CommunicationEvent[];
  onOpenDeal: (dealId: string) => void;
  onSave: (patch: Parameters<typeof updateCrmContact>[1]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    contact_type: contact.contact_type,
    display_name: contact.display_name,
    company_name: contact.company_name || "",
    phone: contact.phone || "",
    phone_2: contact.phone_2 || "",
    email: contact.email || "",
    mailing_address: contact.mailing_address || "",
    county: contact.county || "",
    state: contact.state || "",
    relationship_status: contact.relationship_status || "new",
    sms_opt_status: contact.sms_opt_status,
    tags: contact.tags.join(", "),
    notes: contact.notes || "",
  });
  const linkedDeals = links
    .map(link => ({ link, deal: deals.find(deal => deal.id === link.deal_id) ?? null }))
    .filter((item): item is { link: typeof item.link; deal: NonNullable<typeof item.deal> } => !!item.deal);
  const phoneValues = [contact.phone, contact.phone_2].filter(Boolean) as string[];
  const lastCommunication = communications
    .slice()
    .sort((a, b) => (Date.parse(b.provider_created_at || b.created_at) || 0) - (Date.parse(a.provider_created_at || a.created_at) || 0))[0];
  const recordFlags = [
    contact.relationship_status === "do-not-contact" ? "Do not contact" : null,
    contact.sms_opt_status === "opted-out" ? "SMS opted out" : null,
    !phoneValues.length ? "Missing phone" : null,
    !contact.email ? "Missing email" : null,
    !contact.mailing_address ? "Missing mailing" : null,
    links.length === 0 ? "Unlinked" : null,
  ].filter(Boolean) as string[];
  const detailGrid = (title: string, items: Array<[string, React.ReactNode]>, columns = 2) => (
    <DetailSection title={title}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 10 }}>
        {items.map(([label, value]) => <DetailLine key={label} label={label} value={value} />)}
      </div>
    </DetailSection>
  );

  return (
    <div style={panel}>
      <p style={eyebrowSmall}>Contact record</p>
      <h3 style={smallHeading}>{contact.display_name}</h3>
      <p style={{ ...bodyText, fontSize: 12, marginTop: 4 }}>{statusLabel(contact.contact_type)} · {statusLabel(contact.relationship_status || "new")} · SMS {statusLabel(contact.sms_opt_status)}</p>
      {recordFlags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {recordFlags.map(flag => <span key={flag} style={flag.includes("opted") || flag.includes("Do not") ? { ...pill, color: "#9b3b2f", borderColor: "rgba(155,59,47,0.26)", background: "rgba(155,59,47,0.08)" } : pill}>{flag}</span>)}
        </div>
      )}
      <button onClick={() => setEditing(open => !open)} style={{ ...secondaryButton, marginTop: 10 }}>{editing ? "Close Edit" : "Edit Contact"}</button>
      {editing && (
        <div style={{ ...subPanel, marginTop: 10 }}>
          <p style={eyebrowSmall}>Edit contact</p>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <select value={draft.contact_type} onChange={e => setDraft({ ...draft, contact_type: e.target.value as CrmContactType })}>
              {["seller", "buyer", "agent", "broker", "builder", "neighbor", "title", "lender", "vendor", "member", "other"].map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}
            </select>
            <input value={draft.display_name} onChange={e => setDraft({ ...draft, display_name: e.target.value })} placeholder="Display name" />
            <input value={draft.company_name} onChange={e => setDraft({ ...draft, company_name: e.target.value })} placeholder="Company / organization" />
            <input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="Primary phone" />
            <input value={draft.phone_2} onChange={e => setDraft({ ...draft, phone_2: e.target.value })} placeholder="Alt phone" />
            <input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="Email" />
            <input value={draft.mailing_address} onChange={e => setDraft({ ...draft, mailing_address: e.target.value })} placeholder="Mailing address" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.county} onChange={e => setDraft({ ...draft, county: e.target.value })} placeholder="County" />
              <input value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })} placeholder="State" />
            </div>
            <select value={draft.relationship_status} onChange={e => setDraft({ ...draft, relationship_status: e.target.value as CrmContact["relationship_status"] || "new" })}>
              {["new", "active", "warm", "nurture", "do-not-contact", "inactive"].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <select value={draft.sms_opt_status} onChange={e => setDraft({ ...draft, sms_opt_status: e.target.value as CrmContact["sms_opt_status"] })}>
              {["unknown", "opted-in", "opted-out"].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="Tags, comma separated" />
            <textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" />
            <button onClick={async () => { await onSave(draft); setEditing(false); }} style={primaryButton}>Save Contact</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {detailGrid("Snapshot", [
          ["Type", statusLabel(contact.contact_type)],
          ["Relationship", statusLabel(contact.relationship_status || "new")],
          ["Company", contact.company_name || "N/A"],
          ["Source", contact.source_system || "Manual / CRM"],
          ["Tags", contact.tags.length ? contact.tags.join(", ") : "N/A"],
          ["Created", formatDate(contact.created_at)],
          ["Updated", formatDate(contact.updated_at)],
          ["Updated By", contact.updated_by || "N/A"],
        ])}
        {detailGrid("Reachability", [
          ["Primary Phone", contact.phone || "N/A"],
          ["Alt Phone", contact.phone_2 || "N/A"],
          ["Email", contact.email || "N/A"],
          ["Mailing Address", contact.mailing_address || "N/A"],
          ["County", contact.county || "N/A"],
          ["State", contact.state || "N/A"],
          ["Last Contacted", formatDate(contact.last_contacted_at)],
          ["Last Contacted By", contact.last_contacted_by || "N/A"],
        ])}
        {detailGrid("Compliance & Workflow", [
          ["SMS Status", statusLabel(contact.sms_opt_status)],
          ["Contact Permission", contact.relationship_status === "do-not-contact" ? "Do not contact" : "Contact allowed"],
          ["Linked Opportunities", linkedDeals.length],
          ["Primary Links", links.filter(link => link.is_primary).length],
          ["Recent Messages", communications.length],
          ["Last Message", lastCommunication ? formatDate(lastCommunication.provider_created_at || lastCommunication.created_at) : "N/A"],
        ], 3)}
        {contact.notes && (
          <DetailSection title="Notes">
            <p style={{ ...bodyText, fontSize: 12 }}>{contact.notes}</p>
          </DetailSection>
        )}
        <HygieneChecklist items={[
          { label: "Phone or email on file", ok: Boolean(contact.phone || contact.phone_2 || contact.email) },
          { label: "Mailing address captured", ok: Boolean(contact.mailing_address) },
          { label: "SMS status known", ok: contact.sms_opt_status !== "unknown" },
          { label: "Linked to an opportunity", ok: links.length > 0 },
          { label: "Relationship status set", ok: Boolean(contact.relationship_status) },
        ]} />
        <DetailSection title="Linked opportunities">
          {linkedDeals.map(({ link, deal }) => (
            <button key={link.id} onClick={() => onOpenDeal(deal.id)} style={workRow}>
              <span style={rowTop}>
                <strong style={rowTitle}>{deal.title}</strong>
                <span style={pill}>{statusLabel(link.role)}</span>
              </span>
              <span style={rowMeta}>{deal.address || deal.parcel_id || "Location pending"} · {statusLabel(deal.status)}</span>
              <span style={rowMeta}>{link.is_primary ? "Primary contact" : "Secondary contact"} · {link.source_system || "CRM"}{link.relationship_notes ? ` · ${link.relationship_notes}` : ""}</span>
            </button>
          ))}
          {linkedDeals.length === 0 && <EmptyText>No linked opportunities yet.</EmptyText>}
        </DetailSection>
        <ConversationPanel
          eyebrow="Contact communication"
          title="Recent messages"
          communications={communications}
          emptyText="No texts or calls are tied to this contact yet."
          maxHeight={240}
          compact
        />
      </div>
    </div>
  );
}

function PropertyDetailCard({ property, deals, onOpenDeal, onSave }: { property: CrmProperty; deals: CrmDashboardData["deals"]; onOpenDeal: (dealId: string) => void; onSave: (patch: Parameters<typeof updateCrmProperty>[1]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    property_type: property.property_type || "land",
    parcel_id: property.parcel_id || "",
    address: property.address || "",
    county: property.county || "",
    city: property.city || "",
    state: property.state || "",
    zip: property.zip || "",
    acreage: property.acreage?.toString() || "",
    zoning: property.zoning || "",
    land_use: property.land_use || "",
    road_frontage: property.road_frontage || "",
    utilities: property.utilities || "",
    assessed_value: property.assessed_value?.toString() || "",
    market_value: property.market_value?.toString() || "",
    notes: property.notes || "",
  });
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>Property record</p>
      <h3 style={smallHeading}>{property.address || property.parcel_id || "Property record"}</h3>
      <p style={{ ...bodyText, fontSize: 12, marginTop: 4 }}>{[property.city, property.county, property.state].filter(Boolean).join(", ") || "Location pending"}</p>
      <button onClick={() => setEditing(open => !open)} style={{ ...secondaryButton, marginTop: 10 }}>{editing ? "Close Edit" : "Edit Property"}</button>
      {editing && (
        <div style={{ ...subPanel, marginTop: 10 }}>
          <p style={eyebrowSmall}>Edit property</p>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input value={draft.parcel_id} onChange={e => setDraft({ ...draft, parcel_id: e.target.value })} placeholder="Parcel ID" />
            <input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Address" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="City" />
              <input value={draft.county} onChange={e => setDraft({ ...draft, county: e.target.value })} placeholder="County" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })} placeholder="State" />
              <input value={draft.zip} onChange={e => setDraft({ ...draft, zip: e.target.value })} placeholder="ZIP" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.acreage} onChange={e => setDraft({ ...draft, acreage: e.target.value })} placeholder="Acreage" />
              <input value={draft.zoning} onChange={e => setDraft({ ...draft, zoning: e.target.value })} placeholder="Zoning" />
            </div>
            <input value={draft.land_use} onChange={e => setDraft({ ...draft, land_use: e.target.value })} placeholder="Land use" />
            <input value={draft.utilities} onChange={e => setDraft({ ...draft, utilities: e.target.value })} placeholder="Utilities" />
            <input value={draft.road_frontage} onChange={e => setDraft({ ...draft, road_frontage: e.target.value })} placeholder="Road frontage" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.market_value} onChange={e => setDraft({ ...draft, market_value: e.target.value })} placeholder="Market value" />
              <input value={draft.assessed_value} onChange={e => setDraft({ ...draft, assessed_value: e.target.value })} placeholder="Assessed value" />
            </div>
            <textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" />
            <button onClick={async () => { await onSave(draft); setEditing(false); }} style={primaryButton}>Save Property</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <DetailLine label="Parcel" value={property.parcel_id} />
        <DetailLine label="Acres" value={property.acreage ?? "N/A"} />
        <DetailLine label="Zoning" value={property.zoning} />
        <DetailLine label="Land use" value={property.land_use} />
        <DetailLine label="Market value" value={money(property.market_value)} />
        <DetailLine label="Assessed" value={money(property.assessed_value)} />
        <DetailLine label="Utilities" value={property.utilities} />
        <DetailLine label="Road" value={property.road_frontage} />
      </div>
      {property.notes && <p style={{ ...bodyText, fontSize: 12, marginTop: 10 }}>{property.notes}</p>}
      <HygieneChecklist items={[
        { label: "Parcel or address", ok: Boolean(property.parcel_id || property.address) },
        { label: "County and state", ok: Boolean(property.county && property.state) },
        { label: "Acreage", ok: typeof property.acreage === "number" },
        { label: "Zoning or land use", ok: Boolean(property.zoning || property.land_use) },
        { label: "Connected deal packet", ok: deals.length > 0 },
      ]} />
      <DetailSection title="Connected deals">
        {deals.map(deal => (
          <button key={deal.id} onClick={() => onOpenDeal(deal.id)} style={workRow}>
            <strong style={rowTitle}>{deal.title}</strong>
            <span style={rowMeta}>{deal.status} · {money(deal.asking_price)}</span>
          </button>
        ))}
        {deals.length === 0 && <EmptyText>No deal packet is linked to this property yet.</EmptyText>}
      </DetailSection>
    </div>
  );
}

function BuyerDetailCard({ buyer, offers, onSave }: { buyer: CrmBuyer; offers: BuyerOffer[]; onSave: (patch: Parameters<typeof updateCrmBuyer>[1]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    buyer_name: buyer.buyer_name,
    buyer_type: buyer.buyer_type || "",
    markets: buyer.markets.join(", "),
    property_types: buyer.property_types.join(", "),
    min_price: buyer.min_price?.toString() || "",
    max_price: buyer.max_price?.toString() || "",
    min_acreage: buyer.min_acreage?.toString() || "",
    max_acreage: buyer.max_acreage?.toString() || "",
    proof_of_funds_status: buyer.proof_of_funds_status,
    relationship_strength: buyer.relationship_strength,
    buy_box: buyer.buy_box || "",
    notes: buyer.notes || "",
  });
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>Buyer record</p>
      <h3 style={smallHeading}>{buyer.buyer_name}</h3>
      <p style={{ ...bodyText, fontSize: 12, marginTop: 4 }}>{buyer.buyer_type || "Buyer type pending"} · {statusLabel(buyer.relationship_strength)} · POF {statusLabel(buyer.proof_of_funds_status)}</p>
      <button onClick={() => setEditing(open => !open)} style={{ ...secondaryButton, marginTop: 10 }}>{editing ? "Close Edit" : "Edit Buyer"}</button>
      {editing && (
        <div style={{ ...subPanel, marginTop: 10 }}>
          <p style={eyebrowSmall}>Edit buyer</p>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input value={draft.buyer_name} onChange={e => setDraft({ ...draft, buyer_name: e.target.value })} placeholder="Buyer name" />
            <input value={draft.buyer_type} onChange={e => setDraft({ ...draft, buyer_type: e.target.value })} placeholder="Buyer type" />
            <input value={draft.markets} onChange={e => setDraft({ ...draft, markets: e.target.value })} placeholder="Markets, comma separated" />
            <input value={draft.property_types} onChange={e => setDraft({ ...draft, property_types: e.target.value })} placeholder="Property types, comma separated" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.min_price} onChange={e => setDraft({ ...draft, min_price: e.target.value })} placeholder="Min price" />
              <input value={draft.max_price} onChange={e => setDraft({ ...draft, max_price: e.target.value })} placeholder="Max price" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.min_acreage} onChange={e => setDraft({ ...draft, min_acreage: e.target.value })} placeholder="Min acreage" />
              <input value={draft.max_acreage} onChange={e => setDraft({ ...draft, max_acreage: e.target.value })} placeholder="Max acreage" />
            </div>
            <select value={draft.proof_of_funds_status} onChange={e => setDraft({ ...draft, proof_of_funds_status: e.target.value as CrmBuyer["proof_of_funds_status"] })}>
              {["unknown", "requested", "received", "verified", "expired"].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <select value={draft.relationship_strength} onChange={e => setDraft({ ...draft, relationship_strength: e.target.value as CrmBuyer["relationship_strength"] })}>
              {["new", "warm", "active", "preferred", "inactive"].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <textarea rows={3} value={draft.buy_box} onChange={e => setDraft({ ...draft, buy_box: e.target.value })} placeholder="Buy box" />
            <textarea rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" />
            <button onClick={async () => { await onSave(draft); setEditing(false); }} style={primaryButton}>Save Buyer</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <DetailLine label="Markets" value={buyer.markets.join(", ") || "N/A"} />
        <DetailLine label="Property types" value={buyer.property_types.join(", ") || "N/A"} />
        <DetailLine label="Price range" value={`${money(buyer.min_price)} - ${money(buyer.max_price)}`} />
        <DetailLine label="Acreage" value={`${buyer.min_acreage ?? "N/A"} - ${buyer.max_acreage ?? "N/A"}`} />
        <DetailLine label="Last touch" value={formatDate(buyer.last_contacted_at)} />
        <DetailLine label="Offers" value={offers.length} />
      </div>
      <DetailSection title="Buy box">
        <EmptyText>{buyer.buy_box || "No detailed buy box yet."}</EmptyText>
      </DetailSection>
      <HygieneChecklist items={[
        { label: "Market criteria", ok: buyer.markets.length > 0 },
        { label: "Buy box written", ok: Boolean(buyer.buy_box) },
        { label: "Max price set", ok: typeof buyer.max_price === "number" },
        { label: "POF requested or received", ok: buyer.proof_of_funds_status !== "unknown" },
        { label: "Relationship strength set", ok: Boolean(buyer.relationship_strength) },
      ]} />
      <DetailSection title="Offer history">
        {offers.map(offer => (
          <div key={offer.id} style={{ display: "grid", gap: 3, borderBottom: "1px solid var(--fog)", paddingBottom: 8 }}>
            <strong style={rowTitle}>{money(offer.offer_amount)} · {statusLabel(offer.status)}</strong>
            <span style={rowMeta}>{offer.close_date ? `Close ${formatDate(offer.close_date)}` : "Close date pending"}</span>
          </div>
        ))}
        {offers.length === 0 && <EmptyText>No offers recorded from this buyer yet.</EmptyText>}
      </DetailSection>
    </div>
  );
}

function CampaignDetailCard({
  campaign,
  offers,
  communications,
  onChangeStage,
  onSave,
  onOpenDeal,
}: {
  campaign: DispositionCampaign;
  offers: BuyerOffer[];
  communications: CommunicationEvent[];
  onChangeStage: (status: DispositionCampaign["status"]) => void;
  onSave: (patch: Parameters<typeof updateDispositionCampaign>[1]) => Promise<void>;
  onOpenDeal: (dealId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    campaign_name: campaign.campaign_name,
    status: campaign.status,
    exit_strategy: campaign.exit_strategy || "",
    target_buyer_type: campaign.target_buyer_type || "",
    target_price: campaign.target_price?.toString() || "",
    minimum_price: campaign.minimum_price?.toString() || "",
    owner: campaign.owner || "",
    channels: campaign.channels.join(", "),
    buyer_list_count: campaign.buyer_list_count.toString(),
    notes: campaign.notes || "",
  });
  const touchHistory = [
    ...offers.map(offer => ({
      id: `offer-${offer.id}`,
      date: offer.created_at,
      title: `${offer.buyer_name} offer`,
      meta: `${money(offer.offer_amount)} · ${statusLabel(offer.status)}`,
      body: offer.notes || (offer.close_date ? `Close proposed ${formatDate(offer.close_date)}` : "Offer recorded for member review."),
    })),
    ...communications.map(event => ({
      id: `comm-${event.id}`,
      date: event.provider_created_at || event.created_at,
      title: `${statusLabel(event.direction)} ${event.channel}`,
      meta: [event.contact_name || event.contact_number || "Unknown contact", event.status].filter(Boolean).join(" · "),
      body: event.body || "No message body captured.",
    })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 8);

  return (
    <div style={panel}>
      <p style={eyebrowSmall}>Disposition campaign</p>
      <h3 style={smallHeading}>{campaign.campaign_name}</h3>
      <p style={{ ...bodyText, fontSize: 12, marginTop: 4 }}>{statusLabel(campaign.status)} · {campaign.owner || "Owner pending"}</p>
      <button onClick={() => setEditing(open => !open)} style={{ ...secondaryButton, marginTop: 10 }}>{editing ? "Close Edit" : "Edit Campaign"}</button>
      {editing && (
        <div style={{ ...subPanel, marginTop: 10 }}>
          <p style={eyebrowSmall}>Edit campaign</p>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input value={draft.campaign_name} onChange={e => setDraft({ ...draft, campaign_name: e.target.value })} placeholder="Campaign name" />
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as DispositionCampaign["status"] })}>
              {DISPO_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
              <option value="closed">Closed</option>
              <option value="fell-through">Fell Through</option>
            </select>
            <input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} placeholder="Owner" />
            <input value={draft.exit_strategy} onChange={e => setDraft({ ...draft, exit_strategy: e.target.value })} placeholder="Exit strategy" />
            <input value={draft.target_buyer_type} onChange={e => setDraft({ ...draft, target_buyer_type: e.target.value })} placeholder="Target buyer type" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.target_price} onChange={e => setDraft({ ...draft, target_price: e.target.value })} placeholder="Target price" />
              <input value={draft.minimum_price} onChange={e => setDraft({ ...draft, minimum_price: e.target.value })} placeholder="Minimum price" />
            </div>
            <input value={draft.channels} onChange={e => setDraft({ ...draft, channels: e.target.value })} placeholder="Channels, comma separated" />
            <input value={draft.buyer_list_count} onChange={e => setDraft({ ...draft, buyer_list_count: e.target.value })} placeholder="Buyer list count" />
            <textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" />
            <button onClick={async () => { await onSave(draft); setEditing(false); }} style={primaryButton}>Save Campaign</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <DetailLine label="Target" value={money(campaign.target_price)} />
        <DetailLine label="Minimum" value={money(campaign.minimum_price)} />
        <DetailLine label="Exit" value={campaign.exit_strategy} />
        <DetailLine label="Buyer type" value={campaign.target_buyer_type} />
        <DetailLine label="Channels" value={campaign.channels.join(", ") || "N/A"} />
        <DetailLine label="Buyer list" value={campaign.buyer_list_count} />
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <p style={miniLabel}>Move campaign stage</p>
        <select value={campaign.status} onChange={event => onChangeStage(event.target.value as DispositionCampaign["status"])}>
          {DISPO_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          <option value="closed">Closed</option>
          <option value="fell-through">Fell Through</option>
        </select>
      </div>
      {campaign.deal_id && <button onClick={() => onOpenDeal(campaign.deal_id!)} style={{ ...secondaryButton, marginTop: 12 }}>Open Deal Packet</button>}
      <HygieneChecklist items={[
        { label: "Connected deal packet", ok: Boolean(campaign.deal_id) },
        { label: "Owner assigned", ok: Boolean(campaign.owner) },
        { label: "Target price set", ok: typeof campaign.target_price === "number" },
        { label: "Buyer list started", ok: campaign.buyer_list_count > 0 },
        { label: "Outreach channel set", ok: campaign.channels.length > 0 },
        { label: "Offer history exists", ok: offers.length > 0 },
      ]} />
      <DetailSection title="Offers in campaign">
        {offers.map(offer => (
          <div key={offer.id} style={{ display: "grid", gap: 3, borderBottom: "1px solid var(--fog)", paddingBottom: 8 }}>
            <strong style={rowTitle}>{offer.buyer_name}</strong>
            <span style={rowMeta}>{money(offer.offer_amount)} · {statusLabel(offer.status)}</span>
          </div>
        ))}
        {offers.length === 0 && <EmptyText>No buyer offers have been recorded for this campaign.</EmptyText>}
      </DetailSection>
      <DetailSection title="Campaign touch history">
        {touchHistory.map(item => (
          <div key={item.id} style={{ display: "grid", gap: 3, borderBottom: "1px solid var(--fog)", paddingBottom: 8 }}>
            <strong style={rowTitle}>{item.title}</strong>
            <span style={rowMeta}>{formatDate(item.date)} · {item.meta}</span>
            <span style={{ ...bodyText, fontSize: 12 }}>{item.body}</span>
          </div>
        ))}
        {touchHistory.length === 0 && <EmptyText>No buyer outreach, SMS activity, or offers are attached to this campaign yet.</EmptyText>}
      </DetailSection>
    </div>
  );
}

function OfferDetailCard({
  offer,
  onChangeStatus,
  onSave,
  onOpenDeal,
}: {
  offer: BuyerOffer;
  onChangeStatus: (status: BuyerOffer["status"]) => void;
  onSave: (patch: Parameters<typeof updateBuyerOffer>[1]) => Promise<void>;
  onOpenDeal: (dealId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    buyer_name: offer.buyer_name,
    offer_amount: offer.offer_amount?.toString() || "",
    earnest_money: offer.earnest_money?.toString() || "",
    close_date: offer.close_date || "",
    contingencies: offer.contingencies || "",
    proof_of_funds_status: offer.proof_of_funds_status || "",
    status: offer.status,
    notes: offer.notes || "",
  });
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>Buyer offer</p>
      <h3 style={smallHeading}>{offer.buyer_name}</h3>
      <p style={{ ...bodyText, fontSize: 12, marginTop: 4 }}>{money(offer.offer_amount)} · {statusLabel(offer.status)}</p>
      <button onClick={() => setEditing(open => !open)} style={{ ...secondaryButton, marginTop: 10 }}>{editing ? "Close Edit" : "Edit Offer"}</button>
      {editing && (
        <div style={{ ...subPanel, marginTop: 10 }}>
          <p style={eyebrowSmall}>Edit offer</p>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input value={draft.buyer_name} onChange={e => setDraft({ ...draft, buyer_name: e.target.value })} placeholder="Buyer name" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.offer_amount} onChange={e => setDraft({ ...draft, offer_amount: e.target.value })} placeholder="Offer amount" />
              <input value={draft.earnest_money} onChange={e => setDraft({ ...draft, earnest_money: e.target.value })} placeholder="Earnest money" />
            </div>
            <input type="date" value={draft.close_date} onChange={e => setDraft({ ...draft, close_date: e.target.value })} />
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as BuyerOffer["status"] })}>
              {["received", "countered", "accepted", "rejected", "withdrawn", "expired"].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <input value={draft.proof_of_funds_status} onChange={e => setDraft({ ...draft, proof_of_funds_status: e.target.value })} placeholder="Proof of funds status" />
            <textarea rows={2} value={draft.contingencies} onChange={e => setDraft({ ...draft, contingencies: e.target.value })} placeholder="Contingencies" />
            <textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" />
            <button onClick={async () => { await onSave(draft); setEditing(false); }} style={primaryButton}>Save Offer</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <DetailLine label="Earnest" value={money(offer.earnest_money)} />
        <DetailLine label="Close date" value={formatDate(offer.close_date)} />
        <DetailLine label="POF" value={offer.proof_of_funds_status ? statusLabel(offer.proof_of_funds_status) : "N/A"} />
        <DetailLine label="Contingencies" value={offer.contingencies} />
      </div>
      {offer.notes && <p style={{ ...bodyText, fontSize: 12, marginTop: 10 }}>{offer.notes}</p>}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <p style={miniLabel}>Member direction</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onChangeStatus("accepted")} style={primaryButton}>Accept</button>
          <button onClick={() => onChangeStatus("countered")} style={secondaryButton}>Counter</button>
          <button onClick={() => onChangeStatus("rejected")} style={secondaryButton}>Reject</button>
          <button onClick={() => onChangeStatus("withdrawn")} style={secondaryButton}>Withdrawn</button>
        </div>
      </div>
      <HygieneChecklist items={[
        { label: "Connected deal packet", ok: Boolean(offer.deal_id) },
        { label: "Buyer name", ok: Boolean(offer.buyer_name) },
        { label: "Offer amount", ok: offer.offer_amount > 0 },
        { label: "Close date", ok: Boolean(offer.close_date) },
        { label: "Proof of funds status", ok: Boolean(offer.proof_of_funds_status) },
      ]} />
      {offer.deal_id && <button onClick={() => onOpenDeal(offer.deal_id!)} style={{ ...secondaryButton, marginTop: 12 }}>Open Deal Packet</button>}
    </div>
  );
}

function CrmList<T extends { id: string }>({ title, items, render, onSelect, selectedId }: { title: string; items: T[]; render: (item: T) => React.ReactNode; onSelect?: (item: T) => void; selectedId?: string | null }) {
  return (
    <div style={panel}>
      <p style={eyebrowSmall}>{title}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {items.map(item => {
          const content = render(item);
          const isSelected = selectedId === item.id;
          const itemStyle: React.CSSProperties = {
            border: onSelect ? "1px solid var(--fog)" : "0",
            borderBottom: onSelect ? "1px solid var(--fog)" : "1px solid var(--fog)",
            borderColor: isSelected ? "var(--brass)" : "var(--fog)",
            borderRadius: onSelect ? 8 : 0,
            background: isSelected ? "rgba(176,137,84,0.08)" : "transparent",
            padding: onSelect ? 10 : "0 0 8px",
            display: "grid",
            gap: 3,
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "left",
            cursor: onSelect ? "pointer" : "default",
          };
          return onSelect ? (
            <button key={item.id} onClick={() => onSelect(item)} style={itemStyle}>{content}</button>
          ) : (
            <div key={item.id} style={itemStyle}>{content}</div>
          );
        })}
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
const recordGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 };
const workRow: React.CSSProperties = { background: "rgba(255,252,245,0.78)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12, cursor: "pointer", display: "grid", gap: 6, textAlign: "left", boxShadow: "0 8px 18px rgba(20,17,13,0.04)" };
const rowTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const rowTitle: React.CSSProperties = { color: "var(--obsidian)", fontSize: 13, lineHeight: 1.25 };
const rowMeta: React.CSSProperties = { color: "var(--muted)", fontSize: 12, lineHeight: 1.35 };
const pill: React.CSSProperties = { border: "1px solid rgba(176,137,84,0.38)", borderRadius: 999, padding: "3px 7px", color: "var(--brass)", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", background: "rgba(176,137,84,0.09)" };
const smallHeading: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0, marginTop: 3 };
const eyebrowSmall: React.CSSProperties = { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brass)", fontWeight: 700 };
const miniLabel: React.CSSProperties = { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 };
const sectionTitle: React.CSSProperties = { fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 22, fontWeight: 500, letterSpacing: 0 };
const viewButton: React.CSSProperties = { border: "1px solid transparent", background: "transparent", color: "var(--muted)", borderRadius: 8, padding: 10, cursor: "pointer", display: "grid", gap: 4, textAlign: "left", fontSize: 12, lineHeight: 1.35 };
const activeViewButton: React.CSSProperties = { ...viewButton, background: "var(--obsidian)", color: "var(--bone)", borderColor: "var(--obsidian)", boxShadow: "0 10px 22px rgba(20,17,13,0.1)" };
const countBadge: React.CSSProperties = { minWidth: 24, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(20,17,13,0.08)", color: "var(--obsidian)", fontSize: 11, fontWeight: 800 };
const primaryButton: React.CSSProperties = { border: "1px solid var(--obsidian)", background: "var(--obsidian)", color: "var(--bone)", borderRadius: 8, padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", textDecoration: "none" };
const secondaryButton: React.CSSProperties = { border: "1px solid var(--fog)", background: "var(--surface)", color: "var(--obsidian)", borderRadius: 8, padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer" };
