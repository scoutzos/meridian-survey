"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import OperatingHeader from "@/components/OperatingHeader";
import ConversationPanel from "@/components/ConversationPanel";
import { checkLeadSmsCompliance, renderMessageForRecipient } from "@/lib/bulk-sms";
import {
  createImportedLandLeadActivity,
  fetchImportedLandLeads,
  fetchImportedLandLeadActivities,
  updateImportedLandLeadStatus,
  type ImportedLandLead,
  type ImportedLandLeadActivity,
} from "@/lib/land-leads";
import {
  fetchCommunicationEvents,
  type CommunicationEvent,
} from "@/lib/communications";
import { labelForStatus } from "@/lib/status-map";

type Tab = "overview" | "conversation" | "properties";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "conversation", label: "Conversation" },
  { value: "properties", label: "Properties" },
];

function ownerKey(lead: ImportedLandLead): string {
  const phone = (lead.phone || lead.phone_2 || "").replace(/\D/g, "");
  const owner = (lead.owner_name || "").toLowerCase().trim();
  return `${phone}|${owner}`;
}

function describePhoneType(rawType: string | null | undefined): "Mobile" | "Landline" | "VOIP" | "Unknown" {
  if (!rawType) return "Unknown";
  const t = rawType.toLowerCase();
  if (t.includes("mobile") || t.includes("cell") || t.includes("wireless")) return "Mobile";
  if (t.includes("landline") || t.includes("land line") || t.includes("fixed")) return "Landline";
  if (t.includes("voip") || t.includes("voice over ip")) return "VOIP";
  return "Unknown";
}

interface OwnerPhones {
  number: string;
  type: ReturnType<typeof describePhoneType>;
  slot: number;
}

function collectPhones(lead: ImportedLandLead): OwnerPhones[] {
  return [
    { number: lead.phone, type: describePhoneType(lead.phone_1_type), slot: 1 },
    { number: lead.phone_2, type: describePhoneType(lead.phone_2_type), slot: 2 },
    { number: lead.phone_3, type: describePhoneType(lead.phone_3_type), slot: 3 },
    { number: lead.phone_4, type: describePhoneType(lead.phone_4_type), slot: 4 },
    { number: lead.phone_5, type: describePhoneType(lead.phone_5_type), slot: 5 },
    { number: lead.phone_6, type: describePhoneType(lead.phone_6_type), slot: 6 },
  ]
    .filter((p): p is OwnerPhones => !!p.number)
    .map(p => ({ ...p, number: p.number as string }));
}

const SMS_TEMPLATES = [
  { label: "Intro", body: "Hi {{first_name}}, this is Meridian. I was reaching out about your land in {{county}}. Would you consider selling?" },
  { label: "Follow-up", body: "Hi {{first_name}}, following up on the land you own in {{county}}. Are you open to an offer?" },
  { label: "Next step", body: "Thanks. I'm reviewing the property details now and will follow up with next steps." },
];

export default function LeadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = params?.id;
  const initialTab = (searchParams.get("tab") as Tab | null) || "overview";

  const [user, setUser] = useState<string | null>(null);
  const [lead, setLead] = useState<ImportedLandLead | null>(null);
  const [siblingProperties, setSiblingProperties] = useState<ImportedLandLead[]>([]);
  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [activities, setActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    const u = typeof window !== "undefined" ? localStorage.getItem("meridian_user") : null;
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  const loadAll = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const allLeads = await fetchImportedLandLeads(2000);
    const me = allLeads.find(l => l.id === leadId) ?? null;
    setLead(me);
    if (me) {
      const key = ownerKey(me);
      setSiblingProperties(allLeads.filter(l => l.id !== me.id && ownerKey(l) === key));
      const [comms, acts] = await Promise.all([
        fetchCommunicationEvents({ leadId: me.id, limit: 100 }),
        fetchImportedLandLeadActivities(me.id, 80),
      ]);
      setCommunications(comms);
      setActivities(acts);
      if (!expandedPropertyId) setExpandedPropertyId(me.id);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const compliance = useMemo(() => lead ? checkLeadSmsCompliance(lead) : null, [lead]);
  const phones = useMemo(() => lead ? collectPhones(lead) : [], [lead]);
  const allProperties = useMemo(() => lead ? [lead, ...siblingProperties] : [], [lead, siblingProperties]);
  const sortedConvActivities = useMemo(() => activities.map(a => ({
    id: a.id,
    title: labelForStatus(a.activity_type),
    date: a.created_at,
    body: a.summary,
    meta: a.next_follow_up_date ? `Follow up ${a.next_follow_up_date}` : null,
  })), [activities]);

  const recentConversation = useMemo(() => {
    const items = [
      ...communications.map(event => ({
        id: `comm-${event.id}`,
        kind: event.direction === "inbound" ? "inbound" : "outbound",
        date: event.provider_created_at || event.created_at,
        body: event.body || event.status || event.provider_event_type,
      })),
      ...activities.map(a => ({
        id: `act-${a.id}`,
        kind: "activity",
        date: a.created_at,
        body: `${labelForStatus(a.activity_type)}: ${a.summary}`,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    return items.slice(0, 3);
  }, [communications, activities]);

  const motivationSignals = useMemo(() => {
    if (!lead) return [] as Array<{ label: string; tone: "warn" | "good" | "muted" }>;
    const signals: Array<{ label: string; tone: "warn" | "good" | "muted" }> = [];
    if (lead.tax_delinquent) signals.push({ label: `Tax delinquent${lead.tax_delinquent_years ? ` · ${lead.tax_delinquent_years}y` : ""}`, tone: "warn" });
    if (lead.owner_out_of_state) signals.push({ label: "Out-of-state owner", tone: "warn" });
    if (lead.seller_iq) signals.push({ label: `SellerIQ: ${lead.seller_iq}`, tone: "good" });
    if (lead.tag_subdivide) signals.push({ label: "Subdividable", tone: "good" });
    if (lead.tag_entitlement) signals.push({ label: "Entitlement potential", tone: "good" });
    if (lead.status === "interested") signals.push({ label: "Interested", tone: "good" });
    return signals;
  }, [lead]);

  const nextActionText = useMemo(() => {
    if (!lead) return "";
    if (compliance?.severity === "compliance") return `Do not contact — ${compliance.blockLabel}.`;
    const lastEvent = communications[0];
    if (lastEvent?.direction === "inbound") return `Reply to ${lead.owner_name || "seller"} — last message: "${(lastEvent.body || "").slice(0, 60)}"`;
    if (lead.status === "interested") return `Build a deal packet for ${lead.owner_name || "this seller"}.`;
    if (!lead.outreach_count) return `Send first text — no outreach yet.`;
    if (lead.last_sms_direction === "outbound" && lead.last_sms_at) {
      const days = Math.floor((Date.now() - new Date(lead.last_sms_at).getTime()) / 86400000);
      if (days > 3) return `Follow up — no reply in ${days} days.`;
    }
    return `Continue the conversation.`;
  }, [lead, communications, compliance]);

  const sendSms = async () => {
    if (!lead || !compliance?.allowed) {
      if (compliance && !compliance.allowed) setMessage(`Cannot send: ${compliance.blockLabel}.`);
      return;
    }
    const body = smsDraft.trim();
    if (!body) { setMessage("Write a message before sending."); return; }
    const rendered = renderMessageForRecipient(body, lead, allProperties.length);
    setSmsSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/sakari/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: compliance.phone!.number,
          message: rendered,
          actor: user,
          leadId: lead.id,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setMessage(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      setMessage("SMS sent.");
      await loadAll();
    } finally {
      setSmsSending(false);
    }
  };

  const logDisposition = async (type: ImportedLandLeadActivity["activity_type"], summary: string, nextStatus?: ImportedLandLead["status"]) => {
    if (!lead || !user) return;
    setMessage("");
    const { error } = await createImportedLandLeadActivity({
      leadId: lead.id,
      actor: user,
      activityType: type,
      summary,
    });
    if (error) { setMessage(error); return; }
    if (nextStatus) await updateImportedLandLeadStatus(lead.id, nextStatus, lead.deal_id);
    await loadAll();
  };

  const saveNote = async () => {
    if (!lead || !user) return;
    const body = noteDraft.trim();
    if (!body) { setMessage("Write a note before saving."); return; }
    const { error } = await createImportedLandLeadActivity({
      leadId: lead.id,
      actor: user,
      activityType: "note",
      summary: body,
    });
    if (error) { setMessage(error); return; }
    setNoteDraft("");
    setMessage("Note saved.");
    await loadAll();
  };

  if (!user) return null;
  if (loading) return (
    <div style={{ padding: 80, textAlign: "center", color: "var(--muted)" }}>Loading lead…</div>
  );
  if (!lead) return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <h2 style={sectionTitle}>Lead not found</h2>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>This lead may have been deleted or you don&apos;t have access.</p>
      <button onClick={() => router.push("/va")} style={{ ...secondaryButton, marginTop: 16 }}>Back to VA workdesk</button>
    </div>
  );

  const stage = lead.status === "interested" ? "Interested" : lead.status === "converted" ? "Converted" : lead.status === "passed" ? "Passed" : lead.outreach_count && lead.outreach_count > 0 ? "Contacted" : "New";
  const headerStats = [
    { label: "Properties", value: String(allProperties.length), detail: allProperties.length === 1 ? "Single parcel" : "Multi-property owner", tone: allProperties.length > 1 ? "hot" as const : "default" as const },
    { label: "Outreach", value: String(lead.outreach_count ?? 0), detail: "Texts + calls logged", tone: "default" as const },
    { label: "Status", value: stage, detail: `Stage on this lead`, tone: lead.status === "interested" ? "hot" as const : "default" as const },
    { label: "Compliance", value: compliance?.allowed ? "Clean" : "Blocked", detail: compliance?.allowed ? "OK to text" : compliance?.blockLabel || "Cannot text", tone: compliance?.allowed ? "good" as const : "hot" as const },
  ];

  return (
    <div className="lead-root" style={{ maxWidth: 1480, margin: "0 auto", padding: "82px 20px 100px" }}>
      <OperatingHeader
        eyebrow="Lead"
        title={lead.owner_name || "Owner unknown"}
        subtitle={[
          lead.property_address,
          lead.county,
          lead.campaign_source || lead.source_system,
        ].filter(Boolean).join(" · ")}
        user={user}
        mode="va"
        actions={
          <>
            <button onClick={() => router.push("/va?tab=outreach")} style={secondaryButton}>Back to Contact Queue</button>
            <button onClick={() => router.push(`/va?tab=packet&lead=${lead.id}`)} style={secondaryButton}>Build Packet</button>
            {lead.status !== "interested" && (
              <button onClick={() => logDisposition("interested", "Marked interested from Lead Page", "interested")} style={primaryButton}>
                Mark Interested
              </button>
            )}
          </>
        }
        stats={headerStats}
      />

      {compliance && !compliance.allowed && (
        <section style={complianceBanner(compliance.severity)}>
          <strong style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
            {compliance.severity === "compliance" ? "⛔ Compliance block" : "⚠ Cannot text"}
          </strong>
          <span>{compliance.blockLabel} — outgoing SMS is disabled for this lead.</span>
        </section>
      )}

      {message && (
        <div style={{ ...panel, padding: 12, marginBottom: 16, borderColor: message.toLowerCase().includes("fail") ? "var(--obsidian)" : "var(--brass)" }}>
          <p style={{ fontSize: 13, color: "var(--ink)" }}>{message}</p>
        </div>
      )}

      <div style={{ ...panel, padding: 8, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            style={tab === t.value ? tabActive : tabButton}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={panel}>
            <p style={eyebrowSmall}>Next action</p>
            <h2 style={{ ...sectionTitle, fontSize: 24, marginTop: 4 }}>{nextActionText}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button onClick={() => setTab("conversation")} disabled={!compliance?.allowed} style={{ ...primaryButton, opacity: compliance?.allowed ? 1 : 0.55 }}>
                {compliance?.allowed ? "Message Seller →" : "SMS disabled"}
              </button>
              <button onClick={() => setTab("conversation")} style={secondaryButton}>Open Conversation</button>
              <button onClick={() => setTab("properties")} style={secondaryButton}>Open Properties</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 16 }} className="lead-overview-grid">
            <div style={{ display: "grid", gap: 16 }}>
              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Recent conversation</p>
                    <h3 style={{ ...sectionTitle, fontSize: 18 }}>3 most recent</h3>
                  </div>
                  <button onClick={() => setTab("conversation")} style={inlineLinkButton}>Open thread →</button>
                </header>
                {recentConversation.length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>No messages or activity yet.</p>
                )}
                <div style={{ display: "grid", gap: 8 }}>
                  {recentConversation.map(item => (
                    <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid var(--fog)", paddingBottom: 8 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: item.kind === "inbound" ? "var(--brass)" : item.kind === "outbound" ? "var(--obsidian)" : "var(--muted)",
                        minWidth: 60,
                      }}>{item.kind}</span>
                      <p style={{ fontSize: 13, color: "var(--ink)", flex: 1, lineHeight: 1.45 }}>{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Properties</p>
                    <h3 style={{ ...sectionTitle, fontSize: 18 }}>{allProperties.length} on this lead</h3>
                  </div>
                  <button onClick={() => setTab("properties")} style={inlineLinkButton}>Open all →</button>
                </header>
                <div style={{ display: "grid", gap: 8 }}>
                  {allProperties.map(prop => (
                    <div key={prop.id} style={{ ...subPanel, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{prop.property_address || prop.parcel_id || "No address"}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                          {prop.acreage ? `${prop.acreage} ac` : "Acres ?"} · {prop.county || "County ?"} · {labelForStatus(prop.status)}
                        </p>
                      </div>
                      <button onClick={() => router.push(`/lead/${prop.id}`)} style={{ ...secondaryButton, padding: "8px 10px", fontSize: 10, minHeight: 32 }}>
                        Open Record →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <section style={panel}>
                <p style={eyebrowSmall}>Highlights</p>
                <dl style={{ display: "grid", gap: 6, marginTop: 8, fontSize: 13 }}>
                  <Detail label="Phones" value={phones.length ? phones.map(p => `${p.number} (${p.type})`).join(", ") : "None"} />
                  <Detail label="Email" value={lead.email || "—"} />
                  <Detail label="Mailing" value={lead.mailing_address || "—"} />
                  <Detail label="Source" value={lead.source_system || lead.campaign_source || "—"} />
                  <Detail label="First touch" value={lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"} />
                  <Detail label="Last text" value={lead.last_sms_at ? new Date(lead.last_sms_at).toLocaleDateString() : "—"} />
                </dl>
              </section>

              {motivationSignals.length > 0 && (
                <section style={panel}>
                  <p style={eyebrowSmall}>Motivation signals</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {motivationSignals.map(s => (
                      <span key={s.label} style={s.tone === "warn" ? warnChip : s.tone === "good" ? goodChip : mutedChip}>{s.label}</span>
                    ))}
                  </div>
                </section>
              )}

              <section style={panel}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <p style={eyebrowSmall}>Recent activity</p>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>top 5</span>
                </header>
                {activities.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No logged activity yet.</p>}
                <div style={{ display: "grid", gap: 6 }}>
                  {activities.slice(0, 5).map(a => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--ink)" }}>
                      <span style={{ flex: 1 }}>{labelForStatus(a.activity_type)}: {a.summary}</span>
                      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section style={panel}>
                <p style={eyebrowSmall}>Quick note</p>
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Add a note about this lead…"
                  style={textareaStyle}
                />
                <button onClick={saveNote} disabled={!noteDraft.trim()} style={{ ...secondaryButton, marginTop: 8, opacity: noteDraft.trim() ? 1 : 0.55 }}>
                  Save Note
                </button>
              </section>
            </aside>
          </div>
        </section>
      )}

      {tab === "conversation" && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }} className="lead-conv-grid">
          <div style={panel}>
            <ConversationPanel
              eyebrow="Thread"
              title={`Conversation history with ${lead.owner_name || "this seller"}`}
              subject={compliance?.phone?.number || phones[0]?.number || "No phone"}
              communications={communications}
              activities={sortedConvActivities}
              emptyText="No messages yet — send the first text from the right pane."
              maxHeight={520}
            />
          </div>

          <aside style={panel}>
            <p style={eyebrowSmall}>Message seller</p>
            <div style={{ marginTop: 8 }}>
              {compliance && !compliance.allowed && (
                <div style={complianceBanner(compliance.severity)}>
                  <strong style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                    {compliance.severity === "compliance" ? "⛔ Compliance block" : "⚠ Cannot text"}
                  </strong>
                  {compliance.blockLabel}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {SMS_TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setSmsDraft(t.body)}
                    disabled={!compliance?.allowed}
                    style={{ ...secondaryButton, padding: "6px 9px", fontSize: 10, minHeight: 28, opacity: compliance?.allowed ? 1 : 0.55 }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                value={smsDraft}
                onChange={e => setSmsDraft(e.target.value)}
                disabled={!compliance?.allowed}
                placeholder={compliance?.allowed ? "Type your reply…" : "SMS disabled for this lead."}
                rows={5}
                style={textareaStyle}
              />
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                Merge tokens supported: {`{{first_name}} {{county}} {{property_count}}`}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{smsDraft.trim().length} chars</span>
                <button
                  onClick={sendSms}
                  disabled={smsSending || !smsDraft.trim() || !compliance?.allowed}
                  style={{ ...primaryButton, opacity: smsSending || !smsDraft.trim() || !compliance?.allowed ? 0.55 : 1 }}
                >
                  {smsSending ? "Sending…" : "Send SMS"}
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 12 }}>
              <p style={eyebrowSmall}>Quick disposition</p>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <button onClick={() => logDisposition("called", "No answer · Quick disposition")} style={secondaryButton}>No Answer</button>
                <button onClick={() => logDisposition("left-voicemail", "Left voicemail · Quick disposition")} style={secondaryButton}>Voicemail</button>
                <button onClick={() => logDisposition("wrong-number", "Wrong number · Quick disposition", "passed")} style={secondaryButton}>Wrong Number</button>
                <button onClick={() => logDisposition("interested", "Marked interested from conversation pane", "interested")} style={primaryButton}>Mark Interested</button>
                <button onClick={() => logDisposition("not-interested", "Not interested · pass", "passed")} style={secondaryButton}>Pass</button>
              </div>
            </div>
          </aside>
        </section>
      )}

      {tab === "properties" && (
        <section style={{ display: "grid", gap: 12 }}>
          {allProperties.map(prop => {
            const expanded = expandedPropertyId === prop.id;
            return (
              <div key={prop.id} style={{ ...panel, padding: 0, overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedPropertyId(expanded ? null : prop.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 18px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: "var(--obsidian)", fontSize: 15 }}>{expanded ? "▼" : "▶"} {prop.property_address || prop.parcel_id || "No address"}</strong>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                      {prop.acreage ? `${prop.acreage} ac` : "Acres ?"} · {prop.county || "County ?"} · Zoned {prop.zoning || "?"} · {labelForStatus(prop.status)}
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
                    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, fontSize: 12, color: "var(--ink)" }}>
                      <Detail label="Parcel ID" value={prop.parcel_id || "—"} />
                      <Detail label="Calc. acreage" value={prop.calculated_acreage ? `${prop.calculated_acreage} ac` : prop.acreage ? `${prop.acreage} ac` : "—"} />
                      <Detail label="Market value" value={prop.market_value ? `$${prop.market_value.toLocaleString()}` : "—"} />
                      <Detail label="Tax delinquent" value={prop.tax_delinquent ? `Yes${prop.tax_delinquent_years ? ` · ${prop.tax_delinquent_years}y` : ""}` : "No"} />
                      <Detail label="Flood zone %" value={prop.flood_zone_percent != null ? `${prop.flood_zone_percent}%` : "—"} />
                      <Detail label="Wetlands %" value={prop.wetlands_percent != null ? `${prop.wetlands_percent}%` : "—"} />
                      <Detail label="Land locked" value={prop.is_land_locked ? "Yes" : "No"} />
                      <Detail label="Subdividable" value={prop.tag_subdivide ? "Yes" : "—"} />
                      <Detail label="HOA" value={prop.hoa_status || (prop.in_hoa ? "Yes" : "No")} />
                      <Detail label="Mortgage" value={prop.mortgage_amount ? `$${prop.mortgage_amount.toLocaleString()}` : "None"} />
                    </dl>
                    {prop.notes && (
                      <div style={subPanel}>
                        <p style={{ ...eyebrowSmall, marginBottom: 4 }}>Notes</p>
                        <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{prop.notes}</p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => router.push(`/lead/${prop.id}`)} style={primaryButton}>Open Record →</button>
                      {prop.status !== "passed" && (
                        <button onClick={async () => {
                          await updateImportedLandLeadStatus(prop.id, "passed", prop.deal_id);
                          await loadAll();
                        }} style={secondaryButton}>Pass</button>
                      )}
                      {prop.property_url && <a href={prop.property_url} target="_blank" rel="noreferrer" style={secondaryButton}>External record</a>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <style jsx>{`
        @media (max-width: 880px) {
          .lead-root { padding-top: 28px !important; }
          .lead-overview-grid, .lead-conv-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</dt>
      <dd style={{ color: "var(--ink)", fontSize: 13, margin: 0 }}>{value}</dd>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 16px 44px rgba(20,17,13,0.06)",
};

const subPanel: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
};

const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  padding: "10px 13px",
  minHeight: 40,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "transparent",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const inlineLinkButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  padding: 0,
};

const tabButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.58)",
  color: "var(--ink)",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  padding: "10px 16px",
  minHeight: 40,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
};

const tabActive: React.CSSProperties = {
  ...tabButton,
  background: "var(--obsidian)",
  color: "var(--bone)",
  borderColor: "var(--obsidian)",
};

const eyebrowSmall: React.CSSProperties = {
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  padding: "10px 11px",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  lineHeight: 1.45,
  resize: "vertical",
};

const warnChip: React.CSSProperties = {
  display: "inline-flex",
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 999,
  border: "1px solid var(--brass)",
  background: "rgba(176,137,84,0.14)",
  color: "var(--obsidian)",
};

const goodChip: React.CSSProperties = {
  ...warnChip,
  borderColor: "var(--obsidian)",
  background: "rgba(20,17,13,0.06)",
  color: "var(--obsidian)",
};

const mutedChip: React.CSSProperties = {
  ...warnChip,
  borderColor: "var(--fog)",
  background: "var(--surface)",
  color: "var(--muted)",
};

function complianceBanner(severity: "compliance" | "data-quality" | "recency-dedupe" | undefined): React.CSSProperties {
  if (severity === "compliance") {
    return {
      background: "var(--obsidian)",
      color: "var(--bone)",
      border: "1px solid var(--obsidian)",
      borderRadius: 8,
      padding: "12px 14px",
      marginBottom: 16,
      fontSize: 13,
      lineHeight: 1.5,
    };
  }
  return {
    background: "rgba(176,137,84,0.14)",
    color: "var(--obsidian)",
    border: "1px solid var(--brass)",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 1.5,
  };
}
