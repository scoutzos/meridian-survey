import { supabase } from "./supabase";
import { createImportedLandLeadActivity, type ImportedLandLeadActivity } from "./land-leads";

export interface CommunicationEvent {
  id: string;
  provider: string;
  provider_event_type: string;
  provider_message_id: string | null;
  provider_contact_id: string | null;
  provider_conversation_id: string | null;
  direction: "inbound" | "outbound" | "status" | "system";
  channel: string;
  from_number: string | null;
  to_number: string | null;
  contact_number: string | null;
  contact_name: string | null;
  body: string | null;
  status: string | null;
  media: unknown[];
  raw_payload: Record<string, unknown>;
  matched_lead_id: string | null;
  matched_deal_id: string | null;
  created_at: string;
  provider_created_at: string | null;
}

interface SakariWebhookBody {
  accountId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
}

const LOCAL_COMMS = "meridian_communication_events_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function last10(value: unknown): string {
  const d = digits(value);
  return d.length > 10 ? d.slice(-10) : d;
}

function nested(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function sakariDirection(eventType: string, payload: Record<string, unknown>): CommunicationEvent["direction"] {
  if (eventType === "message-received") return "inbound";
  if (eventType === "message-sent") return "outbound";
  if (eventType === "message-status") return "status";
  if (eventType.includes("opt-") || eventType.includes("conversation-")) return "system";
  return payload.outgoing === true ? "outbound" : payload.outgoing === false ? "inbound" : "system";
}

function sakariContactName(payload: Record<string, unknown>): string | null {
  const first = text(nested(payload, ["contact", "firstName"]));
  const last = text(nested(payload, ["contact", "lastName"]));
  return [first, last].filter(Boolean).join(" ") || null;
}

function normalizeSakari(body: SakariWebhookBody): Omit<CommunicationEvent, "id" | "created_at" | "matched_lead_id" | "matched_deal_id"> {
  const payload = body.payload ?? {};
  const eventType = body.eventType || text(payload.eventType) || "sakari-event";
  const direction = sakariDirection(eventType, payload);
  const contactNumber = text(nested(payload, ["contact", "mobile", "number"]));
  const sakariNumber = text(nested(payload, ["conversation", "phoneNumber", "number"]));
  const fallbackTo = text(nested(payload, ["phoneNumber", "number"]));
  const fromNumber = direction === "inbound" ? contactNumber : sakariNumber || fallbackTo;
  const toNumber = direction === "inbound" ? sakariNumber || fallbackTo : contactNumber;

  return {
    provider: "sakari",
    provider_event_type: eventType,
    provider_message_id: text(payload.id) || text(nested(payload, ["message", "id"])),
    provider_contact_id: text(nested(payload, ["contact", "id"])),
    provider_conversation_id: text(nested(payload, ["conversation", "id"])),
    direction,
    channel: text(payload.type)?.toLowerCase() || "sms",
    from_number: fromNumber,
    to_number: toNumber,
    contact_number: contactNumber || (direction === "inbound" ? fromNumber : toNumber),
    contact_name: sakariContactName(payload),
    body: text(payload.message),
    status: text(payload.status) || eventType,
    media: Array.isArray(payload.media) ? payload.media : [],
    raw_payload: body as unknown as Record<string, unknown>,
    provider_created_at: text(nested(payload, ["created", "at"])),
  };
}

async function matchLeadByPhone(phone: string): Promise<string | null> {
  if (!supabase || !phone) return null;
  const { data, error } = await supabase
    .from("meridian_imported_land_leads")
    .select("id, phone, phone_2")
    .or(`phone.ilike.%${phone.slice(-7)}%,phone_2.ilike.%${phone.slice(-7)}%`)
    .limit(25);
  if (error || !data) return null;
  const match = (data as Array<{ id: string; phone: string | null; phone_2: string | null }>).find(row =>
    last10(row.phone) === phone || last10(row.phone_2) === phone
  );
  return match?.id ?? null;
}

async function matchDealByPhone(phone: string): Promise<string | null> {
  if (!supabase || !phone) return null;
  const { data, error } = await supabase
    .from("meridian_deals")
    .select("id, seller_phone")
    .ilike("seller_phone", `%${phone.slice(-7)}%`)
    .is("deleted_at", null)
    .limit(25);
  if (error || !data) return null;
  const match = (data as Array<{ id: string; seller_phone: string | null }>).find(row => last10(row.seller_phone) === phone);
  return match?.id ?? null;
}

function activityTypeFor(event: Pick<CommunicationEvent, "direction" | "provider_event_type">): ImportedLandLeadActivity["activity_type"] {
  if (event.provider_event_type === "contact-opt-out" || event.provider_event_type === "list-opt-out") return "not-interested";
  if (event.direction === "inbound") return "interested";
  if (event.direction === "outbound") return "texted";
  return "note";
}

function activitySummary(event: Pick<CommunicationEvent, "direction" | "provider_event_type" | "body" | "status">): string {
  if (event.provider_event_type.includes("opt-out")) return "Sakari opt-out received. Do not text this seller.";
  if (event.provider_event_type.includes("opt-in")) return "Sakari opt-in received.";
  const label = event.direction === "inbound" ? "SMS received" : event.direction === "outbound" ? "SMS sent" : "Sakari SMS update";
  return [label, event.body ? `"${event.body}"` : "", event.status ? `Status: ${event.status}` : ""].filter(Boolean).join(" · ");
}

export async function handleSakariWebhook(body: SakariWebhookBody): Promise<{ event: CommunicationEvent | null; error: string | null }> {
  const normalized = normalizeSakari(body);
  const phone = last10(normalized.contact_number);
  const [matchedLeadId, matchedDealId] = await Promise.all([matchLeadByPhone(phone), matchDealByPhone(phone)]);
  const row = {
    ...normalized,
    matched_lead_id: matchedLeadId,
    matched_deal_id: matchedDealId,
  };

  if (!supabase) {
    const now = new Date().toISOString();
    const event: CommunicationEvent = { ...row, id: `comm-${Date.now()}`, created_at: now };
    localSet(LOCAL_COMMS, [event, ...localGet<CommunicationEvent[]>(LOCAL_COMMS, [])]);
    return { event, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_communication_events")
    .upsert(row, { onConflict: "provider,provider_message_id,provider_event_type" })
    .select()
    .single();
  if (error || !data) return { event: null, error: error?.message ?? "Could not save Sakari event." };

  const event = data as CommunicationEvent;
  if (matchedLeadId) {
    const optUpdate = normalized.provider_event_type.includes("opt-out") ? { sms_opt_status: "opted-out" }
      : normalized.provider_event_type.includes("opt-in") ? { sms_opt_status: "opted-in" }
        : {};
    await supabase
      .from("meridian_imported_land_leads")
      .update({
        ...optUpdate,
        last_sms_at: normalized.provider_created_at || new Date().toISOString(),
        last_sms_direction: normalized.direction === "inbound" || normalized.direction === "outbound" ? normalized.direction : null,
        last_sms_body: normalized.body,
        sakari_contact_id: normalized.provider_contact_id,
        sakari_conversation_id: normalized.provider_conversation_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchedLeadId);
    await createImportedLandLeadActivity({
      leadId: matchedLeadId,
      actor: "Sakari",
      activityType: activityTypeFor(event),
      summary: activitySummary(event),
    });
  }

  return { event, error: null };
}

export async function fetchCommunicationEvents(args: { leadId?: string | null; dealId?: string | null; limit?: number } = {}): Promise<CommunicationEvent[]> {
  if (!supabase) {
    return localGet<CommunicationEvent[]>(LOCAL_COMMS, [])
      .filter(event => (!args.leadId || event.matched_lead_id === args.leadId) && (!args.dealId || event.matched_deal_id === args.dealId))
      .slice(0, args.limit ?? 50);
  }
  let query = supabase
    .from("meridian_communication_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);
  if (args.leadId) query = query.eq("matched_lead_id", args.leadId);
  if (args.dealId) query = query.eq("matched_deal_id", args.dealId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as CommunicationEvent[];
}
