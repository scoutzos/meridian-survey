import { supabase } from "./supabase";
import { createDealActivity } from "./deals";
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

export async function fetchCommunicationEvents(args: { leadId?: string | null; dealId?: string | null; phone?: string | null; unmatched?: boolean; limit?: number } = {}): Promise<CommunicationEvent[]> {
  const phone = args.phone ? last10(args.phone) : "";
  if (!supabase) {
    return localGet<CommunicationEvent[]>(LOCAL_COMMS, [])
      .filter(event =>
        (!args.leadId || event.matched_lead_id === args.leadId)
        && (!args.dealId || event.matched_deal_id === args.dealId)
        && (!phone || [event.contact_number, event.from_number, event.to_number].some(value => last10(value) === phone))
        && (!args.unmatched || (!event.matched_lead_id && !event.matched_deal_id))
      )
      .slice(0, args.limit ?? 50);
  }
  let query = supabase
    .from("meridian_communication_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);
  if (args.leadId) query = query.eq("matched_lead_id", args.leadId);
  if (args.dealId) query = query.eq("matched_deal_id", args.dealId);
  if (phone) {
    query = query.or(`contact_number.ilike.%${phone.slice(-7)}%,from_number.ilike.%${phone.slice(-7)}%,to_number.ilike.%${phone.slice(-7)}%`);
  }
  if (args.unmatched) query = query.is("matched_lead_id", null).is("matched_deal_id", null);
  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as CommunicationEvent[];
  return phone
    ? rows.filter(event => [event.contact_number, event.from_number, event.to_number].some(value => last10(value) === phone))
    : rows;
}

export async function attachCommunicationEventToLead(eventId: string, leadId: string, actor: string): Promise<{ error: string | null }> {
  if (!supabase) {
    const rows = localGet<CommunicationEvent[]>(LOCAL_COMMS, []);
    localSet(LOCAL_COMMS, rows.map(row => row.id === eventId ? { ...row, matched_lead_id: leadId } : row));
    return { error: null };
  }
  const { data: event, error: eventError } = await supabase
    .from("meridian_communication_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (eventError || !event) return { error: eventError?.message ?? "Could not find SMS event." };

  const row = event as CommunicationEvent;
  const { error } = await supabase
    .from("meridian_communication_events")
    .update({ matched_lead_id: leadId })
    .eq("id", eventId);
  if (error) return { error: error.message };

  await createImportedLandLeadActivity({
    leadId,
    actor,
    activityType: activityTypeFor(row),
    summary: activitySummary(row),
  });
  await supabase
    .from("meridian_imported_land_leads")
    .update({
      last_sms_at: row.provider_created_at || row.created_at,
      last_sms_direction: row.direction === "inbound" || row.direction === "outbound" ? row.direction : null,
      last_sms_body: row.body,
      sakari_contact_id: row.provider_contact_id,
      sakari_conversation_id: row.provider_conversation_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  return { error: null };
}

export async function attachCommunicationEventToDeal(eventId: string, dealId: string, actor: string): Promise<{ error: string | null }> {
  if (!supabase) {
    const rows = localGet<CommunicationEvent[]>(LOCAL_COMMS, []);
    localSet(LOCAL_COMMS, rows.map(row => row.id === eventId ? { ...row, matched_deal_id: dealId } : row));
    return { error: null };
  }
  const { data: event, error: eventError } = await supabase
    .from("meridian_communication_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (eventError || !event) return { error: eventError?.message ?? "Could not find SMS event." };

  const row = event as CommunicationEvent;
  const { error } = await supabase
    .from("meridian_communication_events")
    .update({ matched_deal_id: dealId })
    .eq("id", eventId);
  if (error) return { error: error.message };

  await createDealActivity({
    deal_id: dealId,
    actor,
    activity_type: "updated",
    summary: activitySummary(row),
    field_changes: { communication_event_id: eventId, provider: row.provider, direction: row.direction },
  });
  return { error: null };
}

async function getSakariToken(): Promise<{ token: string | null; error: string | null }> {
  const clientId = process.env.SAKARI_CLIENT_ID;
  const clientSecret = process.env.SAKARI_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { token: null, error: "Missing SAKARI_CLIENT_ID or SAKARI_CLIENT_SECRET in Vercel." };

  const response = await fetch("https://api.sakari.io/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { token: null, error: `Sakari auth failed: ${JSON.stringify(data).slice(0, 240)}` };
  return { token: text((data as Record<string, unknown>).access_token), error: null };
}

export async function sendSakariSms(args: {
  toNumber: string;
  message: string;
  actor: string;
  leadId?: string | null;
  dealId?: string | null;
}): Promise<{ event: CommunicationEvent | null; error: string | null }> {
  const accountId = process.env.SAKARI_ACCOUNT_ID;
  if (!accountId) return { event: null, error: "Missing SAKARI_ACCOUNT_ID in Vercel." };
  const { token, error: tokenError } = await getSakariToken();
  if (tokenError || !token) return { event: null, error: tokenError ?? "Could not authenticate with Sakari." };

  const groupId = process.env.SAKARI_GROUP_ID;
  const body: Record<string, unknown> = {
    contacts: [{ mobile: { number: args.toNumber, country: "US" } }],
    template: args.message,
    type: "SMS",
  };
  if (groupId) body.phoneNumberFilter = { group: { id: groupId } };

  const response = await fetch(`https://api.sakari.io/v1/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { event: null, error: `Sakari send failed: ${JSON.stringify(data).slice(0, 260)}` };

  const message = (((data as Record<string, unknown>).data as Record<string, unknown> | undefined)?.messages as Array<Record<string, unknown>> | undefined)?.[0];
  const eventRow = {
    provider: "sakari",
    provider_event_type: "message-sent",
    provider_message_id: text(message?.id) || `manual-${Date.now()}`,
    provider_contact_id: text(nested(message, ["contact", "id"])),
    provider_conversation_id: null,
    direction: "outbound" as const,
    channel: "sms",
    from_number: null,
    to_number: args.toNumber,
    contact_number: args.toNumber,
    contact_name: null,
    body: args.message,
    status: text(message?.status) || "sent",
    media: [],
    raw_payload: {
      ...(data as Record<string, unknown>),
      meridian_actor: args.actor,
      meridian_sent_by: args.actor,
      meridian_sent_at: new Date().toISOString(),
    },
    matched_lead_id: args.leadId || null,
    matched_deal_id: args.dealId || null,
    provider_created_at: text(nested(message, ["created", "at"])) || new Date().toISOString(),
  };

  if (!supabase) {
    const now = new Date().toISOString();
    const event: CommunicationEvent = { ...eventRow, id: `comm-${Date.now()}`, created_at: now };
    localSet(LOCAL_COMMS, [event, ...localGet<CommunicationEvent[]>(LOCAL_COMMS, [])]);
    return { event, error: null };
  }

  const { data: saved, error } = await supabase
    .from("meridian_communication_events")
    .upsert(eventRow, { onConflict: "provider,provider_message_id,provider_event_type" })
    .select()
    .single();
  if (error || !saved) return { event: null, error: error?.message ?? "SMS sent, but Meridian could not save the event." };

  if (args.leadId) {
    await createImportedLandLeadActivity({
      leadId: args.leadId,
      actor: args.actor,
      activityType: "texted",
      summary: `SMS sent from Meridian · "${args.message}"`,
    });
    await supabase
      .from("meridian_imported_land_leads")
      .update({
        last_sms_at: eventRow.provider_created_at,
        last_sms_direction: "outbound",
        last_sms_body: args.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.leadId);
  }
  if (args.dealId) {
    await createDealActivity({
      deal_id: args.dealId,
      actor: args.actor,
      activity_type: "updated",
      summary: `SMS sent from Meridian · "${args.message}"`,
      field_changes: { communication_event_id: (saved as CommunicationEvent).id, provider: "sakari", direction: "outbound" },
    });
  }

  return { event: saved as CommunicationEvent, error: null };
}

export async function sendSakariBulkSms(args: {
  recipients: Array<{ toNumber: string; leadId: string; label?: string | null }>;
  message: string;
  actor: string;
}): Promise<{ sent: number; events: CommunicationEvent[]; error: string | null }> {
  const accountId = process.env.SAKARI_ACCOUNT_ID;
  if (!accountId) return { sent: 0, events: [], error: "Missing SAKARI_ACCOUNT_ID in Vercel." };
  const cleanRecipients = args.recipients
    .map(recipient => ({ ...recipient, toNumber: recipient.toNumber.trim() }))
    .filter(recipient => recipient.toNumber && recipient.leadId);
  if (cleanRecipients.length === 0) return { sent: 0, events: [], error: "No eligible recipients were provided." };
  if (cleanRecipients.length > 500) return { sent: 0, events: [], error: "Bulk sends are limited to 500 recipients at a time." };

  const { token, error: tokenError } = await getSakariToken();
  if (tokenError || !token) return { sent: 0, events: [], error: tokenError ?? "Could not authenticate with Sakari." };

  const groupId = process.env.SAKARI_GROUP_ID;
  const body: Record<string, unknown> = {
    contacts: cleanRecipients.map(recipient => ({ mobile: { number: recipient.toNumber, country: "US" } })),
    template: args.message,
    type: "SMS",
  };
  if (groupId) body.phoneNumberFilter = { group: { id: groupId } };

  const response = await fetch(`https://api.sakari.io/v1/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { sent: 0, events: [], error: `Sakari bulk send failed: ${JSON.stringify(data).slice(0, 320)}` };

  const messages = (((data as Record<string, unknown>).data as Record<string, unknown> | undefined)?.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const now = new Date().toISOString();
  const rows = cleanRecipients.map((recipient, index) => {
    const message = messages[index];
    return {
      provider: "sakari",
      provider_event_type: "message-sent",
      provider_message_id: text(message?.id) || `bulk-${Date.now()}-${index}`,
      provider_contact_id: text(nested(message, ["contact", "id"])),
      provider_conversation_id: null,
      direction: "outbound" as const,
      channel: "sms",
      from_number: null,
      to_number: recipient.toNumber,
      contact_number: recipient.toNumber,
      contact_name: recipient.label || null,
      body: args.message,
      status: text(message?.status) || "sent",
      media: [],
      raw_payload: {
        ...(data as Record<string, unknown>),
        meridian_actor: args.actor,
        meridian_sent_by: args.actor,
        meridian_sent_at: now,
        meridian_bulk_send: true,
      },
      matched_lead_id: recipient.leadId,
      matched_deal_id: null,
      provider_created_at: text(nested(message, ["created", "at"])) || now,
    };
  });

  if (!supabase) {
    const events = rows.map((row, index) => ({ ...row, id: `comm-${Date.now()}-${index}`, created_at: now }));
    localSet(LOCAL_COMMS, [...events, ...localGet<CommunicationEvent[]>(LOCAL_COMMS, [])]);
    return { sent: events.length, events, error: null };
  }

  const { data: saved, error } = await supabase
    .from("meridian_communication_events")
    .upsert(rows, { onConflict: "provider,provider_message_id,provider_event_type" })
    .select();
  if (error || !saved) return { sent: 0, events: [], error: error?.message ?? "Bulk SMS sent, but Meridian could not save the events." };

  const db = supabase;
  await Promise.all(cleanRecipients.map(recipient => Promise.all([
    createImportedLandLeadActivity({
      leadId: recipient.leadId,
      actor: args.actor,
      activityType: "texted",
      summary: `Bulk SMS sent from Meridian · "${args.message}"`,
    }),
    db
      .from("meridian_imported_land_leads")
      .update({
        last_sms_at: now,
        last_sms_direction: "outbound",
        last_sms_body: args.message,
        status: "contacted",
        updated_at: now,
      })
      .eq("id", recipient.leadId)
      .neq("status", "interested"),
  ])));

  return { sent: (saved as CommunicationEvent[]).length, events: saved as CommunicationEvent[], error: null };
}
