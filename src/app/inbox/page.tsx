"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type {
  EmailAttachment,
  EmailCampaignCenterPayload,
  EmailInboxPayload,
  EmailMessage,
  EmailThreadSummary,
} from "@/lib/email-inbox-types";
import { getCurrentMeridianUser } from "@/lib/identity";

type ComposeMode = "reply" | "new";
type InboxView = "inbox" | "campaigns";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function messageBody(message: EmailMessage): string {
  if (message.body_text?.trim()) return message.body_text.trim();
  if (!message.body_html) return "";
  return message.body_html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => (value || "").trim().toLowerCase()).filter(Boolean)));
}

export default function InboxPage() {
  const router = useRouter();
  const [view, setView] = useState<InboxView>("inbox");
  const [user, setUser] = useState<string | null>(null);
  const [payload, setPayload] = useState<EmailInboxPayload | null>(null);
  const [campaignPayload, setCampaignPayload] = useState<EmailCampaignCenterPayload | null>(null);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [campaignSending, setCampaignSending] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [suppressionSaving, setSuppressionSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [composeMode, setComposeMode] = useState<ComposeMode>("reply");
  const [composeMailboxId, setComposeMailboxId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [campaignMailboxId, setCampaignMailboxId] = useState("");
  const [campaignTemplateId, setCampaignTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [campaignRecipients, setCampaignRecipients] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [suppressionEmail, setSuppressionEmail] = useState("");
  const [suppressionNotes, setSuppressionNotes] = useState("");
  const [includeCrmAudience, setIncludeCrmAudience] = useState(false);
  const [crmAudienceType, setCrmAudienceType] = useState("all");

  const loadInbox = useCallback(async (threadId = selectedThreadId) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedMailboxId !== "all") params.set("mailboxId", selectedMailboxId);
    if (threadId) params.set("threadId", threadId);
    params.set("status", statusFilter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    const response = await fetch(`/api/email/inbox?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load inbox.");
      setLoading(false);
      return;
    }
    setPayload(data as EmailInboxPayload);
    const nextThreadId = (data as EmailInboxPayload).selectedThread?.id ?? null;
    setSelectedThreadId(nextThreadId);
    setLoading(false);
  }, [searchQuery, selectedMailboxId, selectedThreadId, statusFilter]);

  const loadCampaigns = useCallback(async () => {
    setCampaignLoading(true);
    setCampaignError(null);
    const response = await fetch("/api/email/campaigns");
    const data = await response.json();
    setCampaignLoading(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not load campaigns.");
      return;
    }
    setCampaignPayload(data as EmailCampaignCenterPayload);
  }, []);

  useEffect(() => {
    const currentUser = getCurrentMeridianUser();
    if (!currentUser) {
      router.push("/");
      return;
    }
    setUser(currentUser);
  }, [router]);

  useEffect(() => {
    if (user) {
      void loadInbox(null);
      void loadCampaigns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedMailboxId, searchQuery, statusFilter]);

  const selectedThread = payload?.selectedThread ?? null;
  const selectedMailbox = useMemo(() => {
    if (!payload) return null;
    return payload.mailboxes.find(mailbox => mailbox.id === (selectedThread?.mailbox_id || composeMailboxId)) || payload.mailboxes[0] || null;
  }, [composeMailboxId, payload, selectedThread?.mailbox_id]);

  const attachmentMap = useMemo(() => {
    const map: Record<string, EmailAttachment[]> = {};
    for (const attachment of payload?.attachments || []) {
      map[attachment.message_id] = [...(map[attachment.message_id] || []), attachment];
    }
    return map;
  }, [payload?.attachments]);

  const replyRecipients = useMemo(() => {
    if (!payload?.messages.length || !selectedMailbox) return [];
    const lastInbound = [...payload.messages].reverse().find(message => message.direction === "inbound");
    if (lastInbound?.from_email) return [lastInbound.from_email];
    return uniq((selectedThread?.participants || []).filter(email => email !== selectedMailbox.address));
  }, [payload?.messages, selectedMailbox, selectedThread?.participants]);

  useEffect(() => {
    if (!payload?.mailboxes.length) return;
    const mailbox = selectedThread
      ? payload.mailboxes.find(item => item.id === selectedThread.mailbox_id)
      : payload.mailboxes[0];
    setComposeMailboxId(mailbox?.id || "");
    if (composeMode === "reply" && selectedThread) {
      setTo(replyRecipients.join(", "));
      setSubject(selectedThread.subject?.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject || "(no subject)"}`);
    }
  }, [composeMode, payload?.mailboxes, replyRecipients, selectedThread]);

  useEffect(() => {
    if (!campaignPayload?.mailboxes.length || campaignMailboxId) return;
    const campaignMailbox = campaignPayload.mailboxes.find(mailbox => mailbox.kind === "campaign") || campaignPayload.mailboxes[0];
    setCampaignMailboxId(campaignMailbox.id);
  }, [campaignMailboxId, campaignPayload?.mailboxes]);

  useEffect(() => {
    const template = campaignPayload?.templates.find(item => item.id === campaignTemplateId);
    if (!template) return;
    setCampaignSubject(template.subject);
    setCampaignBody(template.body_text);
    if (template.mailbox_id) setCampaignMailboxId(template.mailbox_id);
  }, [campaignPayload?.templates, campaignTemplateId]);

  const selectThread = async (thread: EmailThreadSummary) => {
    setSelectedThreadId(thread.id);
    setComposeMode("reply");
    setBody("");
    await loadInbox(thread.id);
    if (thread.unread_count > 0) {
      await fetch("/api/email/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, action: "mark-read" }),
      });
      await loadInbox(thread.id);
    }
  };

  const setThreadStatus = async (status: "open" | "closed" | "archived") => {
    if (!selectedThread) return;
    setError(null);
    const response = await fetch("/api/email/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: selectedThread.id, action: "set-status", status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not update thread.");
      return;
    }
    await loadInbox(status === "archived" ? null : selectedThread.id);
  };

  const startNewEmail = () => {
    const mailbox = payload?.mailboxes.find(item => item.id === selectedMailboxId) || payload?.mailboxes[0];
    setComposeMode("new");
    setComposeMailboxId(mailbox?.id || "");
    setSelectedThreadId(null);
    setTo("");
    setCc("");
    setSubject("");
    setBody("");
  };

  const sendEmail = async () => {
    if (!composeMailboxId) {
      setError("Choose a sending mailbox first.");
      return;
    }
    setSending(true);
    setError(null);
    const response = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId: composeMailboxId,
        to,
        cc,
        subject,
        text: body,
        threadId: composeMode === "reply" ? selectedThread?.id : null,
        actor: user,
      }),
    });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      setError(data.error || "Could not send email.");
      return;
    }
    setBody("");
    const threadId = composeMode === "reply" ? selectedThread?.id ?? null : data.message?.thread_id ?? null;
    await loadInbox(threadId);
  };

  const saveTemplate = async () => {
    setTemplateSaving(true);
    setCampaignError(null);
    const response = await fetch("/api/email/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId: campaignMailboxId || null,
        name: campaignName || campaignSubject || "Untitled template",
        subject: campaignSubject,
        text: campaignBody,
        actor: user,
      }),
    });
    const data = await response.json();
    setTemplateSaving(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not save template.");
      return;
    }
    await loadCampaigns();
  };

  const campaignRequestBody = (action: "draft" | "send") => ({
    action,
    mailboxId: campaignMailboxId,
    templateId: campaignTemplateId || null,
    name: campaignName || campaignSubject || "Untitled campaign",
    subject: campaignSubject,
    text: campaignBody,
    manualRecipients: campaignRecipients,
    includeCrmAudience,
    crmContactTypes: crmAudienceType === "all" ? [] : [crmAudienceType],
    actor: user,
  });

  const saveCampaignDraft = async () => {
    setDraftSaving(true);
    setCampaignError(null);
    const response = await fetch("/api/email/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaignRequestBody("draft")),
    });
    const data = await response.json();
    setDraftSaving(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not save campaign draft.");
      return;
    }
    setCampaignRecipients("");
    await loadCampaigns();
  };

  const sendCampaign = async () => {
    setCampaignSending(true);
    setCampaignError(null);
    const response = await fetch("/api/email/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaignRequestBody("send")),
    });
    const data = await response.json();
    setCampaignSending(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not send campaign.");
      return;
    }
    setCampaignRecipients("");
    await loadCampaigns();
  };

  const sendTestEmail = async () => {
    setTestSending(true);
    setCampaignError(null);
    const response = await fetch("/api/email/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...campaignRequestBody("send"),
        action: "test",
        testRecipient,
      }),
    });
    const data = await response.json();
    setTestSending(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not send test email.");
      return;
    }
  };

  const sendCampaignDraft = async (campaignId: string) => {
    setCampaignSending(true);
    setCampaignError(null);
    const response = await fetch("/api/email/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send-existing", campaignId }),
    });
    const data = await response.json();
    setCampaignSending(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not send campaign draft.");
      return;
    }
    await loadCampaigns();
  };

  const saveSuppression = async () => {
    setSuppressionSaving(true);
    setCampaignError(null);
    const response = await fetch("/api/email/suppressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: suppressionEmail, reason: "blocked", notes: suppressionNotes }),
    });
    const data = await response.json();
    setSuppressionSaving(false);
    if (!response.ok) {
      setCampaignError(data.error || "Could not block email.");
      return;
    }
    setSuppressionEmail("");
    setSuppressionNotes("");
    await loadCampaigns();
  };

  const removeSuppression = async (id: string) => {
    setCampaignError(null);
    const response = await fetch("/api/email/suppressions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setCampaignError(data.error || "Could not unblock email.");
      return;
    }
    await loadCampaigns();
  };

  const mailboxes = payload?.mailboxes ?? [];
  const threads = payload?.threads ?? [];
  const messages = payload?.messages ?? [];
  const campaignMailboxes = campaignPayload?.mailboxes ?? mailboxes;
  const campaignTemplates = campaignPayload?.templates ?? [];
  const campaigns = campaignPayload?.campaigns ?? [];
  const suppressions = campaignPayload?.suppressions ?? [];
  const manualRecipientCount = campaignRecipients.split(/[\n;,]+/).map(item => item.trim()).filter(Boolean).length;

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>Portal Email</p>
          <h1 style={title}>{view === "inbox" ? "Inbox" : "Campaigns"}</h1>
          <p style={subtitle}>
            {view === "inbox"
              ? "Shared member mail, VA email, and campaign replies routed through Resend."
              : "VA campaign sends, templates, suppressions, and Resend delivery tracking."}
          </p>
        </div>
        <div style={heroActions}>
          <button onClick={() => view === "inbox" ? void loadInbox() : void loadCampaigns()} style={secondaryButton}>Refresh</button>
          {view === "inbox" && <button onClick={startNewEmail} style={primaryButton}>New Email</button>}
        </div>
      </section>

      <section style={viewTabs}>
        <button onClick={() => setView("inbox")} style={view === "inbox" ? segmentActive : segment}>Inbox</button>
        <button onClick={() => setView("campaigns")} style={view === "campaigns" ? segmentActive : segment}>Campaigns</button>
      </section>

      {view === "inbox" && error && <div style={errorBox}>{error}</div>}
      {view === "campaigns" && campaignError && <div style={errorBox}>{campaignError}</div>}

      {view === "inbox" ? (
      <>
      <section style={toolbar}>
        <div style={segmented}>
          <button onClick={() => setSelectedMailboxId("all")} style={selectedMailboxId === "all" ? segmentActive : segment}>All</button>
          {mailboxes.map(mailbox => (
            <button key={mailbox.id} onClick={() => setSelectedMailboxId(mailbox.id)} style={selectedMailboxId === mailbox.id ? segmentActive : segment}>
              {mailbox.display_name}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={selectStyle}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <input
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Search subject or preview"
          style={searchInput}
        />
      </section>

      <section style={grid}>
        <aside style={threadPane}>
          <div style={paneHeader}>
            <strong>{threads.length} thread{threads.length === 1 ? "" : "s"}</strong>
            {loading && <span style={muted}>Loading...</span>}
          </div>
          <div style={threadList}>
            {threads.map(thread => (
              <button key={thread.id} onClick={() => void selectThread(thread)} style={thread.id === selectedThread?.id ? threadActive : threadButton}>
                <span style={threadTopline}>
                  <span style={threadSubject}>{thread.subject || "(no subject)"}</span>
                  {thread.unread_count > 0 && <span style={unreadBadge}>{thread.unread_count}</span>}
                </span>
                <span style={threadMeta}>
                  {thread.mailbox?.display_name || "Mailbox"} · {formatDate(thread.last_message_at)}
                </span>
                <span style={threadPreview}>{thread.last_message_preview || "No preview yet."}</span>
              </button>
            ))}
            {!threads.length && !loading && <p style={emptyText}>No email threads yet. Once Resend receives mail, it will land here.</p>}
          </div>
        </aside>

        <section style={readerPane}>
          {selectedThread ? (
            <>
              <div style={readerHeader}>
                <div>
                  <p style={eyebrow}>{selectedThread.mailbox?.address || selectedMailbox?.address}</p>
                  <h2 style={readerTitle}>{selectedThread.subject || "(no subject)"}</h2>
                  <p style={muted}>{selectedThread.participants.join(", ") || "No participants"}</p>
                </div>
                <div style={threadActions}>
                  <span style={statusPill}>{selectedThread.status}</span>
                  {selectedThread.status !== "open" && (
                    <button onClick={() => void setThreadStatus("open")} style={secondaryButton}>Reopen</button>
                  )}
                  {selectedThread.status === "open" && (
                    <button onClick={() => void setThreadStatus("closed")} style={secondaryButton}>Close</button>
                  )}
                  {selectedThread.status !== "archived" && (
                    <button onClick={() => void setThreadStatus("archived")} style={secondaryButton}>Archive</button>
                  )}
                </div>
              </div>

              <div style={messagesWrap}>
                {messages.map(message => (
                  <article key={message.id} style={message.direction === "outbound" ? outboundMessage : inboundMessage}>
                    <div style={messageHeader}>
                      <div>
                        <strong>{message.direction === "outbound" ? message.from_name || message.from_email : message.from_name || message.from_email || "Sender"}</strong>
                        <p style={muted}>{message.direction === "outbound" ? `To ${message.to_emails.join(", ")}` : `To ${message.to_emails.join(", ")}`}</p>
                      </div>
                      <span style={muted}>{formatDate(message.provider_created_at || message.created_at)}</span>
                    </div>
                    <p style={messageText}>{messageBody(message) || message.preview || "No message body."}</p>
                    {(attachmentMap[message.id] || []).length > 0 && (
                      <div style={attachmentsWrap}>
                        {(attachmentMap[message.id] || []).map(attachment => (
                          <a key={attachment.id} href={`/api/email/attachments/${attachment.id}`} target="_blank" rel="noreferrer" style={attachmentLink}>
                            {attachment.filename}
                          </a>
                        ))}
                      </div>
                    )}
                    {message.status && <p style={messageStatus}>Status: {message.status}</p>}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div style={blankState}>
              <p style={eyebrow}>Compose</p>
              <h2 style={readerTitle}>Start a new email</h2>
              <p style={muted}>Choose a mailbox, add recipients, and send through Resend.</p>
            </div>
          )}

          <div style={composer}>
            <div style={composerTop}>
              <div style={segmentedSmall}>
                <button onClick={() => setComposeMode("reply")} disabled={!selectedThread} style={composeMode === "reply" ? segmentActive : segment}>Reply</button>
                <button onClick={startNewEmail} style={composeMode === "new" ? segmentActive : segment}>New</button>
              </div>
              <select value={composeMailboxId} onChange={event => setComposeMailboxId(event.target.value)} style={selectStyle}>
                {mailboxes.map(mailbox => <option key={mailbox.id} value={mailbox.id}>{mailbox.display_name} &lt;{mailbox.address}&gt;</option>)}
              </select>
            </div>
            <div style={composeGrid}>
              <input value={to} onChange={event => setTo(event.target.value)} placeholder="To" style={inputStyle} />
              <input value={cc} onChange={event => setCc(event.target.value)} placeholder="Cc" style={inputStyle} />
              <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Subject" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Write a reply..." rows={6} style={{ ...inputStyle, gridColumn: "1 / -1", resize: "vertical" }} />
            </div>
            <div style={composerFooter}>
              <span style={muted}>Attachments are receive-only in this first pass.</span>
              <button onClick={() => void sendEmail()} disabled={sending || !mailboxes.length} style={primaryButton}>{sending ? "Sending..." : "Send"}</button>
            </div>
          </div>
        </section>
      </section>
      </>
      ) : (
      <section style={campaignGrid}>
        <section style={campaignPanel}>
          <div style={paneHeader}>
            <strong>Campaign Composer</strong>
            {campaignLoading && <span style={muted}>Loading...</span>}
          </div>
          <div style={campaignForm}>
            <div style={composeGrid}>
              <select value={campaignMailboxId} onChange={event => setCampaignMailboxId(event.target.value)} style={inputStyle}>
                {campaignMailboxes.map(mailbox => <option key={mailbox.id} value={mailbox.id}>{mailbox.display_name} &lt;{mailbox.address}&gt;</option>)}
              </select>
              <select value={campaignTemplateId} onChange={event => setCampaignTemplateId(event.target.value)} style={inputStyle}>
                <option value="">No template</option>
                {campaignTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <input value={campaignName} onChange={event => setCampaignName(event.target.value)} placeholder="Campaign name" style={inputStyle} />
              <select value={crmAudienceType} onChange={event => setCrmAudienceType(event.target.value)} style={inputStyle}>
                <option value="all">All CRM contacts</option>
                <option value="member">Members</option>
                <option value="seller">Sellers</option>
                <option value="buyer">Buyers</option>
                <option value="agent">Agents</option>
                <option value="vendor">Vendors</option>
              </select>
              <input value={campaignSubject} onChange={event => setCampaignSubject(event.target.value)} placeholder="Subject" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <textarea value={campaignBody} onChange={event => setCampaignBody(event.target.value)} placeholder="Campaign body. You can use {{FIRST_NAME}}, {{EMAIL}}, and {{UNSUBSCRIBE_URL}}." rows={9} style={{ ...inputStyle, gridColumn: "1 / -1", resize: "vertical" }} />
              <input value={testRecipient} onChange={event => setTestRecipient(event.target.value)} placeholder="Send proof to" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <textarea value={campaignRecipients} onChange={event => setCampaignRecipients(event.target.value)} placeholder="Manual recipients, one per line" rows={7} style={{ ...inputStyle, gridColumn: "1 / -1", resize: "vertical" }} />
            </div>
            <label style={checkRow}>
              <input type="checkbox" checked={includeCrmAudience} onChange={event => setIncludeCrmAudience(event.target.checked)} />
              <span>Include CRM audience</span>
            </label>
            <div style={campaignActions}>
              <span style={muted}>{manualRecipientCount} manual recipient{manualRecipientCount === 1 ? "" : "s"}</span>
              <div style={heroActions}>
                <button onClick={() => void sendTestEmail()} disabled={testSending || !campaignMailboxes.length} style={secondaryButton}>
                  {testSending ? "Sending..." : "Send Proof"}
                </button>
                <button onClick={() => void saveTemplate()} disabled={templateSaving || !campaignBody.trim()} style={secondaryButton}>
                  {templateSaving ? "Saving..." : "Save Template"}
                </button>
                <button onClick={() => void saveCampaignDraft()} disabled={draftSaving || !campaignMailboxes.length} style={secondaryButton}>
                  {draftSaving ? "Saving..." : "Save Draft"}
                </button>
                <button onClick={() => void sendCampaign()} disabled={campaignSending || !campaignMailboxes.length} style={primaryButton}>
                  {campaignSending ? "Sending..." : "Send Campaign"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside style={campaignPanel}>
          <div style={paneHeader}>
            <strong>Recent Campaigns</strong>
            <span style={muted}>{campaigns.length} total</span>
          </div>
          <div style={campaignList}>
            {campaigns.map(campaign => (
              <article key={campaign.id} style={campaignItem}>
                <div style={threadTopline}>
                  <strong>{campaign.name}</strong>
                  <span style={statusPill}>{campaign.status}</span>
                </div>
                <p style={threadMeta}>{campaign.mailbox?.display_name || "Mailbox"} · {formatDate(campaign.sent_at || campaign.created_at)}</p>
                <p style={threadSubject}>{campaign.subject}</p>
                <div style={metricGrid}>
                  <span>Recipients <strong>{campaign.recipient_count}</strong></span>
                  <span>Sent <strong>{campaign.sent_count}</strong></span>
                  <span>Opened <strong>{campaign.opened_count}</strong></span>
                  <span>Clicked <strong>{campaign.clicked_count}</strong></span>
                  <span>Bounced <strong>{campaign.bounced_count}</strong></span>
                  <span>Suppressed <strong>{campaign.suppressed_count}</strong></span>
                </div>
                {campaign.status === "draft" && (
                  <button onClick={() => void sendCampaignDraft(campaign.id)} disabled={campaignSending} style={primaryButton}>
                    {campaignSending ? "Sending..." : "Send Draft"}
                  </button>
                )}
                {campaign.error && <p style={messageStatus}>{campaign.error}</p>}
              </article>
            ))}
            {!campaigns.length && !campaignLoading && <p style={emptyText}>No campaigns yet.</p>}
          </div>

          <div style={templateBlock}>
            <div style={paneHeader}>
              <strong>Templates</strong>
              <span style={muted}>{campaignTemplates.length} saved</span>
            </div>
            <div style={campaignList}>
              {campaignTemplates.map(template => (
                <button key={template.id} onClick={() => setCampaignTemplateId(template.id)} style={threadButton}>
                  <span style={threadSubject}>{template.name}</span>
                  <span style={threadPreview}>{template.subject}</span>
                </button>
              ))}
              {!campaignTemplates.length && <p style={emptyText}>No templates yet.</p>}
            </div>
          </div>

          <div style={templateBlock}>
            <div style={paneHeader}>
              <strong>Suppression List</strong>
              <span style={muted}>{suppressions.length} blocked</span>
            </div>
            <div style={suppressionForm}>
              <input value={suppressionEmail} onChange={event => setSuppressionEmail(event.target.value)} placeholder="Email to block" style={inputStyle} />
              <input value={suppressionNotes} onChange={event => setSuppressionNotes(event.target.value)} placeholder="Reason or note" style={inputStyle} />
              <button onClick={() => void saveSuppression()} disabled={suppressionSaving} style={secondaryButton}>
                {suppressionSaving ? "Saving..." : "Block Email"}
              </button>
            </div>
            <div style={campaignList}>
              {suppressions.map(item => (
                <article key={item.id} style={suppressionItem}>
                  <div>
                    <strong>{item.email}</strong>
                    <p style={threadMeta}>{item.reason} · {formatDate(item.updated_at)}</p>
                    {item.notes && <p style={threadPreview}>{item.notes}</p>}
                  </div>
                  <button onClick={() => void removeSuppression(item.id)} style={secondaryButton}>Unblock</button>
                </article>
              ))}
              {!suppressions.length && <p style={emptyText}>No suppressed emails yet.</p>}
            </div>
          </div>
        </aside>
      </section>
      )}
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  padding: "28px",
};

const hero: CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  gap: 18,
  justifyContent: "space-between",
  margin: "0 auto 18px",
  maxWidth: 1320,
};

const eyebrow: CSSProperties = {
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  marginBottom: 7,
  textTransform: "uppercase",
};

const title: CSSProperties = {
  color: "var(--obsidian)",
  fontFamily: "var(--font-display)",
  fontSize: 46,
  fontWeight: 500,
  lineHeight: 1,
};

const subtitle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 14,
  marginTop: 8,
};

const heroActions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const viewTabs: CSSProperties = {
  display: "flex",
  gap: 6,
  margin: "0 auto 14px",
  maxWidth: 1320,
};

const toolbar: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  margin: "0 auto 14px",
  maxWidth: 1320,
};

const segmented: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const segmentedSmall: CSSProperties = {
  display: "flex",
  gap: 6,
};

const segment: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 11px",
};

const segmentActive: CSSProperties = {
  ...segment,
  background: "var(--obsidian)",
  borderColor: "var(--obsidian)",
  color: "var(--bone)",
};

const grid: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "minmax(280px, 390px) minmax(0, 1fr)",
  margin: "0 auto",
  maxWidth: 1320,
};

const campaignGrid: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
  margin: "0 auto",
  maxWidth: 1320,
};

const campaignPanel: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  overflow: "hidden",
};

const campaignForm: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
};

const checkRow: CSSProperties = {
  alignItems: "center",
  color: "var(--obsidian)",
  display: "flex",
  fontSize: 13,
  fontWeight: 800,
  gap: 8,
};

const campaignActions: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
};

const campaignList: CSSProperties = {
  display: "grid",
  maxHeight: 420,
  overflowY: "auto",
};

const campaignItem: CSSProperties = {
  borderBottom: "1px solid var(--fog)",
  display: "grid",
  gap: 8,
  padding: 14,
};

const metricGrid: CSSProperties = {
  display: "grid",
  gap: 7,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  color: "var(--muted)",
  fontSize: 12,
};

const templateBlock: CSSProperties = {
  borderTop: "1px solid var(--fog)",
};

const suppressionForm: CSSProperties = {
  borderBottom: "1px solid var(--fog)",
  display: "grid",
  gap: 8,
  padding: 12,
};

const suppressionItem: CSSProperties = {
  alignItems: "center",
  borderBottom: "1px solid var(--fog)",
  display: "grid",
  gap: 10,
  gridTemplateColumns: "minmax(0, 1fr) auto",
  padding: 12,
};

const threadPane: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  minHeight: 620,
  overflow: "hidden",
};

const paneHeader: CSSProperties = {
  alignItems: "center",
  borderBottom: "1px solid var(--fog)",
  display: "flex",
  justifyContent: "space-between",
  padding: 14,
};

const threadList: CSSProperties = {
  display: "grid",
  maxHeight: 680,
  overflowY: "auto",
};

const threadButton: CSSProperties = {
  background: "transparent",
  border: 0,
  borderBottom: "1px solid var(--fog)",
  color: "var(--obsidian)",
  cursor: "pointer",
  display: "grid",
  gap: 6,
  padding: 14,
  textAlign: "left",
};

const threadActive: CSSProperties = {
  ...threadButton,
  background: "rgba(196, 167, 105, 0.16)",
};

const threadTopline: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const threadSubject: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const threadMeta: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
};

const threadPreview: CSSProperties = {
  color: "var(--ink)",
  fontSize: 12,
  lineHeight: 1.35,
  opacity: 0.8,
};

const unreadBadge: CSSProperties = {
  background: "var(--brass)",
  borderRadius: 999,
  color: "var(--obsidian)",
  fontSize: 11,
  fontWeight: 900,
  minWidth: 22,
  padding: "3px 7px",
  textAlign: "center",
};

const readerPane: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  minHeight: 620,
  overflow: "hidden",
};

const readerHeader: CSSProperties = {
  alignItems: "flex-start",
  borderBottom: "1px solid var(--fog)",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  padding: 18,
};

const threadActions: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-end",
};

const readerTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 500,
  lineHeight: 1.05,
};

const statusPill: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
  textTransform: "capitalize",
};

const messagesWrap: CSSProperties = {
  display: "grid",
  gap: 12,
  maxHeight: 430,
  overflowY: "auto",
  padding: 16,
};

const baseMessage: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  display: "grid",
  gap: 10,
  padding: 14,
};

const inboundMessage: CSSProperties = {
  ...baseMessage,
  background: "var(--surface2)",
  marginRight: 40,
};

const outboundMessage: CSSProperties = {
  ...baseMessage,
  background: "rgba(28, 45, 48, 0.06)",
  marginLeft: 40,
};

const messageHeader: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
};

const messageText: CSSProperties = {
  color: "var(--ink)",
  fontSize: 14,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
};

const messageStatus: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
};

const attachmentsWrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const attachmentLink: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 12,
  fontWeight: 800,
  padding: "7px 9px",
  textDecoration: "none",
};

const composer: CSSProperties = {
  borderTop: "1px solid var(--fog)",
  display: "grid",
  gap: 12,
  padding: 16,
};

const composerTop: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "space-between",
};

const composeGrid: CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr 1fr",
};

const composerFooter: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
};

const inputStyle: CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 14,
  padding: "10px 11px",
  width: "100%",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  maxWidth: 320,
};

const searchInput: CSSProperties = {
  ...inputStyle,
  maxWidth: 280,
};

const primaryButton: CSSProperties = {
  background: "var(--brass)",
  border: "1px solid var(--brass)",
  borderRadius: 7,
  color: "var(--obsidian)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 900,
  padding: "10px 14px",
  textTransform: "uppercase",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "var(--surface)",
  borderColor: "var(--fog)",
  color: "var(--obsidian)",
};

const muted: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
};

const emptyText: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  padding: 16,
};

const blankState: CSSProperties = {
  borderBottom: "1px solid var(--fog)",
  padding: 28,
};

const errorBox: CSSProperties = {
  background: "rgba(146, 58, 46, 0.1)",
  border: "1px solid rgba(146, 58, 46, 0.26)",
  borderRadius: 8,
  color: "#7d2f25",
  margin: "0 auto 14px",
  maxWidth: 1320,
  padding: 12,
};
