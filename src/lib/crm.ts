import { supabase } from "./supabase";
import { fetchCommunicationEvents, type CommunicationEvent } from "./communications";
import { fetchDeals, type Deal } from "./deals";

export type CrmContactType = "seller" | "buyer" | "agent" | "broker" | "builder" | "neighbor" | "title" | "lender" | "vendor" | "member" | "other";
export type CrmTemplateType = "seller-sms" | "buyer-sms" | "seller-call" | "buyer-call" | "email" | "task" | "brief";
export type OpportunityContactRole = "seller" | "owner" | "co-owner" | "buyer" | "agent" | "broker" | "builder" | "neighbor" | "title" | "lender" | "vendor" | "member" | "attorney" | "other";

export interface CrmContact {
  id: string;
  contact_type: CrmContactType;
  display_name: string;
  company_name: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  mailing_address: string | null;
  county: string | null;
  state: string | null;
  tags: string[];
  relationship_status: "new" | "active" | "warm" | "nurture" | "do-not-contact" | "inactive" | null;
  sms_opt_status: "unknown" | "opted-in" | "opted-out";
  last_contacted_at: string | null;
  last_contacted_by: string | null;
  notes: string | null;
  source_system: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface CrmProperty {
  id: string;
  property_type: string;
  parcel_id: string | null;
  address: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  acreage: number | null;
  zoning: string | null;
  land_use: string | null;
  road_frontage: string | null;
  utilities: string | null;
  assessed_value: number | null;
  market_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CrmBuyer {
  id: string;
  contact_id: string | null;
  buyer_name: string;
  buyer_type: string | null;
  markets: string[];
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  min_acreage: number | null;
  max_acreage: number | null;
  proof_of_funds_status: "unknown" | "requested" | "received" | "verified" | "expired";
  relationship_strength: "new" | "warm" | "active" | "preferred" | "inactive";
  buy_box: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DispositionCampaign {
  id: string;
  deal_id: string | null;
  property_id: string | null;
  campaign_name: string;
  status: "not-started" | "buyer-list-built" | "marketed" | "buyer-interest" | "offer-received" | "buyer-under-contract" | "closing-scheduled" | "closed" | "fell-through";
  exit_strategy: string | null;
  target_buyer_type: string | null;
  target_price: number | null;
  minimum_price: number | null;
  owner: string | null;
  marketed_at: string | null;
  channels: string[];
  buyer_list_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BuyerOffer {
  id: string;
  disposition_campaign_id: string | null;
  deal_id: string | null;
  buyer_id: string | null;
  contact_id: string | null;
  buyer_name: string;
  offer_amount: number;
  earnest_money: number | null;
  close_date: string | null;
  contingencies: string | null;
  proof_of_funds_status: string | null;
  status: "received" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired";
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CrmTemplate {
  id: string;
  template_type: CrmTemplateType;
  name: string;
  body: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpportunityContact {
  id: string;
  deal_id: string;
  contact_id: string;
  role: OpportunityContactRole;
  is_primary: boolean;
  relationship_notes: string | null;
  source_system: string | null;
  source_table: string | null;
  source_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface CrmDashboardData {
  deals: Deal[];
  contacts: CrmContact[];
  opportunityContacts: OpportunityContact[];
  properties: CrmProperty[];
  buyers: CrmBuyer[];
  campaigns: DispositionCampaign[];
  offers: BuyerOffer[];
  communications: CommunicationEvent[];
  templates: CrmTemplate[];
}

const LOCAL_CONTACTS = "meridian_crm_contacts_local";
const LOCAL_OPPORTUNITY_CONTACTS = "meridian_opportunity_contacts_local";
const LOCAL_PROPERTIES = "meridian_crm_properties_local";
const LOCAL_BUYERS = "meridian_crm_buyers_local";
const LOCAL_CAMPAIGNS = "meridian_disposition_campaigns_local";
const LOCAL_OFFERS = "meridian_buyer_offers_local";
const LOCAL_TEMPLATES = "meridian_crm_templates_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function splitTags(value?: string | null): string[] {
  return (value ?? "").split(",").map(tag => tag.trim()).filter(Boolean);
}

export async function fetchCrmDashboardData(): Promise<CrmDashboardData> {
  const [deals, communications] = await Promise.all([
    fetchDeals(),
    fetchCommunicationEvents({ limit: 80 }),
  ]);

  if (!supabase) {
    return {
      deals,
      communications,
      contacts: localGet<CrmContact[]>(LOCAL_CONTACTS, []),
      opportunityContacts: localGet<OpportunityContact[]>(LOCAL_OPPORTUNITY_CONTACTS, []),
      properties: localGet<CrmProperty[]>(LOCAL_PROPERTIES, []),
      buyers: localGet<CrmBuyer[]>(LOCAL_BUYERS, []),
      campaigns: localGet<DispositionCampaign[]>(LOCAL_CAMPAIGNS, []),
      offers: localGet<BuyerOffer[]>(LOCAL_OFFERS, []),
      templates: localGet<CrmTemplate[]>(LOCAL_TEMPLATES, []),
    };
  }

  const [contacts, opportunityContacts, properties, buyers, campaigns, offers, templates] = await Promise.all([
    supabase.from("meridian_crm_contacts").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    supabase.from("meridian_opportunity_contacts").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    supabase.from("meridian_crm_properties").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    supabase.from("meridian_crm_buyers").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    supabase.from("meridian_disposition_campaigns").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100),
    supabase.from("meridian_buyer_offers").select("*").is("deleted_at", null).order("offer_amount", { ascending: false }).limit(100),
    supabase.from("meridian_crm_templates").select("*").eq("is_active", true).order("template_type", { ascending: true }).limit(100),
  ]);

  return {
    deals,
    communications,
    contacts: (contacts.data as CrmContact[] | null) ?? [],
    opportunityContacts: (opportunityContacts.data as OpportunityContact[] | null) ?? [],
    properties: (properties.data as CrmProperty[] | null) ?? [],
    buyers: (buyers.data as CrmBuyer[] | null) ?? [],
    campaigns: (campaigns.data as DispositionCampaign[] | null) ?? [],
    offers: (offers.data as BuyerOffer[] | null) ?? [],
    templates: (templates.data as CrmTemplate[] | null) ?? [],
  };
}

export async function linkContactToOpportunity(input: {
  deal_id: string;
  contact_id: string;
  role: OpportunityContactRole;
  is_primary?: boolean;
  relationship_notes?: string | null;
}, actor: string): Promise<{ data: OpportunityContact | null; error: string | null }> {
  const row = {
    deal_id: input.deal_id,
    contact_id: input.contact_id,
    role: input.role,
    is_primary: input.is_primary ?? false,
    relationship_notes: input.relationship_notes?.trim() || null,
    source_system: "manual",
    source_table: "meridian_crm_contacts",
    source_id: input.contact_id,
    updated_by: actor,
  };
  if (!row.deal_id || !row.contact_id) return { data: null, error: "Opportunity and contact are required." };
  if (!supabase) {
    const existing = localGet<OpportunityContact[]>(LOCAL_OPPORTUNITY_CONTACTS, []);
    const found = existing.find(item => item.deal_id === row.deal_id && item.contact_id === row.contact_id && item.role === row.role && !item.deleted_at);
    const item = {
      ...row,
      id: found?.id ?? `opportunity-contact-${Date.now()}`,
      created_at: found?.created_at ?? now(),
      created_by: found?.created_by ?? actor,
      updated_at: now(),
      deleted_at: null,
    } as OpportunityContact;
    localSet(LOCAL_OPPORTUNITY_CONTACTS, [item, ...existing.filter(link => link.id !== item.id)]);
    return { data: item, error: null };
  }
  const existing = await supabase
    .from("meridian_opportunity_contacts")
    .select("id")
    .eq("deal_id", row.deal_id)
    .eq("contact_id", row.contact_id)
    .eq("role", row.role)
    .is("deleted_at", null)
    .maybeSingle();
  const query = existing.data?.id
    ? supabase
      .from("meridian_opportunity_contacts")
      .update({ ...row, updated_at: now() })
      .eq("id", existing.data.id)
      .select()
      .single()
    : supabase
      .from("meridian_opportunity_contacts")
      .insert({ ...row, created_by: actor })
      .select()
      .single();
  const { data, error } = await query;
  return { data: data as OpportunityContact | null, error: error?.message ?? null };
}

export async function createCrmContact(input: {
  contact_type: CrmContactType;
  display_name: string;
  phone?: string;
  email?: string;
  county?: string;
  tags?: string;
  notes?: string;
}, actor: string): Promise<{ data: CrmContact | null; error: string | null }> {
  const row = {
    contact_type: input.contact_type,
    display_name: input.display_name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    county: input.county?.trim() || null,
    tags: splitTags(input.tags),
    notes: input.notes?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  if (!row.display_name) return { data: null, error: "Contact name is required." };
  if (!supabase) {
    const item = { ...row, id: `contact-${Date.now()}`, phone_2: null, company_name: null, mailing_address: null, state: null, relationship_status: "new", sms_opt_status: "unknown", last_contacted_at: null, last_contacted_by: null, source_system: "local", created_at: now(), updated_at: now(), deleted_at: null } as CrmContact;
    localSet(LOCAL_CONTACTS, [item, ...localGet<CrmContact[]>(LOCAL_CONTACTS, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_crm_contacts").insert(row).select().single();
  return { data: data as CrmContact | null, error: error?.message ?? null };
}

export async function createCrmBuyer(input: {
  buyer_name: string;
  buyer_type?: string;
  markets?: string;
  max_price?: number | null;
  buy_box?: string;
  notes?: string;
}, actor: string): Promise<{ data: CrmBuyer | null; error: string | null }> {
  const row = {
    buyer_name: input.buyer_name.trim(),
    buyer_type: input.buyer_type?.trim() || null,
    markets: splitTags(input.markets),
    max_price: input.max_price ?? null,
    buy_box: input.buy_box?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  if (!row.buyer_name) return { data: null, error: "Buyer name is required." };
  if (!supabase) {
    const item = { ...row, id: `buyer-${Date.now()}`, contact_id: null, property_types: [], min_price: null, min_acreage: null, max_acreage: null, proof_of_funds_status: "unknown", relationship_strength: "new", last_contacted_at: null, created_at: now(), updated_at: now(), deleted_at: null } as CrmBuyer;
    localSet(LOCAL_BUYERS, [item, ...localGet<CrmBuyer[]>(LOCAL_BUYERS, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_crm_buyers").insert(row).select().single();
  return { data: data as CrmBuyer | null, error: error?.message ?? null };
}

export async function createDispositionCampaign(input: {
  deal_id?: string | null;
  campaign_name: string;
  exit_strategy?: string | null;
  target_buyer_type?: string | null;
  target_price?: number | null;
  minimum_price?: number | null;
  owner?: string | null;
  notes?: string | null;
}, actor: string): Promise<{ data: DispositionCampaign | null; error: string | null }> {
  const row = {
    deal_id: input.deal_id || null,
    campaign_name: input.campaign_name.trim(),
    exit_strategy: input.exit_strategy?.trim() || null,
    target_buyer_type: input.target_buyer_type?.trim() || null,
    target_price: input.target_price ?? null,
    minimum_price: input.minimum_price ?? null,
    owner: input.owner?.trim() || actor,
    notes: input.notes?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  if (!row.campaign_name) return { data: null, error: "Campaign name is required." };
  if (!supabase) {
    const item = { ...row, id: `campaign-${Date.now()}`, property_id: null, status: "not-started", marketed_at: null, channels: [], buyer_list_count: 0, created_at: now(), updated_at: now(), deleted_at: null } as DispositionCampaign;
    localSet(LOCAL_CAMPAIGNS, [item, ...localGet<DispositionCampaign[]>(LOCAL_CAMPAIGNS, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_disposition_campaigns").insert(row).select().single();
  return { data: data as DispositionCampaign | null, error: error?.message ?? null };
}

export async function createBuyerOffer(input: {
  deal_id?: string | null;
  disposition_campaign_id?: string | null;
  buyer_id?: string | null;
  buyer_name: string;
  offer_amount: number | null;
  earnest_money?: number | null;
  close_date?: string | null;
  notes?: string | null;
}, actor: string): Promise<{ data: BuyerOffer | null; error: string | null }> {
  const row = {
    deal_id: input.deal_id || null,
    disposition_campaign_id: input.disposition_campaign_id || null,
    buyer_id: input.buyer_id || null,
    buyer_name: input.buyer_name.trim(),
    offer_amount: input.offer_amount ?? 0,
    earnest_money: input.earnest_money ?? null,
    close_date: input.close_date || null,
    notes: input.notes?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  if (!row.buyer_name) return { data: null, error: "Buyer name is required." };
  if (!row.offer_amount) return { data: null, error: "Offer amount is required." };
  if (!supabase) {
    const item = { ...row, id: `offer-${Date.now()}`, contact_id: null, contingencies: null, proof_of_funds_status: null, status: "received", created_at: now(), updated_at: now(), deleted_at: null } as BuyerOffer;
    localSet(LOCAL_OFFERS, [item, ...localGet<BuyerOffer[]>(LOCAL_OFFERS, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_buyer_offers").insert(row).select().single();
  return { data: data as BuyerOffer | null, error: error?.message ?? null };
}
