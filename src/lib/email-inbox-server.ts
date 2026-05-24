import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  EmailAttachment,
  EmailCampaign,
  EmailCampaignCenterPayload,
  EmailCampaignRecipient,
  EmailInboxPayload,
  EmailMailbox,
  EmailMessage,
  EmailSuppression,
  EmailTemplate,
  EmailThread,
  EmailThreadSummary,
} from "./email-inbox-types";

const RESEND_API_BASE = "https://api.resend.com";

type JsonMap = Record<string, unknown>;

interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: JsonMap;
}

interface ResendReceivedEmail {
  id: string;
  to?: string[];
  from?: string;
  created_at?: string;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: JsonMap;
  bcc?: string[];
  cc?: string[];
  reply_to?: string[];
  message_id?: string | null;
  attachments?: Array<{
    id?: string;
    filename?: string;
    content_type?: string | null;
    content_disposition?: string | null;
    content_id?: string | null;
    size?: number | null;
  }>;
}

interface ResendSendResponse {
  id: string;
}

interface ResendBatchSendResponse {
  data?: Array<{ id: string }>;
}

export interface SendPortalEmailInput {
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string | null;
  threadId?: string | null;
  actor?: string | null;
}

export interface EmailCampaignRecipientInput {
  email: string;
  displayName?: string | null;
  crmContactId?: string | null;
}

export interface SendEmailCampaignInput {
  mailboxId: string;
  templateId?: string | null;
  name: string;
  subject: string;
  text: string;
  html?: string | null;
  manualRecipients?: Array<string | EmailCampaignRecipientInput> | string;
  includeCrmAudience?: boolean;
  crmContactTypes?: string[];
  actor?: string | null;
}

export interface SaveEmailTemplateInput {
  mailboxId?: string | null;
  name: string;
  description?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  actor?: string | null;
}

export interface SendCampaignTestEmailInput {
  mailboxId: string;
  templateId?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  to: string;
  actor?: string | null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function cleanEmail(value: unknown): string {
  const raw = String(value ?? "").trim();
  const bracket = raw.match(/<([^>]+)>/);
  return (bracket?.[1] || raw).trim().toLowerCase();
}

function cleanEmailList(values: unknown): string[] {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
  return Array.from(new Set(list.map(cleanEmail).filter(value => value.includes("@"))));
}

function parseRecipient(value: string | EmailCampaignRecipientInput): EmailCampaignRecipientInput | null {
  if (typeof value !== "string") {
    const email = cleanEmail(value.email);
    if (!email.includes("@")) return null;
    return {
      email,
      displayName: text(value.displayName),
      crmContactId: text(value.crmContactId),
    };
  }
  const email = cleanEmail(value);
  if (!email.includes("@")) return null;
  return {
    email,
    displayName: displayNameFromAddress(value),
  };
}

function parseManualRecipients(values: SendEmailCampaignInput["manualRecipients"]): EmailCampaignRecipientInput[] {
  const rawList = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[\n;,]+/).map(item => item.trim()).filter(Boolean)
      : [];
  const map = new Map<string, EmailCampaignRecipientInput>();
  for (const item of rawList) {
    const recipient = parseRecipient(item);
    if (recipient) map.set(recipient.email, recipient);
  }
  return Array.from(map.values());
}

function displayNameFromAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  return match?.[1]?.trim() || null;
}

function normalizeSubject(subject: string | null | undefined): string {
  return (subject || "(no subject)")
    .replace(/^\s*(re|fw|fwd):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function previewFrom(bodyText: string | null, bodyHtml: string | null, subject: string | null): string {
  const source = bodyText || (bodyHtml ? stripHtml(bodyHtml) : "") || subject || "";
  return source.replace(/\s+/g, " ").trim().slice(0, 220);
}

function htmlFromText(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.split(/\n{2,}/).map(part => `<p>${part.replace(/\n/g, "<br />")}</p>`).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicBaseUrl(): string {
  const explicit = process.env.PORTAL_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");
  return "http://localhost:3000";
}

function recipientVariables(
  recipient: { email: string; displayName?: string | null; display_name?: string | null },
  unsubscribeUrl: string,
): Record<string, string> {
  const name = text(recipient.displayName ?? recipient.display_name) || "";
  const pieces = name.split(/\s+/).filter(Boolean);
  return {
    EMAIL: recipient.email,
    FIRST_NAME: pieces[0] || "",
    LAST_NAME: pieces.slice(1).join(" "),
    DISPLAY_NAME: name,
    UNSUBSCRIBE_URL: unsubscribeUrl,
  };
}

function renderTemplateValue(value: string, variables: Record<string, string>, html = false): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const replacement = variables[key.toUpperCase()] ?? "";
    return html ? escapeHtml(replacement) : replacement;
  });
}

function resendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY.");
  return key;
}

async function resendRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend request failed: ${JSON.stringify(payload).slice(0, 300)}`);
  }
  return payload as T;
}

export function supabaseEmailAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configuredMailboxAddresses(): Array<{ address: string; displayName: string; kind: EmailMailbox["kind"] }> {
  const rows: Array<{ address: string; displayName: string; kind: EmailMailbox["kind"] }> = [];
  const configured = process.env.RESEND_DEFAULT_MAILBOXES || process.env.PORTAL_EMAIL_MAILBOXES;
  if (configured) {
    for (const item of configured.split(",")) {
      const [addressPart, namePart, kindPart] = item.split("|").map(part => part.trim());
      const address = cleanEmail(addressPart);
      if (address.includes("@")) {
        rows.push({
          address,
          displayName: namePart || address.split("@")[0],
          kind: (kindPart as EmailMailbox["kind"]) || "shared",
        });
      }
    }
  }

  const domain = text(process.env.RESEND_DOMAIN)?.replace(/^@/, "");
  const explicit = [
    { address: process.env.RESEND_MEMBERS_EMAIL || (domain ? `members@${domain}` : null), displayName: "Members", kind: "shared" as const },
    { address: process.env.RESEND_VA_EMAIL || (domain ? `va@${domain}` : null), displayName: "VA", kind: "personal" as const },
    { address: process.env.RESEND_CAMPAIGN_EMAIL || (domain ? `updates@${domain}` : null), displayName: "Campaigns", kind: "campaign" as const },
  ];
  for (const row of explicit) {
    const address = cleanEmail(row.address);
    if (address.includes("@") && !rows.some(existing => existing.address === address)) {
      rows.push({ ...row, address });
    }
  }
  return rows;
}

export async function ensureConfiguredMailboxes(supabase: SupabaseClient): Promise<EmailMailbox[]> {
  const rows = configuredMailboxAddresses();
  if (rows.length) {
    await supabase.from("meridian_email_mailboxes").upsert(
      rows.map(row => ({
        address: row.address,
        display_name: row.displayName,
        kind: row.kind,
        is_active: true,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "address" }
    );
  }
  const { data, error } = await supabase
    .from("meridian_email_mailboxes")
    .select("*")
    .eq("is_active", true)
    .order("kind", { ascending: true })
    .order("address", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as EmailMailbox[]) ?? [];
}

async function ensureMailboxForAddress(supabase: SupabaseClient, addressValue: string): Promise<EmailMailbox> {
  const address = cleanEmail(addressValue);
  const configured = configuredMailboxAddresses().find(row => row.address === address);
  const row = {
    address,
    display_name: configured?.displayName || address.split("@")[0] || address,
    kind: configured?.kind || "shared",
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("meridian_email_mailboxes")
    .upsert(row, { onConflict: "address" })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save mailbox.");
  return data as EmailMailbox;
}

function messageIdCandidates(headers: JsonMap | undefined, messageId?: string | null): string[] {
  const values = [
    messageId,
    text(headers?.["message-id"]),
    text(headers?.["message_id"]),
    text(headers?.["in-reply-to"]),
    text(headers?.["references"]),
  ].filter(Boolean) as string[];
  const pieces = values.flatMap(value => value.match(/<[^>]+>/g) || [value]);
  return Array.from(new Set(pieces.map(item => item.trim()).filter(Boolean)));
}

async function findThreadForReceivedEmail(
  supabase: SupabaseClient,
  mailbox: EmailMailbox,
  email: ResendReceivedEmail,
  fromEmail: string,
): Promise<EmailThread | null> {
  const candidates = messageIdCandidates(email.headers, email.message_id);
  if (candidates.length > 0) {
    const { data: messages } = await supabase
      .from("meridian_email_messages")
      .select("thread_id, provider_message_id")
      .eq("provider", "resend")
      .in("provider_message_id", candidates)
      .limit(1);
    const match = (messages as Array<{ thread_id: string }> | null)?.[0];
    if (match?.thread_id) {
      const { data: thread } = await supabase
        .from("meridian_email_threads")
        .select("*")
        .eq("id", match.thread_id)
        .single();
      if (thread) return thread as EmailThread;
    }
  }

  const normalized = normalizeSubject(email.subject);
  const threadKey = `${mailbox.address}|${fromEmail}|${normalized}`;
  const { data } = await supabase
    .from("meridian_email_threads")
    .select("*")
    .eq("mailbox_id", mailbox.id)
    .eq("thread_key", threadKey)
    .eq("status", "open")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1);
  return ((data as EmailThread[] | null)?.[0]) ?? null;
}

async function createThread(
  supabase: SupabaseClient,
  args: {
    mailbox: EmailMailbox;
    subject: string | null;
    externalEmail: string;
    participants: string[];
  },
): Promise<EmailThread> {
  const normalized = normalizeSubject(args.subject);
  const { data, error } = await supabase
    .from("meridian_email_threads")
    .insert({
      mailbox_id: args.mailbox.id,
      thread_key: `${args.mailbox.address}|${args.externalEmail}|${normalized}`,
      subject: args.subject || "(no subject)",
      normalized_subject: normalized,
      participants: args.participants,
      status: "open",
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create email thread.");
  return data as EmailThread;
}

async function bumpThread(
  supabase: SupabaseClient,
  thread: EmailThread,
  args: { preview: string; at: string | null; inbound: boolean; participants: string[] },
): Promise<void> {
  const participants = Array.from(new Set([...(thread.participants || []), ...args.participants].filter(Boolean)));
  const { count } = await supabase
    .from("meridian_email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread.id);
  await supabase
    .from("meridian_email_threads")
    .update({
      participants,
      unread_count: args.inbound ? (thread.unread_count || 0) + 1 : thread.unread_count || 0,
      message_count: count ?? Math.max(1, thread.message_count || 0),
      last_message_at: args.at || new Date().toISOString(),
      last_message_preview: args.preview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", thread.id);
}

export async function recordResendWebhookEvent(
  supabase: SupabaseClient,
  svixId: string,
  event: ResendWebhookEvent,
): Promise<{ duplicate: boolean }> {
  const { data: existing } = await supabase
    .from("meridian_email_webhook_events")
    .select("svix_id, processed_at")
    .eq("svix_id", svixId)
    .maybeSingle();
  if (existing) return { duplicate: true };

  const { error } = await supabase.from("meridian_email_webhook_events").insert({
    svix_id: svixId,
    event_type: event.type,
    event_created_at: text(event.created_at),
    payload: event as unknown as JsonMap,
  });
  if (error) throw new Error(error.message);
  return { duplicate: false };
}

export async function markWebhookProcessed(supabase: SupabaseClient, svixId: string, error?: string | null): Promise<void> {
  await supabase
    .from("meridian_email_webhook_events")
    .update({ processed_at: new Date().toISOString(), error: error || null })
    .eq("svix_id", svixId);
}

export async function ingestReceivedEmail(supabase: SupabaseClient, emailId: string): Promise<EmailMessage> {
  const email = await resendRequest<ResendReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`);
  const toEmails = cleanEmailList(email.to);
  const mailbox = await ensureMailboxForAddress(supabase, toEmails[0] || process.env.RESEND_MEMBERS_EMAIL || `inbox@${process.env.RESEND_DOMAIN || "example.com"}`);
  const fromEmail = cleanEmail(email.from);
  const subject = text(email.subject) || "(no subject)";
  const bodyText = text(email.text) || (email.html ? stripHtml(email.html) : null);
  const bodyHtml = text(email.html);
  const preview = previewFrom(bodyText, bodyHtml, subject);
  const participants = Array.from(new Set([fromEmail, ...toEmails, ...cleanEmailList(email.cc), ...cleanEmailList(email.reply_to)].filter(Boolean)));

  let thread = await findThreadForReceivedEmail(supabase, mailbox, email, fromEmail);
  if (!thread) {
    thread = await createThread(supabase, {
      mailbox,
      subject,
      externalEmail: fromEmail || "unknown",
      participants,
    });
  }

  const messageRow = {
    thread_id: thread.id,
    mailbox_id: mailbox.id,
    provider: "resend",
    provider_email_id: email.id,
    provider_message_id: text(email.message_id),
    direction: "inbound",
    from_email: fromEmail || null,
    from_name: displayNameFromAddress(email.from),
    to_emails: toEmails,
    cc_emails: cleanEmailList(email.cc),
    bcc_emails: cleanEmailList(email.bcc),
    reply_to_emails: cleanEmailList(email.reply_to),
    subject,
    preview,
    body_text: bodyText,
    body_html: bodyHtml,
    headers: email.headers || {},
    raw_payload: email as unknown as JsonMap,
    status: "received",
    provider_created_at: text(email.created_at) || new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from("meridian_email_messages")
    .upsert(messageRow, { onConflict: "provider,provider_email_id" })
    .select()
    .single();
  if (error || !saved) throw new Error(error?.message ?? "Could not save inbound email.");

  const message = saved as EmailMessage;
  const attachments = email.attachments || [];
  if (attachments.length > 0) {
    await supabase.from("meridian_email_attachments").delete().eq("message_id", message.id);
    await supabase.from("meridian_email_attachments").insert(attachments.map(item => ({
      message_id: message.id,
      provider_attachment_id: text(item.id),
      filename: text(item.filename) || "attachment",
      content_type: text(item.content_type),
      content_disposition: text(item.content_disposition),
      content_id: text(item.content_id),
      size_bytes: item.size ?? null,
      raw_payload: item as unknown as JsonMap,
    })));
  }

  await bumpThread(supabase, thread, {
    preview,
    at: message.provider_created_at,
    inbound: true,
    participants,
  });
  return message;
}

export async function updateMessageStatusFromWebhook(supabase: SupabaseClient, event: ResendWebhookEvent): Promise<void> {
  const emailId = text(event.data?.email_id) || text(event.data?.id);
  if (!emailId) return;
  const eventName = event.type.replace(/^email\./, "");
  await supabase
    .from("meridian_email_messages")
    .update({
      status: eventName,
      raw_payload: event as unknown as JsonMap,
    })
    .eq("provider", "resend")
    .eq("provider_email_id", emailId);

  const campaignStatus = campaignRecipientStatusForEvent(event.type);
  if (campaignStatus) {
    const { data: rows } = await supabase
      .from("meridian_email_campaign_recipients")
      .update({
        status: campaignStatus,
        event_at: text(event.created_at) || new Date().toISOString(),
        raw_payload: event as unknown as JsonMap,
      })
      .eq("provider_email_id", emailId)
      .select("campaign_id");
    const campaignIds = Array.from(new Set(((rows as Array<{ campaign_id: string }> | null) ?? []).map(row => row.campaign_id)));
    for (const campaignId of campaignIds) {
      await refreshCampaignStats(supabase, campaignId);
    }
  }

  if (event.type === "email.bounced" || event.type === "email.complained") {
    const recipients = cleanEmailList(event.data?.to || event.data?.recipient || event.data?.email);
    for (const recipient of recipients) {
      await supabase.from("meridian_email_suppressions").upsert({
        email: recipient,
        reason: event.type === "email.bounced" ? "bounced" : "complained",
        source: "resend",
        notes: JSON.stringify(event.data || {}).slice(0, 500),
        updated_at: new Date().toISOString(),
      }, { onConflict: "email,reason" });
    }
  }
}

export async function listEmailInbox(supabase: SupabaseClient, args: {
  mailboxId?: string | null;
  threadId?: string | null;
  status?: string | null;
  query?: string | null;
} = {}): Promise<EmailInboxPayload> {
  const mailboxes = await ensureConfiguredMailboxes(supabase);
  let threadQuery = supabase
    .from("meridian_email_threads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(80);

  if (args.mailboxId) threadQuery = threadQuery.eq("mailbox_id", args.mailboxId);
  if (args.status && args.status !== "all") threadQuery = threadQuery.eq("status", args.status);
  else threadQuery = threadQuery.neq("status", "archived");
  const query = text(args.query)?.replace(/[,%]/g, " ").trim();
  if (query) {
    threadQuery = threadQuery.or(`subject.ilike.%${query}%,last_message_preview.ilike.%${query}%`);
  }

  const { data: threadRows, error: threadError } = await threadQuery;
  if (threadError) throw new Error(threadError.message);

  const threads = ((threadRows as EmailThread[]) ?? []).map(thread => ({
    ...thread,
    mailbox: mailboxes.find(mailbox => mailbox.id === thread.mailbox_id),
  }));
  const selectedThread = (args.threadId ? threads.find(thread => thread.id === args.threadId) : threads[0]) ?? null;

  let messages: EmailMessage[] = [];
  let attachments: EmailAttachment[] = [];
  if (selectedThread) {
    const { data: messageRows, error: messageError } = await supabase
      .from("meridian_email_messages")
      .select("*")
      .eq("thread_id", selectedThread.id)
      .order("provider_created_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (messageError) throw new Error(messageError.message);
    messages = (messageRows as EmailMessage[]) ?? [];

    if (messages.length > 0) {
      const { data: attachmentRows, error: attachmentError } = await supabase
        .from("meridian_email_attachments")
        .select("*")
        .in("message_id", messages.map(message => message.id));
      if (attachmentError) throw new Error(attachmentError.message);
      attachments = (attachmentRows as EmailAttachment[]) ?? [];
    }
  }

  return { mailboxes, threads, selectedThread: selectedThread as EmailThreadSummary | null, messages, attachments };
}

export async function markEmailThreadRead(supabase: SupabaseClient, threadId: string): Promise<void> {
  await supabase
    .from("meridian_email_threads")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function updateEmailThreadStatus(
  supabase: SupabaseClient,
  threadId: string,
  status: EmailThread["status"],
): Promise<void> {
  if (!["open", "closed", "archived"].includes(status)) throw new Error("Unsupported thread status.");
  const patch: Partial<EmailThread> = { status, updated_at: new Date().toISOString() };
  if (status === "archived") patch.unread_count = 0;
  await supabase
    .from("meridian_email_threads")
    .update(patch)
    .eq("id", threadId);
}

export async function sendPortalEmail(supabase: SupabaseClient, input: SendPortalEmailInput): Promise<EmailMessage> {
  const { data: mailboxRow, error: mailboxError } = await supabase
    .from("meridian_email_mailboxes")
    .select("*")
    .eq("id", input.mailboxId)
    .single();
  if (mailboxError || !mailboxRow) throw new Error(mailboxError?.message ?? "Mailbox not found.");
  const mailbox = mailboxRow as EmailMailbox;

  const toEmails = cleanEmailList(input.to);
  const ccEmails = cleanEmailList(input.cc);
  const bccEmails = cleanEmailList(input.bcc);
  if (!toEmails.length) throw new Error("At least one recipient is required.");
  if (!input.subject.trim()) throw new Error("Subject is required.");
  if (!input.text.trim() && !input.html?.trim()) throw new Error("Message body is required.");

  let thread: EmailThread | null = null;
  let headers: Record<string, string> = {};
  if (input.threadId) {
    const { data } = await supabase.from("meridian_email_threads").select("*").eq("id", input.threadId).single();
    thread = data as EmailThread | null;
    if (thread) {
      const { data: priorRows } = await supabase
        .from("meridian_email_messages")
        .select("provider_message_id")
        .eq("thread_id", thread.id)
        .not("provider_message_id", "is", null)
        .order("provider_created_at", { ascending: true, nullsFirst: false });
      const ids = ((priorRows as Array<{ provider_message_id: string | null }> | null) ?? [])
        .map(row => row.provider_message_id)
        .filter(Boolean) as string[];
      if (ids.length) {
        headers = {
          "In-Reply-To": ids[ids.length - 1],
          References: ids.join(" "),
        };
      }
    }
  }

  if (!thread) {
    thread = await createThread(supabase, {
      mailbox,
      subject: input.subject,
      externalEmail: toEmails[0],
      participants: Array.from(new Set([mailbox.address, ...toEmails, ...ccEmails])),
    });
  }

  const subject = input.threadId && !/^re:/i.test(input.subject) ? `Re: ${input.subject}` : input.subject;
  const html = input.html?.trim() || htmlFromText(input.text);
  const resendPayload = {
    from: `${mailbox.display_name} <${mailbox.address}>`,
    to: toEmails,
    cc: ccEmails.length ? ccEmails : undefined,
    bcc: bccEmails.length ? bccEmails : undefined,
    subject,
    text: input.text,
    html,
    reply_to: mailbox.address,
    headers,
    tags: [
      { name: "mailbox_id", value: mailbox.id },
      { name: "thread_id", value: thread.id },
    ],
  };

  const resend = await resendRequest<ResendSendResponse>("/emails", {
    method: "POST",
    headers: { "Idempotency-Key": randomUUID() },
    body: JSON.stringify(resendPayload),
  });

  const preview = previewFrom(input.text, html, subject);
  const now = new Date().toISOString();
  const { data: saved, error } = await supabase
    .from("meridian_email_messages")
    .insert({
      thread_id: thread.id,
      mailbox_id: mailbox.id,
      provider: "resend",
      provider_email_id: resend.id,
      direction: "outbound",
      from_email: mailbox.address,
      from_name: mailbox.display_name,
      to_emails: toEmails,
      cc_emails: ccEmails,
      bcc_emails: bccEmails,
      reply_to_emails: [mailbox.address],
      subject,
      preview,
      body_text: input.text,
      body_html: html,
      headers,
      raw_payload: resendPayload as unknown as JsonMap,
      status: "sent",
      sent_by: input.actor || null,
      provider_created_at: now,
    })
    .select()
    .single();
  if (error || !saved) throw new Error(error?.message ?? "Email sent, but could not save message.");

  await bumpThread(supabase, thread, {
    preview,
    at: now,
    inbound: false,
    participants: Array.from(new Set([mailbox.address, ...toEmails, ...ccEmails])),
  });

  return saved as EmailMessage;
}

function campaignRecipientStatusForEvent(eventType: string): EmailCampaignRecipient["status"] | null {
  if (eventType === "email.delivered") return "delivered";
  if (eventType === "email.opened") return "opened";
  if (eventType === "email.clicked") return "clicked";
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.complained") return "complained";
  if (eventType === "email.failed") return "failed";
  return null;
}

async function refreshCampaignStats(supabase: SupabaseClient, campaignId: string): Promise<void> {
  const { data } = await supabase
    .from("meridian_email_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  const statuses = ((data as Array<{ status: EmailCampaignRecipient["status"] }> | null) ?? []).map(row => row.status);
  const count = (items: string[]) => statuses.filter(status => items.includes(status)).length;
  const pendingCount = count(["pending"]);
  const sentCount = count(["sent", "delivered", "opened", "clicked"]);
  const failedCount = count(["failed"]);
  const suppressedCount = count(["suppressed"]);
  const update: Partial<EmailCampaign> = {
    recipient_count: statuses.length,
    suppressed_count: suppressedCount,
    sent_count: sentCount,
    failed_count: failedCount,
    opened_count: count(["opened", "clicked"]),
    clicked_count: count(["clicked"]),
    bounced_count: count(["bounced"]),
    complained_count: count(["complained"]),
    updated_at: new Date().toISOString(),
  };
  if (pendingCount === 0) {
    update.status = sentCount === 0 && (failedCount > 0 || suppressedCount === statuses.length) ? "failed" : "sent";
    update.sent_at = sentCount > 0 ? new Date().toISOString() : null;
  }
  await supabase.from("meridian_email_campaigns").update(update).eq("id", campaignId);
}

export async function listEmailCampaignCenter(supabase: SupabaseClient): Promise<EmailCampaignCenterPayload> {
  const mailboxes = await ensureConfiguredMailboxes(supabase);
  const [templatesResult, campaignsResult, recipientsResult, suppressionsResult] = await Promise.all([
    supabase
      .from("meridian_email_templates")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("meridian_email_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("meridian_email_campaign_recipients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("meridian_email_suppressions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  if (templatesResult.error) throw new Error(templatesResult.error.message);
  if (campaignsResult.error) throw new Error(campaignsResult.error.message);
  if (recipientsResult.error) throw new Error(recipientsResult.error.message);
  if (suppressionsResult.error) throw new Error(suppressionsResult.error.message);

  const campaigns = ((campaignsResult.data as EmailCampaign[] | null) ?? []).map(campaign => ({
    ...campaign,
    mailbox: mailboxes.find(mailbox => mailbox.id === campaign.mailbox_id),
  }));

  return {
    mailboxes,
    templates: (templatesResult.data as EmailTemplate[] | null) ?? [],
    campaigns,
    recentRecipients: (recipientsResult.data as EmailCampaignRecipient[] | null) ?? [],
    suppressions: (suppressionsResult.data as EmailSuppression[] | null) ?? [],
  };
}

export async function saveEmailTemplate(supabase: SupabaseClient, input: SaveEmailTemplateInput): Promise<EmailTemplate> {
  if (!input.name.trim()) throw new Error("Template name is required.");
  if (!input.subject.trim()) throw new Error("Template subject is required.");
  if (!input.text.trim() && !input.html?.trim()) throw new Error("Template body is required.");
  const variableSet = new Set<string>();
  for (const value of [input.subject, input.text, input.html || ""]) {
    const variablePattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let match = variablePattern.exec(value);
    while (match) {
      variableSet.add(match[1].toUpperCase());
      match = variablePattern.exec(value);
    }
  }
  const { data, error } = await supabase
    .from("meridian_email_templates")
    .insert({
      mailbox_id: input.mailboxId || null,
      name: input.name.trim(),
      description: text(input.description),
      subject: input.subject.trim(),
      body_text: input.text,
      body_html: input.html?.trim() || null,
      variables: Array.from(variableSet),
      created_by: input.actor || null,
      updated_by: input.actor || null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save template.");
  return data as EmailTemplate;
}

export async function saveEmailSuppression(
  supabase: SupabaseClient,
  input: { email: string; reason?: EmailSuppression["reason"]; notes?: string | null },
): Promise<EmailSuppression> {
  const email = cleanEmail(input.email);
  if (!email.includes("@")) throw new Error("A valid email is required.");
  const reason = input.reason || "blocked";
  const { data, error } = await supabase
    .from("meridian_email_suppressions")
    .upsert({
      email,
      reason,
      source: "portal",
      notes: text(input.notes),
      updated_at: new Date().toISOString(),
    }, { onConflict: "email,reason" })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save suppression.");
  return data as EmailSuppression;
}

export async function deleteEmailSuppression(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("meridian_email_suppressions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function resolveCampaignRecipients(supabase: SupabaseClient, input: SendEmailCampaignInput): Promise<EmailCampaignRecipientInput[]> {
  const map = new Map<string, EmailCampaignRecipientInput>();
  for (const recipient of parseManualRecipients(input.manualRecipients)) {
    map.set(recipient.email, recipient);
  }

  if (input.includeCrmAudience) {
    let query = supabase
      .from("meridian_crm_contacts")
      .select("id, display_name, email, contact_type, relationship_status")
      .not("email", "is", null)
      .is("deleted_at", null)
      .limit(1000);
    const contactTypes = (input.crmContactTypes || []).map(item => item.trim()).filter(Boolean);
    if (contactTypes.length) query = query.in("contact_type", contactTypes);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const contact of (data as Array<{ id: string; display_name: string | null; email: string | null; relationship_status: string | null }> | null) ?? []) {
      if (contact.relationship_status === "do-not-contact") continue;
      const email = cleanEmail(contact.email);
      if (email.includes("@") && !map.has(email)) {
        map.set(email, {
          email,
          displayName: contact.display_name,
          crmContactId: contact.id,
        });
      }
    }
  }

  return Array.from(map.values());
}

async function suppressedEmailSet(supabase: SupabaseClient, emails: string[]): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const { data, error } = await supabase
    .from("meridian_email_suppressions")
    .select("email")
    .in("email", emails)
    .in("reason", ["unsubscribed", "bounced", "complained", "blocked"]);
  if (error) throw new Error(error.message);
  return new Set(((data as Array<{ email: string }> | null) ?? []).map(row => cleanEmail(row.email)));
}

export async function sendCampaignTestEmail(supabase: SupabaseClient, input: SendCampaignTestEmailInput): Promise<ResendSendResponse> {
  const { data: mailboxRow, error: mailboxError } = await supabase
    .from("meridian_email_mailboxes")
    .select("*")
    .eq("id", input.mailboxId)
    .single();
  if (mailboxError || !mailboxRow) throw new Error(mailboxError?.message ?? "Mailbox not found.");
  const mailbox = mailboxRow as EmailMailbox;

  let subject = input.subject.trim();
  let bodyText = input.text;
  let bodyHtml = input.html?.trim() || null;
  if (input.templateId && (!subject || !bodyText.trim())) {
    const { data: template } = await supabase.from("meridian_email_templates").select("*").eq("id", input.templateId).single();
    const savedTemplate = template as EmailTemplate | null;
    subject = subject || savedTemplate?.subject || "";
    bodyText = bodyText.trim() || savedTemplate?.body_text || "";
    bodyHtml = bodyHtml || savedTemplate?.body_html || null;
  }

  const toEmail = cleanEmail(input.to);
  if (!toEmail.includes("@")) throw new Error("A valid test recipient is required.");
  if (!subject) throw new Error("Subject is required.");
  if (!bodyText.trim() && !bodyHtml?.trim()) throw new Error("Message body is required.");

  const unsubscribeUrl = `${publicBaseUrl()}/api/email/unsubscribe?token=test`;
  const variables = recipientVariables({ email: toEmail, displayName: "Test Recipient" }, unsubscribeUrl);
  const html = bodyHtml || htmlFromText(bodyText);
  return resendRequest<ResendSendResponse>("/emails", {
    method: "POST",
    headers: { "Idempotency-Key": `campaign-test-${randomUUID()}` },
    body: JSON.stringify({
      from: `${mailbox.display_name} <${mailbox.address}>`,
      to: [toEmail],
      subject: `[TEST] ${renderTemplateValue(subject, variables)}`,
      text: renderTemplateValue(bodyText, variables),
      html: renderTemplateValue(html, variables, true),
      reply_to: mailbox.address,
      tags: [
        { name: "campaign_test", value: "true" },
      ],
    }),
  });
}

export async function createEmailCampaignDraft(supabase: SupabaseClient, input: SendEmailCampaignInput): Promise<EmailCampaign> {
  const { data: mailboxRow, error: mailboxError } = await supabase
    .from("meridian_email_mailboxes")
    .select("*")
    .eq("id", input.mailboxId)
    .single();
  if (mailboxError || !mailboxRow) throw new Error(mailboxError?.message ?? "Mailbox not found.");
  const mailbox = mailboxRow as EmailMailbox;

  let subject = input.subject.trim();
  let bodyText = input.text;
  let bodyHtml = input.html?.trim() || null;
  const templateId = input.templateId || null;
  if (templateId && (!subject || !bodyText.trim())) {
    const { data: template } = await supabase.from("meridian_email_templates").select("*").eq("id", templateId).single();
    const savedTemplate = template as EmailTemplate | null;
    subject = subject || savedTemplate?.subject || "";
    bodyText = bodyText.trim() || savedTemplate?.body_text || "";
    bodyHtml = bodyHtml || savedTemplate?.body_html || null;
  }

  if (!input.name.trim()) throw new Error("Campaign name is required.");
  if (!subject) throw new Error("Campaign subject is required.");
  if (!bodyText.trim() && !bodyHtml?.trim()) throw new Error("Campaign body is required.");

  const recipients = await resolveCampaignRecipients(supabase, input);
  if (!recipients.length) throw new Error("Add at least one campaign recipient.");
  const suppressed = await suppressedEmailSet(supabase, recipients.map(recipient => recipient.email));
  const eligible = recipients.filter(recipient => !suppressed.has(recipient.email));
  const now = new Date().toISOString();

  const { data: campaignRow, error: campaignError } = await supabase
    .from("meridian_email_campaigns")
    .insert({
      mailbox_id: mailbox.id,
      template_id: templateId,
      name: input.name.trim(),
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      status: "draft",
      audience_source: input.includeCrmAudience ? "crm" : "manual",
      audience_label: input.includeCrmAudience ? "CRM contacts" : "Manual list",
      recipient_count: recipients.length,
      suppressed_count: recipients.length - eligible.length,
      error: eligible.length ? null : "Every recipient is suppressed.",
      created_by: input.actor || null,
      updated_at: now,
    })
    .select()
    .single();
  if (campaignError || !campaignRow) throw new Error(campaignError?.message ?? "Could not create campaign.");
  const campaign = campaignRow as EmailCampaign;

  const { error: recipientsError } = await supabase
    .from("meridian_email_campaign_recipients")
    .insert(recipients.map(recipient => ({
      campaign_id: campaign.id,
      crm_contact_id: recipient.crmContactId || null,
      email: recipient.email,
      display_name: recipient.displayName || null,
      status: suppressed.has(recipient.email) ? "suppressed" : "pending",
    })))
    .select();
  if (recipientsError) throw new Error(recipientsError.message);

  return campaign;
}

export async function sendSavedEmailCampaign(supabase: SupabaseClient, campaignId: string): Promise<EmailCampaign> {
  const { data: campaignRow, error: campaignError } = await supabase
    .from("meridian_email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaignRow) throw new Error(campaignError?.message ?? "Campaign not found.");
  const campaign = campaignRow as EmailCampaign;
  if (campaign.status === "sent" || campaign.status === "sending") {
    throw new Error(`Campaign is already ${campaign.status}.`);
  }

  const { data: mailboxRow, error: mailboxError } = await supabase
    .from("meridian_email_mailboxes")
    .select("*")
    .eq("id", campaign.mailbox_id)
    .single();
  if (mailboxError || !mailboxRow) throw new Error(mailboxError?.message ?? "Mailbox not found.");
  const mailbox = mailboxRow as EmailMailbox;

  await supabase
    .from("meridian_email_campaigns")
    .update({ status: "sending", error: null, updated_at: new Date().toISOString() })
    .eq("id", campaign.id);

  const { data: recipientRows, error: recipientError } = await supabase
    .from("meridian_email_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (recipientError) throw new Error(recipientError.message);

  let pending = (recipientRows as EmailCampaignRecipient[] | null) ?? [];
  const suppressed = await suppressedEmailSet(supabase, pending.map(recipient => recipient.email));
  const newlySuppressed = pending.filter(recipient => suppressed.has(cleanEmail(recipient.email)));
  if (newlySuppressed.length > 0) {
    await Promise.all(newlySuppressed.map(recipient => supabase
      .from("meridian_email_campaign_recipients")
      .update({ status: "suppressed", error: "Suppressed before send." })
      .eq("id", recipient.id)));
    pending = pending.filter(recipient => !suppressed.has(cleanEmail(recipient.email)));
  }

  if (!pending.length) {
    await supabase
      .from("meridian_email_campaigns")
      .update({ status: "failed", error: "No eligible pending recipients.", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
    await refreshCampaignStats(supabase, campaign.id);
    const { data: updated } = await supabase.from("meridian_email_campaigns").select("*").eq("id", campaign.id).single();
    return updated as EmailCampaign;
  }

  const from = `${mailbox.display_name} <${mailbox.address}>`;
  const base = publicBaseUrl();
  const textWithUnsubscribe = campaign.body_text.includes("{{UNSUBSCRIBE_URL}}")
    ? campaign.body_text
    : `${campaign.body_text.trim()}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  const htmlWithUnsubscribe = campaign.body_html?.includes("{{UNSUBSCRIBE_URL}}")
    ? campaign.body_html
    : `${campaign.body_html || htmlFromText(campaign.body_text)}<p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a></p>`;

  for (let start = 0; start < pending.length; start += 100) {
    const chunk = pending.slice(start, start + 100);
    const payload = chunk.map(recipient => {
      const unsubscribeUrl = `${base}/api/email/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
      const variables = recipientVariables(recipient, unsubscribeUrl);
      return {
        from,
        to: [recipient.email],
        subject: renderTemplateValue(campaign.subject, variables),
        text: renderTemplateValue(textWithUnsubscribe, variables),
        html: renderTemplateValue(htmlWithUnsubscribe, variables, true),
        reply_to: mailbox.address,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "campaign_id", value: campaign.id },
          { name: "recipient_id", value: recipient.id },
        ],
      };
    });

    try {
      const response = await resendRequest<ResendBatchSendResponse>("/emails/batch", {
        method: "POST",
        headers: { "Idempotency-Key": `campaign-${campaign.id}-${start}` },
        body: JSON.stringify(payload),
      });
      const ids = response.data || [];
      await Promise.all(chunk.map((recipient, index) => supabase
        .from("meridian_email_campaign_recipients")
        .update({
          provider_email_id: ids[index]?.id || null,
          status: ids[index]?.id ? "sent" : "failed",
          error: ids[index]?.id ? null : "Resend did not return an email id.",
          sent_at: new Date().toISOString(),
        })
        .eq("id", recipient.id)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send campaign batch.";
      await Promise.all(chunk.map(recipient => supabase
        .from("meridian_email_campaign_recipients")
        .update({ status: "failed", error: message })
        .eq("id", recipient.id)));
    }
  }

  await refreshCampaignStats(supabase, campaign.id);
  const { data: updated } = await supabase.from("meridian_email_campaigns").select("*").eq("id", campaign.id).single();
  return updated as EmailCampaign;
}

export async function sendEmailCampaign(supabase: SupabaseClient, input: SendEmailCampaignInput): Promise<EmailCampaign> {
  const draft = await createEmailCampaignDraft(supabase, input);
  return sendSavedEmailCampaign(supabase, draft.id);
}

export async function unsubscribeEmailRecipient(supabase: SupabaseClient, token: string): Promise<string | null> {
  const { data: recipient, error } = await supabase
    .from("meridian_email_campaign_recipients")
    .select("email")
    .eq("unsubscribe_token", token)
    .single();
  if (error || !recipient) return null;
  const email = cleanEmail((recipient as { email: string }).email);
  if (!email.includes("@")) return null;
  await supabase.from("meridian_email_suppressions").upsert({
    email,
    reason: "unsubscribed",
    source: "portal",
    notes: "Unsubscribed from campaign link.",
    updated_at: new Date().toISOString(),
  }, { onConflict: "email,reason" });
  return email;
}

export async function getAttachmentRedirectUrl(supabase: SupabaseClient, attachmentId: string): Promise<string | null> {
  const { data: attachment, error } = await supabase
    .from("meridian_email_attachments")
    .select("*, meridian_email_messages(provider_email_id)")
    .eq("id", attachmentId)
    .single();
  if (error || !attachment) return null;

  const row = attachment as EmailAttachment & { meridian_email_messages?: { provider_email_id?: string | null } };
  if (row.storage_bucket && row.storage_path) {
    const { data } = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 10);
    return data?.signedUrl ?? null;
  }
  const emailId = row.meridian_email_messages?.provider_email_id;
  if (!emailId || !row.provider_attachment_id) return null;
  const data = await resendRequest<{ download_url?: string }>(
    `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(row.provider_attachment_id)}`
  );
  return data.download_url || null;
}

export function parseAndVerifyResendWebhook(payload: string, headers: Headers): ResendWebhookEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing RESEND_WEBHOOK_SECRET.");
  const svixId = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!svixId || !timestamp || !signature) throw new Error("Missing Resend webhook signature headers.");

  const signingSecret = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
  const signedPayload = `${svixId}.${timestamp}.${payload}`;
  const expected = createHmac("sha256", signingSecret).update(signedPayload).digest("base64");
  const valid = signature.split(" ").some(part => {
    const candidate = part.replace(/^v\d+,/, "");
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!valid) throw new Error("Invalid Resend webhook signature.");

  return JSON.parse(payload) as ResendWebhookEvent;
}
