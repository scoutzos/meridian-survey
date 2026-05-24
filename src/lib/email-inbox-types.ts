export type EmailMailboxKind = "shared" | "personal" | "campaign" | "system";
export type EmailDirection = "inbound" | "outbound" | "status" | "system";
export type EmailThreadStatus = "open" | "closed" | "archived";
export type EmailCampaignStatus = "draft" | "sending" | "sent" | "failed" | "canceled";
export type EmailCampaignRecipientStatus =
  | "pending"
  | "suppressed"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

export interface EmailMailbox {
  id: string;
  address: string;
  display_name: string;
  kind: EmailMailboxKind;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  mailbox_id: string;
  thread_key: string;
  subject: string | null;
  normalized_subject: string | null;
  participants: string[];
  status: EmailThreadStatus;
  assigned_to: string | null;
  linked_lead_id: string | null;
  linked_deal_id: string | null;
  linked_crm_contact_id: string | null;
  unread_count: number;
  message_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  mailbox_id: string;
  provider: string;
  provider_email_id: string | null;
  provider_message_id: string | null;
  direction: EmailDirection;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  reply_to_emails: string[];
  subject: string | null;
  preview: string | null;
  body_text: string | null;
  body_html: string | null;
  headers: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  status: string | null;
  sent_by: string | null;
  created_at: string;
  provider_created_at: string | null;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  provider_attachment_id: string | null;
  filename: string;
  content_type: string | null;
  content_disposition: string | null;
  content_id: string | null;
  size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface EmailThreadSummary extends EmailThread {
  mailbox?: EmailMailbox;
}

export interface EmailInboxPayload {
  mailboxes: EmailMailbox[];
  threads: EmailThreadSummary[];
  selectedThread: EmailThreadSummary | null;
  messages: EmailMessage[];
  attachments: EmailAttachment[];
}

export interface EmailTemplate {
  id: string;
  mailbox_id: string | null;
  name: string;
  description: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface EmailCampaign {
  id: string;
  mailbox_id: string;
  template_id: string | null;
  name: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  status: EmailCampaignStatus;
  audience_source: string;
  audience_label: string | null;
  recipient_count: number;
  suppressed_count: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  error: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  sent_at: string | null;
  mailbox?: EmailMailbox;
}

export interface EmailCampaignRecipient {
  id: string;
  campaign_id: string;
  crm_contact_id: string | null;
  email: string;
  display_name: string | null;
  status: EmailCampaignRecipientStatus;
  provider_email_id: string | null;
  unsubscribe_token: string;
  error: string | null;
  sent_at: string | null;
  event_at: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface EmailSuppression {
  id: string;
  email: string;
  reason: "unsubscribed" | "bounced" | "complained" | "blocked";
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaignCenterPayload {
  mailboxes: EmailMailbox[];
  templates: EmailTemplate[];
  campaigns: EmailCampaign[];
  recentRecipients: EmailCampaignRecipient[];
  suppressions: EmailSuppression[];
}
