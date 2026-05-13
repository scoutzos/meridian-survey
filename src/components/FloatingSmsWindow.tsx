"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Call, Device } from "@twilio/voice-sdk";
import type { CommunicationEvent } from "@/lib/communications";
import { fetchCommunicationEvents } from "@/lib/communications";
import { createImportedLandLeadActivity, type ImportedLandLead } from "@/lib/land-leads";
import { createDealActivity } from "@/lib/deals";
import { checkLeadCallCompliance, checkLeadSmsCompliance } from "@/lib/bulk-sms";

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
  onCreateDealBriefFromContact?: (contact: { phone: string; name?: string | null }) => void;
  onMarkInterested?: (lead: ImportedLandLead) => void;
  onSent?: (leadId?: string | null) => Promise<void> | void;
};

type OpenCommsThreadDetail = {
  threadKey?: string | null;
  phone?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  eventId?: string | null;
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

function callablePhone(value: string | null | undefined): string {
  const d = digits(value);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return value || "";
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function leadName(lead: ImportedLandLead | null): string {
  if (!lead) return "Unmatched contact";
  return lead.owner_name || lead.property_address || lead.parcel_id || lead.phone || lead.phone_2 || "Imported lead";
}

function threadPreview(thread: SmsThread): string {
  const latest = [...thread.events].sort((a, b) => eventTime(b).localeCompare(eventTime(a)))[0];
  if (!latest) return thread.subtitle;
  const body = eventBody(latest);
  return body.length > 74 ? `${body.slice(0, 74)}...` : body;
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

function eventLabel(event: CommunicationEvent): string {
  if (event.channel === "voice") {
    if (event.provider_event_type === "call-recording") return "Recording";
    if (event.direction === "inbound") return "Inbound call";
    if (event.direction === "outbound") return "Outbound call";
    return "Call update";
  }
  return event.direction === "inbound" ? "Seller" : "Meridian";
}

function eventBody(event: CommunicationEvent): string {
  if (event.channel === "voice") return event.body || event.status || "Call update";
  return event.body || event.status || "SMS update";
}

function recordingUrl(event: CommunicationEvent): string | null {
  const recording = event.media.find(item =>
    item && typeof item === "object" && (item as Record<string, unknown>).type === "recording"
  ) as Record<string, unknown> | undefined;
  const mp3Url = typeof recording?.mp3Url === "string" ? recording.mp3Url : null;
  const url = typeof recording?.url === "string" ? recording.url : null;
  return mp3Url || url;
}

type ReadState = Record<string, string>;
type PhoneState = "offline" | "connecting" | "online" | "ringing" | "in-call" | "error";

function readStorageKey(user: string): string {
  return `meridian_sms_read_threads:${user}`;
}

function windowStateStorageKey(user: string): string {
  return `meridian_sms_window_state:${user || "default"}`;
}

function phonePreferenceKey(user: string): string {
  return `meridian_twilio_phone_online:${user || "default"}`;
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function buildThreads(events: CommunicationEvent[], leads: ImportedLandLead[], readState: ReadState): SmsThread[] {
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
    .filter(event => event.channel === "sms" || event.channel === "voice" || event.provider === "sakari" || event.provider === "twilio")
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
      unread: sorted.filter(event => event.direction === "inbound" && eventTime(event) > (readState[key] ?? "")).length,
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
  onCreateDealBriefFromContact,
  onMarkInterested,
  onSent,
}: FloatingSmsWindowProps) {
  const [open, setOpen] = useState(false);
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
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [composerMode, setComposerMode] = useState<"text" | "note">("text");
  const [noteDraft, setNoteDraft] = useState("");
  const [readState, setReadState] = useState<ReadState>({});
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [phoneState, setPhoneState] = useState<PhoneState>("offline");
  const [phoneMessage, setPhoneMessage] = useState("Phone is offline.");
  const [dialNumber, setDialNumber] = useState("");
  const [activeCallStartedAt, setActiveCallStartedAt] = useState<number | null>(null);
  const [callTick, setCallTick] = useState(0);
  const dragRef = useRef({ pointerId: 0, startX: 0, startY: 0, originX: 0, originY: 0 });
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
    try {
      setReadState(JSON.parse(localStorage.getItem(readStorageKey(user)) || "{}") as ReadState);
    } catch {
      setReadState({});
    }
    try {
      const saved = JSON.parse(localStorage.getItem(windowStateStorageKey(user)) || "{}") as { open?: boolean; minimized?: boolean };
      setOpen(saved.open === true);
      setMinimized(saved.minimized === true);
    } catch {
      setOpen(false);
      setMinimized(false);
    }
  }, [user]);

  const persistWindowState = (next: { open?: boolean; minimized?: boolean }) => {
    try {
      localStorage.setItem(windowStateStorageKey(user), JSON.stringify({ open, minimized, ...next }));
    } catch {
      // Storage can be unavailable in private browsing; keep the dock usable for the current session.
    }
  };

  const openWindow = () => {
    setOpen(true);
    setMinimized(false);
    persistWindowState({ open: true, minimized: false });
  };

  const closeWindow = () => {
    setOpen(false);
    persistWindowState({ open: false });
  };

  const toggleMinimized = () => {
    setMinimized(value => {
      const next = !value;
      persistWindowState({ open: true, minimized: next });
      return next;
    });
  };

  const threads = useMemo(() => buildThreads(events, leads, readState), [events, leads, readState]);
  const selectedThread = threads.find(thread => thread.key === selectedKey) ?? threads[0] ?? null;
  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unread, 0);
  const selectedLead = selectedThread?.lead ?? null;
  const selectedPhone = selectedThread?.phone ?? last10(newPhone);
  const selectedCompliance = selectedLead ? checkLeadSmsCompliance(selectedLead) : null;
  const selectedCallCompliance = selectedLead ? checkLeadCallCompliance(selectedLead) : null;
  const dialLead = useMemo(() => leads.find(lead => last10(lead.phone) === last10(dialNumber) || last10(lead.phone_2) === last10(dialNumber)) ?? null, [dialNumber, leads]);
  const dialCompliance = dialLead ? checkLeadCallCompliance(dialLead) : null;
  const callDuration = activeCallStartedAt ? Math.max(0, Math.floor((Date.now() - activeCallStartedAt) / 1000) + callTick * 0) : 0;
  const noteDestination = selectedLead
    ? { label: `Lead activity: ${leadName(selectedLead)}`, placeholder: "Save an internal note to this lead activity timeline." }
    : selectedThread?.dealId
      ? { label: `Deal activity: ${selectedThread.label}`, placeholder: "Save an internal note to this deal activity timeline." }
      : { label: "No linked record", placeholder: "Link or create a lead/deal before saving notes." };
  const noteBlocked = !selectedLead && !selectedThread?.dealId;
  const replyBlocked = !!selectedCompliance && !selectedCompliance.allowed;
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
    else setStatus("This contact is not linked to a lead or deal yet. Use Create Packet to start one from this phone number.");
  };
  const createPacketFromSelectedContact = () => {
    if (selectedLead) {
      onCreateDealBrief?.(selectedLead);
      return;
    }
    if (selectedThread?.dealId) {
      onOpenDeal?.(selectedThread.dealId);
      return;
    }
    if (selectedPhone) {
      onCreateDealBriefFromContact?.({
        phone: selectedPhone,
        name: selectedThread?.label && selectedThread.label !== "Unmatched contact" ? selectedThread.label : null,
      });
      return;
    }
    setStatus("Add or select a phone number before creating a packet.");
  };
  const markThreadRead = useCallback((thread: SmsThread) => {
    if (!thread.unread) return;
    setReadState(prev => {
      const next = { ...prev, [thread.key]: thread.lastAt };
      localStorage.setItem(readStorageKey(user), JSON.stringify(next));
      return next;
    });
  }, [user]);
  const selectThread = useCallback((thread: SmsThread) => {
    setSelectedKey(thread.key);
    setShowNew(false);
    markThreadRead(thread);
  }, [markThreadRead]);

  const bindVoiceCall = useCallback((call: Call) => {
    call.on("accept", () => {
      setPhoneState("in-call");
      setActiveCallStartedAt(Date.now());
      setPhoneMessage("Call connected. Recording is handled by Twilio call settings.");
    });
    call.on("disconnect", () => {
      callRef.current = null;
      setActiveCallStartedAt(null);
      setPhoneState(deviceRef.current ? "online" : "offline");
      setPhoneMessage(deviceRef.current ? "Online for calls." : "Phone is offline.");
    });
    call.on("cancel", () => {
      callRef.current = null;
      setActiveCallStartedAt(null);
      setPhoneState(deviceRef.current ? "online" : "offline");
      setPhoneMessage("Incoming call ended.");
    });
    call.on("reject", () => {
      callRef.current = null;
      setActiveCallStartedAt(null);
      setPhoneState(deviceRef.current ? "online" : "offline");
      setPhoneMessage("Incoming call rejected.");
    });
  }, []);

  const goOnline = useCallback(async () => {
    if (deviceRef.current || connectingRef.current) return;
    connectingRef.current = true;
    try {
      localStorage.setItem(phonePreferenceKey(user), "online");
      setPhoneState("connecting");
      setPhoneMessage("Connecting phone...");
      const response = await fetch("/api/twilio/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: user }),
      });
      const data = await response.json().catch(() => ({})) as { token?: string; error?: string };
      if (!response.ok || !data.token) throw new Error(data.error || "Could not connect phone.");

      const device = new Device(data.token, { logLevel: 1 });
      device.on("registered", () => {
        setPhoneState("online");
        setPhoneMessage("Online for inbound and outbound calls.");
      });
      device.on("unregistered", () => {
        setPhoneState("offline");
        setPhoneMessage("Phone is offline.");
      });
      device.on("error", error => {
        setPhoneState("error");
        setPhoneMessage(error.message || "Twilio phone error.");
      });
      device.on("incoming", call => {
        callRef.current = call;
        setPhoneState("ringing");
        setPhoneMessage(`Incoming call${call.parameters.From ? ` from ${call.parameters.From}` : ""}.`);
        bindVoiceCall(call);
      });
      await device.register();
      deviceRef.current = device;
    } catch (error) {
      setPhoneState("error");
      setPhoneMessage(error instanceof Error ? error.message : "Could not connect phone.");
    } finally {
      connectingRef.current = false;
    }
  }, [bindVoiceCall, user]);

  const goOffline = useCallback(() => {
    localStorage.setItem(phonePreferenceKey(user), "offline");
    callRef.current?.disconnect();
    deviceRef.current?.unregister();
    deviceRef.current?.destroy();
    callRef.current = null;
    deviceRef.current = null;
    connectingRef.current = false;
    setActiveCallStartedAt(null);
    setPhoneState("offline");
    setPhoneMessage("Phone is offline.");
  }, [user]);

  const startCall = useCallback(async (toNumber: string, leadId?: string | null, dealId?: string | null) => {
    const normalized = last10(toNumber);
    if (!normalized) {
      setPhoneMessage("Add a phone number before dialing.");
      return;
    }
    const leadForCompliance = leadId ? leads.find(lead => lead.id === leadId) : leads.find(lead => last10(lead.phone) === normalized || last10(lead.phone_2) === normalized);
    const compliance = leadForCompliance ? checkLeadCallCompliance(leadForCompliance) : null;
    if (compliance && !compliance.allowed) {
      setPhoneMessage(`Call blocked: ${compliance.blockLabel}.`);
      setPhoneState("error");
      return;
    }
    try {
      await goOnline();
      const device = deviceRef.current;
      if (!device) throw new Error("Phone is still connecting. Try again in a moment.");
      setPhoneState("connecting");
      setPhoneMessage(`Dialing ${displayPhone(toNumber)}...`);
      const toDial = compliance?.phone?.number || callablePhone(toNumber);
      const call = await device.connect({
        params: {
          To: toDial,
          ...(leadForCompliance?.id ? { leadId: leadForCompliance.id } : leadId ? { leadId } : {}),
          ...(dealId ? { dealId } : {}),
        },
      });
      callRef.current = call;
      bindVoiceCall(call);
    } catch (error) {
      setPhoneState("error");
      setPhoneMessage(error instanceof Error ? error.message : "Could not start call.");
    }
  }, [bindVoiceCall, goOnline, leads]);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem(phonePreferenceKey(user)) === "online") void goOnline();
  }, [goOnline, user]);

  useEffect(() => {
    if (phoneState !== "in-call") return;
    const timer = window.setInterval(() => setCallTick(tick => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phoneState]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("meridian-comms-status", {
      detail: {
        phoneState,
        phoneMessage,
        unread: unreadTotal,
        callDuration,
        open,
      },
    }));
  }, [callDuration, open, phoneMessage, phoneState, unreadTotal]);

  useEffect(() => {
    if (!selectedKey && threads[0]) setSelectedKey(threads[0].key);
    if (selectedKey && !threads.some(thread => thread.key === selectedKey)) setSelectedKey(threads[0]?.key ?? null);
  }, [selectedKey, threads]);

  useEffect(() => {
    const handleOpenThread = (event: Event) => {
      const detail = (event as CustomEvent<OpenCommsThreadDetail>).detail ?? {};
      const targetPhone = last10(detail.phone);
      const targetThread = threads.find(thread =>
        thread.key === detail.threadKey
        || (!!detail.leadId && thread.lead?.id === detail.leadId)
        || (!!detail.dealId && thread.dealId === detail.dealId)
        || (!!targetPhone && thread.phone === targetPhone)
      );

      setOpen(true);
      setMinimized(false);
      setShowNew(false);
      try {
        localStorage.setItem(windowStateStorageKey(user), JSON.stringify({ open: true, minimized: false }));
      } catch {
        // Keep the event-driven open behavior even when local storage is unavailable.
      }

      if (targetThread) {
        selectThread(targetThread);
      } else if (detail.threadKey) {
        setSelectedKey(detail.threadKey);
      }
    };

    window.addEventListener("meridian-open-comms-thread", handleOpenThread);
    return () => window.removeEventListener("meridian-open-comms-thread", handleOpenThread);
  }, [selectThread, threads, user]);

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
    if (!canSend) { setStatus("You can review conversation history, but sending is limited to VA/admin users."); return; }
    const body = message.trim();
    if (!last10(toNumber)) { setStatus("Add a phone number first."); return; }
    if (!body) { setStatus("Write a message before sending."); return; }
    const leadForCompliance = leadId ? leads.find(l => l.id === leadId) : null;
    if (leadForCompliance) {
      const compliance = checkLeadSmsCompliance(leadForCompliance);
      if (!compliance.allowed) {
        const prefix = compliance.severity === "compliance" ? "Blocked for compliance" : "Cannot send";
        setStatus(`${prefix}: ${compliance.blockLabel}.`);
        return;
      }
    }
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

  const saveNote = async () => {
    const body = noteDraft.trim();
    if (!body) { setStatus("Write a note before saving."); return; }
    setSending(true);
    setStatus("");
    try {
      if (selectedLead?.id) {
        const { error } = await createImportedLandLeadActivity({
          leadId: selectedLead.id,
          actor: user,
          activityType: "note",
          summary: body,
        });
        if (error) { setStatus(`Note failed: ${error}`); return; }
      } else if (selectedThread?.dealId) {
        const { error } = await createDealActivity({
          deal_id: selectedThread.dealId,
          actor: user,
          activity_type: "note",
          summary: body,
          field_changes: { source: "live-sms-thread", phone: selectedPhone },
        });
        if (error) { setStatus(`Note failed: ${error}`); return; }
      } else {
        setStatus("Link this contact to a lead or deal before saving notes.");
        return;
      }
      setNoteDraft("");
      setStatus("Note saved to the connected record.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={openWindow} style={launcher}>
        Comms
        {threads.length > 0 && <span style={launcherBadge}>{threads.length}</span>}
      </button>
    );
  }

  return (
    <section style={{ ...shell, ...(minimized ? minimizedShell : {}), transform: `translate(${position.x}px, ${position.y}px)` }}>
      <div
        style={{ ...titleBar, ...(minimized ? minimizedTitleBar : {}), cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div>
            <p style={eyebrow}>Comms</p>
            <strong style={titleText}>Relationship comms</strong>
          </div>
          {!minimized && selectedThread && (
            <div style={headerContact}>
              <span style={headerContactName}>{selectedThread.label}</span>
              <span style={headerContactMeta}>{displayPhone(selectedThread.phone)}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!minimized && (
            <span style={{
              ...phoneHeaderPill,
              borderColor: phoneState === "online" || phoneState === "in-call" ? "rgba(68,144,95,0.42)" : "rgba(237,230,214,0.18)",
              color: phoneState === "online" || phoneState === "in-call" ? "#bfe6ca" : "var(--bone)",
            }}>
              {phoneState === "in-call" ? `On call ${formatCallDuration(callDuration)}` : phoneState === "online" ? "Phone online" : phoneState === "ringing" ? "Incoming" : "Phone offline"}
            </span>
          )}
          <span style={badge}>{unreadTotal || threads.length}</span>
          <button type="button" onPointerDown={event => event.stopPropagation()} onClick={toggleMinimized} style={iconButton}>{minimized ? "Open" : "Min"}</button>
          <button type="button" onPointerDown={event => event.stopPropagation()} onClick={closeWindow} style={iconButton}>Close</button>
        </div>
      </div>

      {!minimized && (
        <div style={body}>
          <aside style={threadList}>
            <section style={phoneDesk}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <p style={eyebrowLight}>Phone</p>
                  <strong style={phoneStateText}>
                    {phoneState === "offline" ? "Offline" : phoneState === "connecting" ? "Connecting" : phoneState === "ringing" ? "Incoming call" : phoneState === "in-call" ? `On call ${formatCallDuration(callDuration)}` : phoneState === "error" ? "Needs attention" : "Online"}
                  </strong>
                </div>
                <span style={{ ...phoneDot, background: phoneState === "ringing" || phoneState === "error" ? "var(--brass)" : phoneState === "online" || phoneState === "in-call" ? "#2f8f5b" : "var(--fog)" }} />
              </div>
              <p style={phoneMessageText}>{phoneMessage}</p>
              <div style={phoneActions}>
                {phoneState === "offline" || phoneState === "error" ? (
                  <button type="button" onClick={() => void goOnline()} style={phonePrimary}>Go Online</button>
                ) : phoneState === "ringing" ? (
                  <>
                    <button type="button" onClick={() => callRef.current?.accept()} style={phonePrimary}>Accept</button>
                    <button type="button" onClick={() => callRef.current?.reject()} style={phoneSecondary}>Decline</button>
                  </>
                ) : phoneState === "in-call" ? (
                  <button type="button" onClick={() => callRef.current?.disconnect()} style={phonePrimary}>Hang Up</button>
                ) : (
                  <button type="button" onClick={goOffline} style={phoneSecondary}>Go Offline</button>
                )}
              </div>
              <div style={dialRow}>
                <input
                  value={dialNumber}
                  onChange={event => setDialNumber(event.target.value)}
                  placeholder="Dial number..."
                  inputMode="tel"
                  style={dialInput}
                />
                <button
                  type="button"
                  onClick={() => void startCall(dialNumber, dialLead?.id ?? null, dialLead?.deal_id ?? null)}
                  disabled={!last10(dialNumber) || phoneState === "connecting" || phoneState === "ringing" || phoneState === "in-call" || dialCompliance?.allowed === false}
                  style={{ ...dialButton, opacity: !last10(dialNumber) || phoneState === "connecting" || phoneState === "ringing" || phoneState === "in-call" || dialCompliance?.allowed === false ? 0.55 : 1 }}
                  title={dialCompliance?.allowed === false ? `Call blocked: ${dialCompliance.blockLabel}.` : "Dial number"}
                >
                  Dial
                </button>
              </div>
              {dialLead && <p style={dialHint}>Matched: {leadName(dialLead)}</p>}
              {dialCompliance?.allowed === false && <p style={dialBlock}>Call blocked: {dialCompliance.blockLabel}.</p>}
            </section>
            <div style={searchWrap}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>⌕</span>
              <input value={newSearch} onChange={event => setNewSearch(event.target.value)} placeholder="Search threads by name or phone..." style={threadSearch} />
              <button
                type="button"
                onClick={() => setUnreadOnly(value => !value)}
                style={{ ...filterButton, ...(unreadOnly ? activeFilterButton : {}) }}
                title="Filter unread threads"
              >
                {unreadOnly ? "Unread" : "☷"}
              </button>
            </div>
            {canSend && <button type="button" onClick={() => setShowNew(value => !value)} style={newButton}>+ Start New Text</button>}
            {threads.filter(thread => {
              if (showNew) return true;
              const query = newSearch.trim().toLowerCase();
              if (unreadOnly && thread.unread === 0) return false;
              if (!query) return true;
              return [thread.label, thread.phone, thread.subtitle, thread.status].some(value => value.toLowerCase().includes(query));
            }).map(thread => (
              <button
                type="button"
                key={thread.key}
                onClick={() => selectThread(thread)}
                style={{ ...threadButton, ...(selectedThread?.key === thread.key && !showNew ? activeThread : {}) }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={threadName}>{thread.label}</strong>
                  <span style={threadTime}>{formatTime(thread.lastAt)}</span>
                </span>
                <span style={threadMeta}>{thread.subtitle}</span>
                <span style={threadSnippet}>{threadPreview(thread)}</span>
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
                <input value={newSearch} onChange={event => setNewSearch(event.target.value)} placeholder="Search lead, contact, parcel, county..." style={input} />
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
                  <div style={{ minWidth: 0 }}>
                    <p style={eyebrowLight}>Selected relationship</p>
                    <h3 style={personTitle}>{selectedThread.label}</h3>
                    <p style={personMeta}>
                      {displayPhone(selectedPhone)} · {selectedThread.dealId ? "Deal linked" : selectedLead ? "Lead linked" : "No record linked"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => void startCall(selectedCallCompliance?.phone?.number || selectedPhone, selectedLead?.id ?? null, selectedThread.dealId)}
                      disabled={!selectedPhone || selectedCallCompliance?.allowed === false || phoneState === "connecting" || phoneState === "ringing" || phoneState === "in-call"}
                      style={{ ...roundAction, opacity: !selectedPhone || selectedCallCompliance?.allowed === false || phoneState === "connecting" || phoneState === "ringing" || phoneState === "in-call" ? 0.55 : 1 }}
                      title={selectedCallCompliance?.allowed === false ? `Call blocked: ${selectedCallCompliance.blockLabel}.` : "Call this contact"}
                    >
                      ☎
                    </button>
                    <button type="button" onClick={createPacketFromSelectedContact} style={roundAction} title={selectedLead ? "Create packet from lead" : selectedThread.dealId ? "Open linked deal" : "Create packet from this contact"}>◇</button>
                    <button type="button" onClick={openSelectedRecord} style={roundAction}>…</button>
                  </div>
                </div>

                <div style={propertyStrip}>
                  <div style={propertyIcon}>⌂</div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={propertyTitle}>{contextTitleText}</strong>
                    <p style={propertyMeta}>{contextMetaText || selectedThread.subtitle}</p>
                  </div>
                  <span style={{
                    ...recordStatePill,
                    ...(selectedThread.dealId ? dealChip : selectedLead ? interestedChip : {}),
                  }}>
                    {selectedThread.dealId ? "Deal Linked" : selectedLead ? "Lead Linked" : "No Record"}
                  </span>
                </div>

                <div style={actionRow}>
                  {selectedLead && <button type="button" onClick={() => onOpenLead?.(selectedLead)} style={smallAction}>Open Lead</button>}
                  {selectedThread.dealId && <button type="button" onClick={() => onOpenDeal?.(selectedThread.dealId!)} style={smallAction}>Open Deal</button>}
                  <button type="button" onClick={createPacketFromSelectedContact} style={smallAction}>Create Packet</button>
                  {!selectedLead && !selectedThread.dealId && <button type="button" onClick={openSelectedRecord} style={smallAction}>Find Record</button>}
                  {canSend && selectedLead && selectedLead.status !== "interested" && <button type="button" onClick={() => onMarkInterested?.(selectedLead)} style={smallAction}>Mark Interested</button>}
                </div>

                <div style={messages}>
                  {threadEvents
                    .filter(event => event.direction === "inbound" || event.direction === "outbound" || event.channel === "voice")
                    .sort((a, b) => eventTime(a).localeCompare(eventTime(b)))
                    .map(event => {
                      const audioUrl = recordingUrl(event);
                      return (
                      <div key={event.id} style={{ ...bubble, ...(event.direction === "outbound" ? outgoing : event.channel === "voice" ? callBubble : incoming) }}>
                        <strong style={messageLabel}>{eventLabel(event)}</strong>
                        <p style={{ margin: "4px 0 0" }}>{eventBody(event)}</p>
                        {audioUrl && <a href={audioUrl} target="_blank" rel="noreferrer" style={recordingLink}>Open recording</a>}
                        <span style={bubbleTime}>
                          {formatTime(eventTime(event))}
                          {sentByLabel(event) ? ` · Sent by ${sentByLabel(event)}` : event.direction === "outbound" ? " · Sent from Meridian" : ""}
                        </span>
                      </div>
                    );})}
                  {threadEvents.length === 0 && <p style={emptyText}>No messages in this thread yet.</p>}
                </div>

                {canSend ? (
                  <div style={composer}>
                    {replyBlocked && selectedCompliance && (
                      <div style={{
                        background: selectedCompliance.severity === "compliance" ? "var(--obsidian)" : "rgba(176,137,84,0.16)",
                        border: selectedCompliance.severity === "compliance" ? "1px solid var(--obsidian)" : "1px solid var(--brass)",
                        color: selectedCompliance.severity === "compliance" ? "var(--bone)" : "var(--obsidian)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        marginBottom: 8,
                        fontSize: 12,
                        lineHeight: 1.4,
                      }}>
                        <strong style={{ display: "block", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2, color: selectedCompliance.severity === "compliance" ? "var(--brass)" : "var(--obsidian)" }}>
                          {selectedCompliance.severity === "compliance" ? "⛔ Compliance block" : "⚠ Cannot text"}
                        </strong>
                        {selectedCompliance.blockLabel} — sending disabled for this lead.
                      </div>
                    )}
                    <div style={composerTabs}>
                      <button type="button" onClick={() => setComposerMode("text")} style={composerMode === "text" ? activeComposerTab : composerTab}>Text</button>
                      <button type="button" onClick={() => setComposerMode("note")} style={composerMode === "note" ? activeComposerTab : composerTab}>Note</button>
                    </div>
                    {composerMode === "text" ? (
                      <>
                        <textarea value={reply} onChange={event => setReply(event.target.value)} rows={3} placeholder={replyBlocked ? "SMS disabled for this record." : "Reply to this contact..."} disabled={replyBlocked} style={textarea} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={counter}>{reply.trim().length}/1200</span>
                          <button type="button" onClick={() => sendText(selectedPhone, reply, selectedLead?.id ?? null)} disabled={sending || !reply.trim() || replyBlocked} style={{ ...sendButton, opacity: sending || !reply.trim() || replyBlocked ? 0.55 : 1 }}>
                            {sending ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={noteDestinationCard}>
                          <strong>{noteDestination.label}</strong>
                          <span>{noteBlocked ? "Create a packet or link this contact before saving a note." : "This note will be saved to the record named above, not as an SMS."}</span>
                        </div>
                        <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={3} placeholder={noteDestination.placeholder} disabled={noteBlocked} style={{ ...textarea, opacity: noteBlocked ? 0.62 : 1 }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={counter}>{selectedLead ? "Save note to lead activity" : selectedThread?.dealId ? "Save note to deal activity" : "No note destination"}</span>
                          <button type="button" onClick={saveNote} disabled={sending || !noteDraft.trim() || noteBlocked} style={{ ...sendButton, opacity: sending || !noteDraft.trim() || noteBlocked ? 0.55 : 1 }}>
                            {sending ? "Saving..." : "Save Note"}
                          </button>
                        </div>
                      </>
                    )}
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
  right: 20,
  bottom: 20,
  zIndex: 260,
  width: "min(880px, calc(100vw - 260px))",
  maxHeight: "calc(100vh - 112px)",
  background: "var(--surface)",
  border: "1px solid rgba(176,137,84,0.42)",
  borderRadius: 8,
  boxShadow: "0 24px 70px rgba(20,17,13,0.28)",
  overflow: "hidden",
};

const minimizedShell: CSSProperties = {
  width: "min(420px, calc(100vw - 32px))",
};

const titleBar: CSSProperties = {
  alignItems: "center",
  background: "var(--obsidian)",
  display: "flex",
  justifyContent: "space-between",
  minHeight: 58,
  padding: "9px 14px",
  userSelect: "none",
};

const minimizedTitleBar: CSSProperties = {
  padding: "9px 12px",
};

const body: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr)",
  height: "min(560px, calc(100vh - 178px))",
  minHeight: 460,
};

const threadList: CSSProperties = {
  background: "rgba(255,252,245,0.94)",
  borderRight: "1px solid var(--fog)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
  overflowY: "auto",
  padding: 12,
};

const conversation: CSSProperties = {
  background: "rgba(255,252,245,0.86)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  padding: 14,
};

const phoneDesk: CSSProperties = {
  background: "linear-gradient(135deg, rgba(20,17,13,0.96), rgba(48,38,27,0.9))",
  border: "1px solid rgba(176,137,84,0.32)",
  borderRadius: 8,
  display: "grid",
  gap: 8,
  padding: 10,
};

const phoneStateText: CSSProperties = {
  color: "var(--bone)",
  display: "block",
  fontSize: 13,
  marginTop: 2,
};

const phoneDot: CSSProperties = {
  border: "3px solid var(--surface)",
  borderRadius: 999,
  boxShadow: "0 0 0 1px rgba(20,17,13,0.08)",
  height: 14,
  width: 14,
};

const phoneMessageText: CSSProperties = {
  color: "rgba(247,242,232,0.72)",
  fontSize: 11,
  lineHeight: 1.35,
};

const phoneActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const phonePrimary: CSSProperties = {
  background: "var(--obsidian)",
  border: "1px solid var(--obsidian)",
  borderRadius: 7,
  color: "var(--bone)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
  padding: "8px 10px",
};

const phoneSecondary: CSSProperties = {
  background: "rgba(237,230,214,0.08)",
  border: "1px solid rgba(237,230,214,0.18)",
  borderRadius: 7,
  color: "var(--bone)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
  padding: "8px 10px",
};

const dialRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 6,
};

const dialInput: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 7,
  background: "var(--bone)",
  color: "var(--ink)",
  minWidth: 0,
  padding: "8px 9px",
  fontSize: 12,
};

const dialButton: CSSProperties = {
  ...phonePrimary,
  minWidth: 54,
};

const dialHint: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  lineHeight: 1.35,
};

const dialBlock: CSSProperties = {
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.35,
};

const noteDestinationCard: CSSProperties = {
  background: "rgba(176,137,84,0.1)",
  border: "1px solid rgba(176,137,84,0.28)",
  borderRadius: 7,
  display: "grid",
  gap: 3,
  marginBottom: 8,
  padding: "8px 10px",
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
  background: "rgba(255,255,255,0.48)",
  border: "1px solid transparent",
  borderBottom: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  cursor: "pointer",
  padding: "11px 10px",
  textAlign: "left",
};

const activeThread: CSSProperties = {
  background: "var(--surface)",
  borderColor: "rgba(176,137,84,0.38)",
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

const threadSnippet: CSSProperties = {
  color: "var(--ink)",
  display: "block",
  fontSize: 11,
  lineHeight: 1.35,
  marginTop: 5,
  opacity: 0.78,
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
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
  marginBottom: 10,
  padding: 12,
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
  background: "rgba(237,230,214,0.34)",
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

const recordStatePill: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: "0.1em",
  padding: "6px 9px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
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
  gap: 7,
  minHeight: 0,
  overflowY: "auto",
  padding: "6px 2px 12px",
};

const bubble: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  fontSize: 13,
  lineHeight: 1.42,
  maxWidth: "78%",
  padding: "10px 11px",
};

const incoming: CSSProperties = {
  alignSelf: "flex-start",
  background: "var(--bone)",
};

const outgoing: CSSProperties = {
  alignSelf: "flex-end",
  background: "rgba(176,137,84,0.14)",
};

const callBubble: CSSProperties = {
  alignSelf: "center",
  background: "rgba(255,255,255,0.72)",
  border: "1px dashed var(--brass)",
  maxWidth: "92%",
};

const messageLabel: CSSProperties = {
  color: "var(--brass)",
  display: "block",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const recordingLink: CSSProperties = {
  color: "var(--obsidian)",
  display: "inline-block",
  fontSize: 12,
  fontWeight: 800,
  marginTop: 7,
  textDecoration: "underline",
};

const bubbleTime: CSSProperties = {
  color: "var(--muted)",
  display: "block",
  fontSize: 10,
  marginTop: 5,
};

const composer: CSSProperties = {
  background: "rgba(255,252,245,0.96)",
  borderTop: "1px solid var(--fog)",
  bottom: 0,
  margin: "0 -2px",
  padding: "10px 2px 0",
  position: "sticky",
};

const composerTabs: CSSProperties = {
  color: "var(--muted)",
  display: "flex",
  fontSize: 12,
  gap: 16,
  marginBottom: 8,
};

const activeComposerTab: CSSProperties = {
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--brass)",
  color: "var(--brass)",
  fontSize: 12,
  paddingBottom: 4,
};

const composerTab: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 12,
  padding: "0 0 4px",
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
  fontSize: 11,
  fontWeight: 800,
};

const activeFilterButton: CSSProperties = {
  color: "var(--brass)",
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

const titleText: CSSProperties = {
  color: "var(--bone)",
  display: "block",
  fontSize: 13,
  lineHeight: 1.1,
};

const headerContact: CSSProperties = {
  borderLeft: "1px solid rgba(237,230,214,0.18)",
  display: "grid",
  gap: 2,
  minWidth: 0,
  paddingLeft: 12,
};

const headerContactName: CSSProperties = {
  color: "var(--bone)",
  fontSize: 12,
  fontWeight: 800,
  maxWidth: 230,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const headerContactMeta: CSSProperties = {
  color: "rgba(247,242,232,0.62)",
  fontSize: 10,
};

const phoneHeaderPill: CSSProperties = {
  border: "1px solid rgba(237,230,214,0.18)",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.08em",
  padding: "6px 9px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
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
