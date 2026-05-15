import crypto from "crypto";
import type { NextRequest } from "next/server";
import { supabase } from "./supabase";

type VoiceDirection = "inbound" | "outbound" | "status" | "system";

export interface TwilioVoiceEvent {
  callSid: string | null;
  parentCallSid: string | null;
  direction: VoiceDirection;
  from: string | null;
  to: string | null;
  contactNumber: string | null;
  status: string | null;
  duration: string | null;
  leadId: string | null;
  dealId: string | null;
  raw: Record<string, string>;
}

const CLIENT_IDENTITY = "meridian-va";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function text(value: FormDataEntryValue | null): string | null {
  const parsed = typeof value === "string" ? value.trim() : "";
  return parsed || null;
}

function digits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function last10(value: string | null | undefined): string {
  const d = digits(value);
  return d.length > 10 ? d.slice(-10) : d;
}

function isClientAddress(value: string | null | undefined): boolean {
  return String(value || "").toLowerCase().startsWith("client:");
}

function firstCallableNumber(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (isClientAddress(value)) continue;
    if (normalizeUsPhone(value)) return value ?? null;
  }
  return null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shouldRecordCalls(): boolean {
  return process.env.TWILIO_RECORD_CALLS !== "false";
}

export function validateTwilioWebhook(req: NextRequest, formData: FormData): boolean {
  if (process.env.TWILIO_VALIDATE_WEBHOOKS === "false") return true;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return process.env.NODE_ENV !== "production";
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}${req.nextUrl.pathname}${req.nextUrl.search}`
    : req.nextUrl.toString();
  const params = Array.from(formData.entries())
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const signed = params.reduce((acc, [key, value]) => `${acc}${key}${value}`, baseUrl);
  const expected = crypto.createHmac("sha1", authToken).update(signed).digest("base64");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function recordingCallbackUrl(baseUrl: string, leadId?: string | null, dealId?: string | null): URL {
  const callback = new URL("/api/twilio/voice/recording", baseUrl);
  if (leadId) callback.searchParams.set("leadId", leadId);
  if (dealId) callback.searchParams.set("dealId", dealId);
  return callback;
}

function dialRecordingAttrs(baseUrl: string, leadId?: string | null, dealId?: string | null): string {
  if (!shouldRecordCalls()) return "";
  const callback = recordingCallbackUrl(baseUrl, leadId, dealId);
  return [
    ' record="record-from-answer-dual"',
    ` recordingStatusCallback="${escapeXml(callback.toString())}"`,
    ' recordingStatusCallbackMethod="POST"',
    ' recordingStatusCallbackEvent="in-progress completed absent"',
  ].join("");
}

export function recordingDisclosureTwiMl(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    "<Say>This call may be recorded for quality assurance and follow up.</Say>",
    "</Response>",
  ].join("");
}

export function normalizeUsPhone(value: string | null | undefined): string | null {
  const d = digits(value);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return value?.startsWith("+") ? value : null;
}

export function meridianClientIdentity(): string {
  return CLIENT_IDENTITY;
}

export function createTwilioVoiceToken(actor?: string | null): string {
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const apiKeySid = env("TWILIO_API_KEY_SID");
  const apiKeySecret = env("TWILIO_API_KEY_SECRET");
  const twimlAppSid = env("TWILIO_TWIML_APP_SID");
  const now = Math.floor(Date.now() / 1000);
  const identity = CLIENT_IDENTITY;
  const header = {
    typ: "JWT",
    alg: "HS256",
    cty: "twilio-fpa;v=1",
  };
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    exp: now + 3600,
    grants: {
      identity,
      meridian_actor: actor || identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: twimlAppSid },
      },
    },
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac("sha256", apiKeySecret).update(unsigned).digest();
  return `${unsigned}.${base64Url(signature)}`;
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

export async function twilioFormToVoiceEvent(formData: FormData, directionHint: VoiceDirection): Promise<TwilioVoiceEvent> {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
  const from = text(formData.get("From"));
  const to = text(formData.get("To"));
  const callSid = text(formData.get("CallSid"));
  const parentCallSid = text(formData.get("ParentCallSid"));
  const status = text(formData.get("CallStatus")) || text(formData.get("DialCallStatus"));
  const duration = text(formData.get("CallDuration")) || text(formData.get("DialCallDuration"));
  const leadId = text(formData.get("leadId"));
  const dealId = text(formData.get("dealId"));
  const direction = text(formData.get("Direction"))?.includes("inbound") ? "inbound" : directionHint;
  const contactNumber = direction === "inbound"
    ? firstCallableNumber([from, to])
    : firstCallableNumber([to, from]);
  const phone = last10(contactNumber);

  return {
    callSid,
    parentCallSid,
    direction,
    from,
    to,
    contactNumber,
    status,
    duration,
    leadId: leadId || await matchLeadByPhone(phone),
    dealId: dealId || await matchDealByPhone(phone),
    raw,
  };
}

export async function saveTwilioVoiceEvent(event: TwilioVoiceEvent): Promise<void> {
  if (!supabase || !event.callSid) return;
  await supabase
    .from("meridian_communication_events")
    .upsert({
      provider: "twilio",
      provider_event_type: "call-status",
      provider_message_id: event.callSid,
      provider_contact_id: event.parentCallSid,
      provider_conversation_id: event.parentCallSid || event.callSid,
      direction: event.direction,
      channel: "voice",
      from_number: event.from,
      to_number: event.to,
      contact_number: event.contactNumber,
      contact_name: null,
      body: event.duration ? `Call ${event.status ?? "updated"} · ${event.duration}s` : `Call ${event.status ?? "updated"}`,
      status: event.status,
      media: [],
      raw_payload: event.raw,
      matched_lead_id: event.leadId,
      matched_deal_id: event.dealId,
      provider_created_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_message_id,provider_event_type" });
}

export async function saveTwilioRecordingEvent(formData: FormData): Promise<void> {
  if (!supabase) return;
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
  const recordingSid = text(formData.get("RecordingSid"));
  const callSid = text(formData.get("CallSid"));
  const recordingUrl = text(formData.get("RecordingUrl"));
  const recordingStatus = text(formData.get("RecordingStatus"));
  const recordingDuration = text(formData.get("RecordingDuration"));
  const recordingChannels = text(formData.get("RecordingChannels"));
  const leadId = text(formData.get("leadId"));
  const dealId = text(formData.get("dealId"));
  if (!recordingSid || !callSid) return;

  const media = recordingUrl ? [{
    type: "recording",
    provider: "twilio",
    recordingSid,
    url: recordingUrl,
    mp3Url: `${recordingUrl}.mp3`,
    status: recordingStatus,
    duration: recordingDuration,
    channels: recordingChannels,
  }] : [];

  await supabase
    .from("meridian_communication_events")
    .upsert({
      provider: "twilio",
      provider_event_type: "call-recording",
      provider_message_id: recordingSid,
      provider_contact_id: callSid,
      provider_conversation_id: callSid,
      direction: "system",
      channel: "voice",
      from_number: text(formData.get("From")),
      to_number: text(formData.get("To")),
      contact_number: null,
      contact_name: null,
      body: recordingDuration
        ? `Recording ${recordingStatus ?? "updated"} · ${recordingDuration}s`
        : `Recording ${recordingStatus ?? "updated"}`,
      status: recordingStatus,
      media,
      raw_payload: raw,
      matched_lead_id: leadId,
      matched_deal_id: dealId,
      provider_created_at: text(formData.get("RecordingStartTime")) || new Date().toISOString(),
    }, { onConflict: "provider,provider_message_id,provider_event_type" });
}

export function outboundDialTwiMl(args: { to: string; leadId?: string | null; dealId?: string | null; baseUrl: string }): string {
  const callerId = env("TWILIO_PHONE_NUMBER");
  const number = normalizeUsPhone(args.to);
  if (!number) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Missing or invalid phone number.</Say></Response>`;
  }
  const callback = new URL("/api/twilio/voice/status", args.baseUrl);
  const disclosure = new URL("/api/twilio/voice/disclosure", args.baseUrl);
  if (args.leadId) callback.searchParams.set("leadId", args.leadId);
  if (args.dealId) callback.searchParams.set("dealId", args.dealId);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Dial callerId="${escapeXml(callerId)}" answerOnBridge="true"${dialRecordingAttrs(args.baseUrl, args.leadId, args.dealId)}>`,
    `<Number url="${escapeXml(disclosure.toString())}" method="POST" statusCallback="${escapeXml(callback.toString())}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${escapeXml(number)}</Number>`,
    "</Dial>",
    "</Response>",
  ].join("");
}

export function inboundDialTwiMl(baseUrl: string, leadId?: string | null, dealId?: string | null): string {
  const callback = new URL("/api/twilio/voice/status", baseUrl);
  if (leadId) callback.searchParams.set("leadId", leadId);
  if (dealId) callback.searchParams.set("dealId", dealId);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    "<Say>This call may be recorded for quality assurance and follow up.</Say>",
    `<Dial timeout="24" answerOnBridge="true"${dialRecordingAttrs(baseUrl, leadId, dealId)}>`,
    `<Client statusCallback="${escapeXml(callback.toString())}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${CLIENT_IDENTITY}</Client>`,
    "</Dial>",
    "<Say>Thanks for calling Meridian. We missed you, but your call has been logged and someone will follow up shortly.</Say>",
    "</Response>",
  ].join("");
}
