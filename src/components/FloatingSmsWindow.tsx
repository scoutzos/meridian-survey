"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { CommunicationEvent } from "@/lib/communications";
import { fetchCommunicationEvents } from "@/lib/communications";
import type { ImportedLandLead } from "@/lib/land-leads";

type SmsThread = {
  key: string;
  phone: string;
  label: string;
  subtitle: string;
  status: string;
  dealId: string | null;
  lead: ImportedLandLead | null;
  events: CommunicationEvent[];
  lastAt: string;
  unread: number;
};

type FloatingSmsWindowProps = {
  user: string;
  leads: ImportedLandLead[];
  events: CommunicationEvent[];
  canSend?: boolean;
  onOpenLead?: (lead: ImportedLandLead) => void;
  onOpenDeal?: (dealId: string) => void;
  onCreateDealBrief?: (lead: ImportedLandLead) => void;
  onMarkInterested?: (lead: ImportedLandLead) => void;
  onSent?: (leadId?: string | null) => Promise<void> | void;
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function last10(value: string | null | undefined): string {
  const d = digits(value);
  return d.length > 10 ? d.slice(-10) : d;
}

function displayPhone(value: string | null | undefined): string {
  const d = last10(value);
  if (d.length !== 10) return value || "No phone";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function leadName(lead: ImportedLandLead | null): string {
  if (!lead) return "Unmatched seller";
  return lead.owner_name || lead.property_address || lead.parcel_id || lead.phone || lead.phone_2 || "Imported lead";
}

function eventTime(event: CommunicationEvent): string {
  return event.provider_created_at || event.created_at;
}

function contactPhoneFor(event: CommunicationEvent): string {
  return last10(event.contact_number || (event.direction === "inbound" ? event.from_number : event.to_number));
}

function sentByLabel(event: CommunicationEvent): string | null {
  if (event.direction !== "outbound") return null;
  const payload = event.raw_payload ?? {};
  const value = payload.meridian_sent_by || payload.meridian_actor || payload.actor || payload.sent_by;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildThreads(events: CommunicationEvent[], leads: ImportedLandLead[]): SmsThread[] {
  const leadById = new Map(leads.map(lead => [lead.id, lead]));
  const leadByPhone = new Map<string, ImportedLandLead>();
  leads.forEach(lead => {
    const primary = last10(lead.phone);
    const secondary = last10(lead.phone_2);
    if (primary) leadByPhone.set(primary, lead);
    if (secondary) leadByPhone.set(secondary, lead);
  });

  const groups = new Map<string, CommunicationEvent[]>();
  events
    .filter(event => event.channel === "sms" || event.provider === "sakari")
    .forEach(event => {
      const phone = contactPhoneFor(event);
      const key = event.matched_lead_id ? `lead:${event.matched_lead_id}` : event.matched_deal_id ? `deal:${event.matched_deal_id}` : phone ? `phone:${phone}` : `event:${event.id}`;
      groups.set(key, [...(groups.get(key) ?? []), event]);
    });

  return Array.from(groups.entries()).map(([key, rows]) => {
    const sorted = [...rows].sort((a, b) => eventTime(b).localeCompare(eventTime(a)));
    const first = sorted[0];
    const phone = contactPhoneFor(first);
    const lead = first.matched_lead_id ? leadById.get(first.matched_lead_id) ?? null : leadByPhone.get(phone) ?? null;
    const dealId = first.matched_deal_id || lead?.deal_id || null;
    return {
      key,
      phone,
      label: first.contact_name || leadName(lead),
      subtitle: lead?.property_address || lead?.parcel_id || lead?.county || displayPhone(phone),
      status: dealId ? "deal linked" : lead?.status || "unmatched",
      dealId,
      lead,
      events: sorted,
      lastAt: eventTime(first),
      unread: sorted.filter(event => event.direction === "inbound").length,
    };
  }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export default function FloatingSmsWindow({
  user,
  leads,
  events,
  canSend = true,
  onOpenLead,
  onOpenDeal,
  onCreateDealBrief,
  onMarkInterested,
  onSent,
}: FloatingSmsWindowProps) {
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [threadEvents, setThreadEvents] = useState<CommunicationEvent[]>([]);
  const [reply, setReply] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newSearch, setNewSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const dragRef = useRef({ pointerId: 0, startX: 0, startY: 0, originX: 0, originY: 0 });

  const threads = useMemo(() => buildThreads(events, leads), [events, leads]);
  const selectedThread = threads.find(thread => thread.key === selectedKey) ?? threads[0] ?? null;
  const selectedLead = selectedThread?.lead ?? null;
  const selectedPhone = selectedThread?.phone ?? last10(newPhone);
  const contextTitleText = selectedLead?.property_address || (selectedThread?.dealId ? "Connected deal packet" : "No linked property yet");
  const contextMetaText = [
    selectedLead?.county,
    selectedLead?.state,
    selectedLead?.parcel_id ? `Parcel ${selectedLead.parcel_id}` : "",
    selectedLead?.acreage ? `${selectedLead.acreage} acres` : "",
    selectedLead?.campaign_source || selectedLead?.source_system,
  ].filter(Boolean).join(" · ");
  const openSelectedRecord = () => {
    if (selectedThread?.dealId) onOpenDeal?.(selectedThread.dealId);
    else if (selectedLead) onOpenLead?.(selectedLead);
  };

  useEffect(() => {
    if (!selectedKey && threads[0]) setSelectedKey(threads[0].key);
    if (selectedKey && !threads.some(thread => thread.key === selectedKey)) setSelectedKey(threads[0]?.key ?? null);
  }, [selectedKey, threads]);

  useEffect(() => {
    if (!selectedThread) {
      setThreadEvents([]);
      return;
    }
    setThreadEvents(selectedThread.events);
    if (selectedThread.lead?.id) {
      void fetchCommunicationEvents({ leadId: selectedThread.lead.id, limit: 50 }).then(setThreadEvents);
    } else if (selectedThread.dealId) {
      void fetchCommunicationEvents({ dealId: selectedThread.dealId, limit: 50 }).then(setThreadEvents);
    }
  }, [selectedThread]);

  const leadSuggestions = useMemo(() => {
    const query = newSearch.trim().toLowerCase();
    if (!query) return leads.filter(lead => lead.phone || lead.phone_2).slice(0, 5);
    return leads.filter(lead => [
      lead.owner_name,
      lead.phone,
      lead.phone_2,
      lead.property_address,
      lead.parcel_id,
      lead.county,
    ].some(value => String(value ?? "").toLowerCase().includes(query))).slice(0, 5);
  }, [leads, newSearch]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || dragRef.current.pointerId !== event.pointerId) return;
    setPosition({
      x: dragRef.current.originX + event.clientX - dragRef.current.startX,
      y: dragRef.current.originY + event.clientY - dragRef.current.startY,
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === event.pointerId) setDragging(false);
  };

  const sendText = async (toNumber: string, message: string, leadId?: string | null) => {
    if (!canSend) { setStatus("You can review SMS history, but sending is limited to VA/admin users."); return; }
    const body = message.trim();
    if (!last10(toNumber)) { setStatus("Add a phone number first."); return; }
    if (!body) { setStatus("Write a message before sending."); return; }
    setSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/sakari/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber,
          message: body,
          actor: user,
          leadId: leadId ?? null,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setStatus(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setReply("");
      setNewBody("");
      setShowNew(false);
      setStatus("SMS sent.");
      await onSent?.(leadId ?? null);
      if (leadId) setThreadEvents(await fetchCommunicationEvents({ leadId, limit: 50 }));
    } catch (error) {
      setStatus(`SMS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); setMinimized(false); }} style={launcher}>
        SMS
        {threads.length > 0 && <span style={launcherBadge}>{threads.length}</span>}
      </button>
    );
  }

  return (
    <section style={{ ...shell, transform: `translate(${position.x}px, ${position.y}px)` }}>
      <div
        style={{ ...titleBar, cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div>
          <p style={eyebrow}>Live SMS</p>
          <strong style={{ color: "var(--bone)", fontSize: 13 }}>Seller text command</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={badge}>{threads.length}</span>
          <button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setMinimized(value => !value)} style={iconButton}>{minimized ? "Open" : "Min"}</button>
          <button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setOpen(false)} style={iconButton}>Close</button>
        </div>
      </div>

      {!minimized && (
        <div style={body}>
          <aside style={threadList}>
            <div style={searchWrap}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>⌕</span>
              <input value={newSearch} onChange={event => setNewSearch(event.target.value)} placeholder="Search threads by name or phone..." style={threadSearch} />
              <button type="button" style={filterButton}>☷</button>
            </div>
            {canSend && <button type="button" onClick={() => setShowNew(value => !value)} style={newButton}>+ Start New Text</button>}
            {threads.filter(thread => {
              if (showNew) return true;
              const query = newSearch.trim().toLowerCase();
              if (!query) return true;
              return [thread.label, thread.phone, thread.subtitle, thread.status].some(value => value.toLowerCase().includes(query));
            }).map(thread => (
              <button
                type="button"
                key={thread.key}
                onClick={() => { setSelectedKey(thread.key); setShowNew(false); }}
                style={{ ...threadButton, ...(selectedThread?.key === thread.key && !showNew ? activeThread : {}) }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={threadName}>{thread.label}</strong>
                  <span style={threadTime}>{formatTime(thread.lastAt)}</span>
                </span>
                <span style={threadMeta}>{thread.subtitle}</span>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{ ...statusChip, ...(thread.status.includes("deal") ? dealChip : thread.status === "interested" ? interestedChip : {}) }}>{thread.status}</span>
                  {thread.unread > 0 && <span style={unreadBadge}>{thread.unread}</span>}
                </span>
              </button>
            ))}
            {threads.length === 0 && <p style={emptyText}>No SMS threads yet.</p>}
          </aside>

          <main style={conversation}>
            {showNew ? (
              <div style={newPanel}>
                <p style={eyebrowLight}>New outbound text</p>
                <input value={newSearch} onChange={event => setNewSearch(event.target.value)} placeholder="Search lead, seller, parcel, county..." style={input} />
                <div style={{ display: "grid", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                  {leadSuggestions.map(lead => (
                    <button
                      type="button"
                      key={lead.id}
                      onClick={() => {
                        setNewPhone(lead.phone || lead.phone_2 || "");
                        setNewSearch(leadName(lead));
                      }}
                      style={suggestion}
                    >
                      <strong>{leadName(lead)}</strong>
                      <span>{displayPhone(lead.phone || lead.phone_2)} · {lead.county || "No county"}</span>
                    </button>
                  ))}
                </div>
                <input value={newPhone} onChange={event => setNewPhone(event.target.value)} placeholder="Phone number" style={input} />
                <textarea value={newBody} onChange={event => setNewBody(event.target.value)} rows={4} placeholder="Write the first text..." style={textarea} />
                <button type="button" onClick={() => sendText(newPhone, newBody, leadSuggestions.find(lead => last10(lead.phone) === last10(newPhone) || last10(lead.phone_2) === last10(newPhone))?.id ?? null)} disabled={sending} style={sendButton}>
                  {sending ? "Sending..." : "Send Text"}
                </button>
              </div>
            ) : selectedThread ? (
              <>
                <div style={contextCard}>
                  <div>
                    <h3 style={personTitle}>{selectedThread.label}</h3>
                    <p style={personMeta}>{displayPhone(selectedPhone)}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button type="button" onClick={openSelectedRecord} style={roundAction}>☎</button>
                    <button type="button" onClick={() => selectedLead ? onCreateDealBrief?.(selectedLead) : selectedThread.dealId ? onOpenDeal?.(selectedThread.dealId) : undefined} style={roundAction}>◇</button>
                    <button type="button" onClick={openSelectedRecord} style={roundAction}>…</button>
                  </div>
                </div>

                <div style={propertyStrip}>
                  <div style={propertyIcon}>⌂</div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={propertyTitle}>{contextTitleText}</strong>
                    <p style={propertyMeta}>{contextMetaText || selectedThread.subtitle}</p>
                  </div>
                  <button type="button" onClick={openSelectedRecord} style={openLeadButton}>
                    {selectedThread.dealId ? "Open Deal" : selectedLead ? "Open Lead" : "Unmatched"}
                  </button>
                </div>

                <div style={actionRow}>
                  {selectedLead && <button type="button" onClick={() => onOpenLead?.(selectedLead)} style={smallAction}>Open Lead</button>}
                  {selectedThread.dealId && <button type="button" onClick={() => onOpenDeal?.(selectedThread.dealId!)} style={smallAction}>Open Deal</button>}
                  {selectedLead && <button type="button" onClick={() => onCreateDealBrief?.(selectedLead)} style={smallAction}>Create Deal Brief</button>}
                  {canSend && selectedLead && selectedLead.status !== "interested" && <button type="button" onClick={() => onMarkInterested?.(selectedLead)} style={smallAction}>Mark Interested</button>}
                </div>

                <div style={messages}>
                  {threadEvents
                    .filter(event => event.direction === "inbound" || event.direction === "outbound")
                    .sort((a, b) => eventTime(a).localeCompare(eventTime(b)))
                    .map(event => (
                      <div key={event.id} style={{ ...bubble, ...(event.direction === "outbound" ? outgoing : incoming) }}>
                        <p style={{ margin: 0 }}>{event.body || event.status || "SMS update"}</p>
                        <span style={bubbleTime}>
                          {formatTime(eventTime(event))}
                          {sentByLabel(event) ? ` · Sent by ${sentByLabel(event)}` : event.direction === "outbound" ? " · Sent from Meridian" : ""}
                        </span>
                      </div>
                    ))}
                  {threadEvents.length === 0 && <p style={emptyText}>No messages in this thread yet.</p>}
                </div>

                {canSend ? (
                  <div style={composer}>
                    <div style={composerTabs}><span style={activeComposerTab}>Text</span><span>Note</span></div>
                    <textarea value={reply} onChange={event => setReply(event.target.value)} rows={3} placeholder="Reply to this seller..." style={textarea} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={counter}>{reply.trim().length}/1200</span>
                      <button type="button" onClick={() => sendText(selectedPhone, reply, selectedLead?.id ?? null)} disabled={sending || !reply.trim()} style={{ ...sendButton, opacity: sending || !reply.trim() ? 0.55 : 1 }}>
                        {sending ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={composer}>
                    <p style={emptyText}>SMS replies are view-only here. VA/admin users can send texts from this window.</p>
                  </div>
                )}
              </>
            ) : (
              <p style={emptyText}>Select a thread or start a new text.</p>
            )}
            {status && <p style={statusLine}>{status}</p>}
          </main>
        </div>
      )}
    </section>
  );
}

const shell: CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 24,
  zIndex: 260,
  width: "min(860px, calc(100vw - 32px))",
  background: "var(--surface)",
  border: "1px solid rgba(176,137,84,0.42)",
  borderRadius: 8,
  boxShadow: "0 24px 70px rgba(20,17,13,0.28)",
  overflow: "hidden",
};

const titleBar: CSSProperties = {
  alignItems: "center",
  background: "var(--obsidian)",
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 14px",
  userSelect: "none",
};

const body: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "320px minmax(0, 1fr)",
  minHeight: 520,
};

const threadList: CSSProperties = {
  background: "rgba(255,252,245,0.94)",
  borderRight: "1px solid var(--fog)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 520,
  overflowY: "auto",
  padding: 10,
};

const conversation: CSSProperties = {
  background: "rgba(255,252,245,0.86)",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  padding: 12,
};

const newButton: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  padding: "10px 12px",
  textTransform: "uppercase",
};

const threadButton: CSSProperties = {
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--fog)",
  borderRadius: 0,
  color: "var(--obsidian)",
  padding: "12px 8px",
  textAlign: "left",
};

const activeThread: CSSProperties = {
  background: "rgba(176,137,84,0.12)",
  boxShadow: "inset 3px 0 0 var(--brass)",
};

const threadName: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.2,
};

const threadTime: CSSProperties = {
  color: "var(--muted)",
  flexShrink: 0,
  fontSize: 10,
};

const threadMeta: CSSProperties = {
  color: "var(--muted)",
  display: "block",
  fontSize: 11,
  marginTop: 3,
};

const statusChip: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.1em",
  padding: "3px 7px",
  textTransform: "uppercase",
};

const interestedChip: CSSProperties = {
  background: "rgba(55,130,91,0.12)",
  borderColor: "rgba(55,130,91,0.24)",
  color: "#2f7652",
};

const dealChip: CSSProperties = {
  background: "rgba(176,137,84,0.14)",
  borderColor: "rgba(176,137,84,0.32)",
  color: "var(--brass)",
};

const unreadBadge: CSSProperties = {
  background: "var(--brass)",
  borderRadius: 999,
  color: "var(--obsidian)",
  fontSize: 10,
  fontWeight: 800,
  minWidth: 20,
  padding: "3px 6px",
  textAlign: "center",
};

const contextCard: CSSProperties = {
  alignItems: "center",
  background: "transparent",
  borderBottom: "1px solid var(--fog)",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
  marginBottom: 10,
  padding: "0 0 10px",
};

const personTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 14,
  fontWeight: 800,
  margin: 0,
};

const personMeta: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 3,
};

const roundAction: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  fontSize: 14,
  height: 34,
  width: 38,
};

const propertyStrip: CSSProperties = {
  alignItems: "center",
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  display: "grid",
  gap: 10,
  gridTemplateColumns: "36px minmax(0, 1fr) auto",
  marginBottom: 12,
  padding: 10,
};

const propertyIcon: CSSProperties = {
  background: "rgba(176,137,84,0.14)",
  border: "1px solid rgba(176,137,84,0.32)",
  borderRadius: 7,
  color: "var(--brass)",
  display: "grid",
  height: 34,
  placeItems: "center",
  width: 34,
};

const propertyTitle: CSSProperties = {
  color: "var(--obsidian)",
  display: "block",
  fontSize: 13,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const propertyMeta: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  marginTop: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const openLeadButton: CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  padding: "8px 10px",
  textTransform: "uppercase",
};

const actionRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 12,
};

const smallAction: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  padding: "8px 9px",
  textTransform: "uppercase",
};

const messages: CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: 8,
  maxHeight: 235,
  overflowY: "auto",
  padding: "4px 2px 10px",
};

const bubble: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  fontSize: 13,
  lineHeight: 1.42,
  maxWidth: "86%",
  padding: "9px 10px",
};

const incoming: CSSProperties = {
  alignSelf: "flex-start",
  background: "var(--bone)",
};

const outgoing: CSSProperties = {
  alignSelf: "flex-end",
  background: "rgba(176,137,84,0.14)",
};

const bubbleTime: CSSProperties = {
  color: "var(--muted)",
  display: "block",
  fontSize: 10,
  marginTop: 5,
};

const composer: CSSProperties = {
  borderTop: "1px solid var(--fog)",
  paddingTop: 10,
};

const composerTabs: CSSProperties = {
  color: "var(--muted)",
  display: "flex",
  fontSize: 12,
  gap: 16,
  marginBottom: 8,
};

const activeComposerTab: CSSProperties = {
  borderBottom: "1px solid var(--brass)",
  color: "var(--brass)",
  paddingBottom: 4,
};

const searchWrap: CSSProperties = {
  alignItems: "center",
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  display: "grid",
  gap: 6,
  gridTemplateColumns: "18px minmax(0, 1fr) 28px",
  padding: "7px 8px",
};

const threadSearch: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--obsidian)",
  fontSize: 12,
  outline: "none",
  padding: 0,
  width: "100%",
};

const filterButton: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 14,
};

const textarea: CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  fontSize: 13,
  lineHeight: 1.4,
  padding: 10,
  resize: "vertical",
  width: "100%",
};

const input: CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 13,
  padding: "9px 10px",
  width: "100%",
};

const sendButton: CSSProperties = {
  background: "var(--brass)",
  border: "1px solid var(--brass)",
  borderRadius: 7,
  color: "var(--obsidian)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.12em",
  padding: "10px 14px",
  textTransform: "uppercase",
};

const counter: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
};

const statusLine: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 8,
};

const emptyText: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.45,
  padding: 8,
};

const eyebrow: CSSProperties = {
  color: "var(--brass)",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: "0.18em",
  marginBottom: 3,
  textTransform: "uppercase",
};

const eyebrowLight: CSSProperties = {
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.16em",
  marginBottom: 7,
  textTransform: "uppercase",
};

const badge: CSSProperties = {
  background: "rgba(237,230,214,0.14)",
  border: "1px solid rgba(237,230,214,0.18)",
  borderRadius: 999,
  color: "var(--bone)",
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 8px",
};

const iconButton: CSSProperties = {
  background: "rgba(237,230,214,0.08)",
  border: "1px solid rgba(237,230,214,0.18)",
  borderRadius: 6,
  color: "var(--bone)",
  fontSize: 10,
  fontWeight: 800,
  padding: "6px 8px",
  textTransform: "uppercase",
};

const launcher: CSSProperties = {
  alignItems: "center",
  background: "var(--obsidian)",
  border: "1px solid var(--brass)",
  borderRadius: 999,
  bottom: 24,
  boxShadow: "0 16px 40px rgba(20,17,13,0.24)",
  color: "var(--bone)",
  display: "flex",
  fontSize: 12,
  fontWeight: 900,
  gap: 8,
  letterSpacing: "0.14em",
  padding: "12px 16px",
  position: "fixed",
  right: 24,
  textTransform: "uppercase",
  zIndex: 260,
};

const launcherBadge: CSSProperties = {
  background: "var(--brass)",
  borderRadius: 999,
  color: "var(--obsidian)",
  fontSize: 10,
  minWidth: 20,
  padding: "3px 6px",
};

const newPanel: CSSProperties = {
  display: "grid",
  gap: 8,
};

const suggestion: CSSProperties = {
  background: "rgba(237,230,214,0.54)",
  border: "1px solid var(--fog)",
  borderRadius: 7,
  color: "var(--obsidian)",
  display: "grid",
  fontSize: 12,
  gap: 3,
  padding: 8,
  textAlign: "left",
};
