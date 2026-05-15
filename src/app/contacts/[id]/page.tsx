"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ConversationPanel from "@/components/ConversationPanel";
import OperatingHeader from "@/components/OperatingHeader";
import { checkLeadSmsCompliance } from "@/lib/bulk-sms";
import {
  fetchCommunicationEvents,
  type CommunicationEvent,
} from "@/lib/communications";
import {
  fetchCrmDashboardData,
  updateCrmContact,
  type CrmContact,
  type CrmContactType,
  type CrmDashboardData,
} from "@/lib/crm";
import {
  fetchImportedLandLeadActivities,
  fetchImportedLandLeads,
  hasImportedLeadOwnerIdentity,
  importedLeadContactIdentityKey,
  type ImportedLandLead,
  type ImportedLandLeadActivity,
} from "@/lib/land-leads";
import { labelForStatus } from "@/lib/status-map";

const DISPLAY_FONT = "var(--font-display)";

const EMPTY_CRM: CrmDashboardData = {
  deals: [],
  contacts: [],
  opportunityContacts: [],
  properties: [],
  buyers: [],
  campaigns: [],
  offers: [],
  communications: [],
  templates: [],
};

type ContactSource = "crm" | "imported" | "auto";

type ContactPhone = {
  value: string;
  label: string;
  type?: string | null;
  source: string;
};

function last10(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "").slice(-10);
}

function normalize(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  return uniqueBy(
    values.map(value => value?.trim()).filter((value): value is string => Boolean(value)),
    value => value.toLowerCase(),
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function numberValue(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "N/A";
}

function fieldValue(value: string | number | boolean | null | undefined): string {
  if (typeof value === "boolean") return yesNo(value);
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A";
  if (typeof value === "string" && value.trim()) return value;
  return "N/A";
}

function importedLeadPhones(lead: ImportedLandLead): ContactPhone[] {
  return [
    [lead.phone, lead.phone_1_type],
    [lead.phone_2, lead.phone_2_type],
    [lead.phone_3, lead.phone_3_type],
    [lead.phone_4, lead.phone_4_type],
    [lead.phone_5, lead.phone_5_type],
    [lead.phone_6, lead.phone_6_type],
  ]
    .filter(([value]) => Boolean(value))
    .map(([value, type], index) => ({
      value: String(value),
      label: [value, type].filter(Boolean).join(" "),
      type,
      source: index === 0 ? "Primary imported phone" : "Imported phone",
    }));
}

function leadMatchesCrmContact(lead: ImportedLandLead, contact: CrmContact): boolean {
  const contactPhones = [contact.phone, contact.phone_2].map(last10).filter(Boolean);
  const leadPhones = importedLeadPhones(lead).map(phone => last10(phone.value)).filter(Boolean);
  const phoneMatch = contactPhones.length > 0 && leadPhones.some(phone => contactPhones.includes(phone));
  const emailMatch = Boolean(contact.email && lead.email && normalize(contact.email) === normalize(lead.email));
  const nameMatch = hasImportedLeadOwnerIdentity(lead.owner_name) && normalize(contact.display_name) === normalize(lead.owner_name);
  return phoneMatch || emailMatch || nameMatch;
}

function leadContactTitle(lead: ImportedLandLead | null, crmContact: CrmContact | null): string {
  return crmContact?.display_name
    || lead?.owner_name
    || lead?.owner_1_full_name
    || lead?.phone
    || lead?.phone_2
    || "Contact record";
}

export default function ContactRecordPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const contactId = decodeURIComponent(params.id);
  const requestedSource = (searchParams.get("source") || "auto") as ContactSource;
  const from = searchParams.get("from");

  const [user, setUser] = useState<string | null>(null);
  const [crmData, setCrmData] = useState<CrmDashboardData>(EMPTY_CRM);
  const [importedLeads, setImportedLeads] = useState<ImportedLandLead[]>([]);
  const [activities, setActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    contact_type: "seller" as CrmContactType,
    display_name: "",
    company_name: "",
    phone: "",
    phone_2: "",
    email: "",
    mailing_address: "",
    county: "",
    state: "",
    relationship_status: "new" as CrmContact["relationship_status"],
    sms_opt_status: "unknown" as CrmContact["sms_opt_status"],
    tags: "",
    notes: "",
  });

  useEffect(() => {
    const current = localStorage.getItem("meridian_user");
    if (!current) {
      router.push("/");
      return;
    }
    setUser(current);
  }, [router]);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    const [crmRows, leadRows] = await Promise.all([
      fetchCrmDashboardData(),
      fetchImportedLandLeads(5000),
    ]);

    const explicitCrmContact = crmRows.contacts.find(contact => contact.id === contactId) ?? null;
    const explicitLead = leadRows.find(lead => lead.id === contactId) ?? null;
    const crmContact = explicitCrmContact
      || (explicitLead ? crmRows.contacts.find(contact => leadMatchesCrmContact(explicitLead, contact)) ?? null : null);
    const anchorLead = explicitLead
      || (crmContact ? leadRows.find(lead => leadMatchesCrmContact(lead, crmContact)) ?? null : null);
    const contactKey = anchorLead ? importedLeadContactIdentityKey(anchorLead) : null;
    const relatedLeads = contactKey
      ? leadRows.filter(lead => importedLeadContactIdentityKey(lead) === contactKey)
      : crmContact ? leadRows.filter(lead => leadMatchesCrmContact(lead, crmContact)) : [];
    const contactPhones = [
      ...(crmContact?.phone ? [{ value: crmContact.phone, label: crmContact.phone, source: "CRM primary phone" }] : []),
      ...(crmContact?.phone_2 ? [{ value: crmContact.phone_2, label: crmContact.phone_2, source: "CRM alt phone" }] : []),
      ...relatedLeads.flatMap(importedLeadPhones),
    ];
    const phones = uniqueBy(contactPhones, phone => last10(phone.value) || phone.value.toLowerCase());
    const primaryPhone = phones[0]?.value || null;

    const activityRows = relatedLeads.length
      ? (await Promise.all(relatedLeads.slice(0, 12).map(lead => fetchImportedLandLeadActivities(lead.id, 25)))).flat()
      : [];
    const commRows = await Promise.all([
      primaryPhone ? fetchCommunicationEvents({ phone: primaryPhone, limit: 100 }) : Promise.resolve([]),
      ...relatedLeads.slice(0, 5).map(lead => fetchCommunicationEvents({ leadId: lead.id, limit: 40 })),
    ]);

    setCrmData(crmRows);
    setImportedLeads(relatedLeads);
    setActivities(uniqueBy(activityRows, activity => activity.id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setCommunications(uniqueBy(commRows.flat(), event => event.id).sort((a, b) => (b.provider_created_at || b.created_at).localeCompare(a.provider_created_at || a.created_at)));

    if (crmContact) {
      setDraft({
        contact_type: crmContact.contact_type,
        display_name: crmContact.display_name,
        company_name: crmContact.company_name || "",
        phone: crmContact.phone || "",
        phone_2: crmContact.phone_2 || "",
        email: crmContact.email || "",
        mailing_address: crmContact.mailing_address || "",
        county: crmContact.county || "",
        state: crmContact.state || "",
        relationship_status: crmContact.relationship_status || "new",
        sms_opt_status: crmContact.sms_opt_status,
        tags: crmContact.tags.join(", "),
        notes: crmContact.notes || "",
      });
    }

    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    if (!user) return;
    void loadRecord();
  }, [loadRecord, user]);

  const crmContact = useMemo(() => {
    const explicit = crmData.contacts.find(contact => contact.id === contactId) ?? null;
    if (explicit) return explicit;
    const anchor = importedLeads[0] ?? null;
    return anchor ? crmData.contacts.find(contact => leadMatchesCrmContact(anchor, contact)) ?? null : null;
  }, [contactId, crmData.contacts, importedLeads]);

  const primaryLead = importedLeads[0] ?? null;
  const linkedOpportunities = useMemo(() => {
    if (!crmContact) return [];
    return crmData.opportunityContacts
      .filter(link => link.contact_id === crmContact.id)
      .map(link => ({ link, deal: crmData.deals.find(deal => deal.id === link.deal_id) ?? null }))
      .filter((item): item is { link: typeof item.link; deal: NonNullable<typeof item.deal> } => Boolean(item.deal));
  }, [crmContact, crmData.deals, crmData.opportunityContacts]);

  const phones = useMemo(() => uniqueBy([
    ...(crmContact?.phone ? [{ value: crmContact.phone, label: crmContact.phone, source: "CRM primary phone" }] : []),
    ...(crmContact?.phone_2 ? [{ value: crmContact.phone_2, label: crmContact.phone_2, source: "CRM alt phone" }] : []),
    ...importedLeads.flatMap(importedLeadPhones),
  ], phone => last10(phone.value) || phone.value.toLowerCase()), [crmContact, importedLeads]);

  const emails = useMemo(() => uniqueText([
    crmContact?.email,
    ...importedLeads.map(lead => lead.email),
  ]), [crmContact, importedLeads]);

  const mailingAddresses = useMemo(() => uniqueText([
    crmContact?.mailing_address,
    ...importedLeads.map(lead => [
      lead.mailing_address || lead.mail_address,
      [lead.mail_city, lead.mail_state].filter(Boolean).join(", "),
      lead.mail_zip,
    ].filter(Boolean).join(" ")),
  ]), [crmContact, importedLeads]);

  const ownerNames = useMemo(() => uniqueText(importedLeads.flatMap(lead => [
    lead.owner_name,
    lead.owner_1_full_name,
    lead.owner_2_full_name,
  ])), [importedLeads]);

  const complianceFlags = useMemo(() => {
    const leadFlags = [
      importedLeads.some(lead => lead.dnc) ? "DNC" : null,
      importedLeads.some(lead => lead.state_dnc) ? "State DNC" : null,
      importedLeads.some(lead => lead.litigator) ? "Litigator" : null,
      importedLeads.some(lead => lead.do_not_mail) ? "Do not mail" : null,
      importedLeads.some(lead => lead.sms_opt_status === "opted-out") ? "SMS opted out" : null,
    ];
    const crmFlags = [
      crmContact?.relationship_status === "do-not-contact" ? "CRM do not contact" : null,
      crmContact?.sms_opt_status === "opted-out" ? "CRM SMS opted out" : null,
    ];
    return uniqueText([...leadFlags, ...crmFlags]);
  }, [crmContact, importedLeads]);

  const hygieneFlags = useMemo(() => uniqueText([
    !ownerNames.length && !crmContact?.display_name ? "Missing owner/name" : null,
    !phones.length ? "Missing phone" : null,
    !emails.length ? "Missing email" : null,
    !mailingAddresses.length ? "Missing mailing address" : null,
    importedLeads.some(lead => lead.duplicate_status && lead.duplicate_status !== "new") ? "Possible duplicate" : null,
    !crmContact ? "Not in CRM" : null,
  ]), [crmContact, emails.length, importedLeads, mailingAddresses.length, ownerNames.length, phones.length]);

  const sourceNames = useMemo(() => uniqueText(importedLeads.map(lead => lead.campaign_source || lead.source_system)), [importedLeads]);
  const latestTouch = useMemo(() => [
    crmContact?.last_contacted_at,
    ...importedLeads.flatMap(lead => [lead.last_activity_at, lead.last_sms_at, lead.updated_at, lead.created_at]),
    ...communications.map(event => event.provider_created_at || event.created_at),
    ...activities.map(activity => activity.created_at),
  ].filter((value): value is string => Boolean(value)).sort().at(-1) || null, [activities, communications, crmContact, importedLeads]);

  const title = leadContactTitle(primaryLead, crmContact);
  const smsCompliance = primaryLead ? checkLeadSmsCompliance(primaryLead) : null;
  const activityItems = activities.map(activity => ({
    id: activity.id,
    title: labelForStatus(activity.activity_type),
    date: activity.created_at,
    body: activity.summary,
    meta: activity.next_follow_up_date ? `Follow up ${activity.next_follow_up_date}` : activity.actor || null,
  }));

  const saveCrmContact = async () => {
    if (!crmContact || !user) return;
    const { error } = await updateCrmContact(crmContact.id, draft, user);
    if (error) {
      setMessage(error);
      return;
    }
    setMessage("Contact record updated.");
    setEditing(false);
    await loadRecord();
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", padding: "84px 20px" }}>Loading contact record...</div>;
  }

  if (!crmContact && importedLeads.length === 0) {
    return (
      <div style={pageShell}>
        <OperatingHeader eyebrow="Contact Record" title="Contact not found" subtitle="This contact could not be found in CRM or imported lists." mode="crm" />
        <button onClick={() => router.push(from === "crm" ? "/crm?view=records" : "/va?tab=lists")} style={secondaryButton}>Back</button>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <OperatingHeader
        eyebrow="Contact Record"
        title={title}
        subtitle="One organized record for CRM identity, imported list context, linked properties, compliance, and outreach."
        mode="crm"
      />

      {message && <div style={notice}>{message}</div>}

      <div style={topActions}>
        <button onClick={() => router.back()} style={secondaryButton}>Back</button>
        <button onClick={() => router.push("/va?tab=lists")} style={secondaryButton}>Lists</button>
        <button onClick={() => router.push("/crm?view=records")} style={secondaryButton}>CRM Records</button>
        {crmContact && <button onClick={() => setEditing(open => !open)} style={primaryButton}>{editing ? "Close Edit" : "Edit CRM Contact"}</button>}
      </div>

      <section style={heroPanel}>
        <div>
          <p style={eyebrowSmall}>{crmContact ? "CRM + list contact" : requestedSource === "imported" ? "Imported list contact" : "Contact"}</p>
          <h1 style={heroTitle}>{title}</h1>
          <p style={heroMeta}>
            {phones[0]?.label || "Phone missing"} / {emails[0] || "Email missing"} / {latestTouch ? `Last touch ${formatDateTime(latestTouch)}` : "No touch history"}
          </p>
          <div style={pillRow}>
            <span style={crmContact ? goodPill : pill}>{crmContact ? "In CRM" : "Not in CRM"}</span>
            <span style={smsCompliance?.allowed || crmContact?.sms_opt_status === "opted-in" ? goodPill : pill}>
              {smsCompliance ? smsCompliance.allowed ? "Textable" : smsCompliance.blockLabel : `SMS ${labelForStatus(crmContact?.sms_opt_status || "unknown")}`}
            </span>
            {hygieneFlags.slice(0, 4).map(flag => <span key={flag} style={mutedPill}>{flag}</span>)}
          </div>
        </div>
        <div style={metricGrid}>
          <Metric label="Phones" value={String(phones.length)} />
          <Metric label="Properties" value={String(importedLeads.length)} />
          <Metric label="Deals" value={String(linkedOpportunities.length)} />
          <Metric label="Messages" value={String(communications.length)} />
        </div>
      </section>

      {editing && crmContact && (
        <section style={panel}>
          <p style={eyebrowSmall}>Edit CRM Contact</p>
          <div style={editGrid}>
            <select value={draft.contact_type} onChange={event => setDraft({ ...draft, contact_type: event.target.value as CrmContactType })}>
              {["seller", "buyer", "agent", "broker", "builder", "neighbor", "title", "lender", "vendor", "member", "other"].map(type => <option key={type} value={type}>{labelForStatus(type)}</option>)}
            </select>
            <input value={draft.display_name} onChange={event => setDraft({ ...draft, display_name: event.target.value })} placeholder="Display name" />
            <input value={draft.company_name} onChange={event => setDraft({ ...draft, company_name: event.target.value })} placeholder="Company / organization" />
            <input value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} placeholder="Primary phone" />
            <input value={draft.phone_2} onChange={event => setDraft({ ...draft, phone_2: event.target.value })} placeholder="Alt phone" />
            <input value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} placeholder="Email" />
            <input value={draft.mailing_address} onChange={event => setDraft({ ...draft, mailing_address: event.target.value })} placeholder="Mailing address" />
            <input value={draft.county} onChange={event => setDraft({ ...draft, county: event.target.value })} placeholder="County" />
            <input value={draft.state} onChange={event => setDraft({ ...draft, state: event.target.value })} placeholder="State" />
            <select value={draft.relationship_status || "new"} onChange={event => setDraft({ ...draft, relationship_status: event.target.value as CrmContact["relationship_status"] })}>
              {["new", "active", "warm", "nurture", "do-not-contact", "inactive"].map(status => <option key={status} value={status}>{labelForStatus(status)}</option>)}
            </select>
            <select value={draft.sms_opt_status} onChange={event => setDraft({ ...draft, sms_opt_status: event.target.value as CrmContact["sms_opt_status"] })}>
              {["unknown", "opted-in", "opted-out"].map(status => <option key={status} value={status}>{labelForStatus(status)}</option>)}
            </select>
            <input value={draft.tags} onChange={event => setDraft({ ...draft, tags: event.target.value })} placeholder="Tags, comma separated" />
            <textarea rows={4} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="Notes" style={{ gridColumn: "1 / -1" }} />
            <button onClick={saveCrmContact} style={{ ...primaryButton, gridColumn: "1 / -1", justifySelf: "start" }}>Save Contact</button>
          </div>
        </section>
      )}

      <div style={contentGrid}>
        <main style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <DataSection title="Identity" items={[
            ["Display Name", title],
            ["CRM Type", crmContact ? labelForStatus(crmContact.contact_type) : "N/A"],
            ["Relationship", crmContact ? labelForStatus(crmContact.relationship_status || "new") : fieldValue(primaryLead?.status)],
            ["Company", crmContact?.company_name || "N/A"],
            ["Owner Names", ownerNames.join(" / ") || "N/A"],
            ["Tags", crmContact?.tags.length ? crmContact.tags.join(", ") : "N/A"],
            ["Source Lists", sourceNames.join(", ") || "N/A"],
            ["Created", formatDateTime(crmContact?.created_at || primaryLead?.created_at)],
          ]} />

          <DataSection title="Reachability" items={[
            ["Primary Phone", phones[0]?.label || "N/A"],
            ["All Phones", phones.map(phone => phone.label).join(" / ") || "N/A"],
            ["Email", emails.join(" / ") || "N/A"],
            ["Mailing", mailingAddresses.join(" / ") || "N/A"],
            ["County", crmContact?.county || primaryLead?.county || primaryLead?.mail_county || "N/A"],
            ["State", crmContact?.state || primaryLead?.state || primaryLead?.mail_state || "N/A"],
            ["Last Contacted", formatDateTime(crmContact?.last_contacted_at || latestTouch)],
            ["Last Contacted By", crmContact?.last_contacted_by || "N/A"],
          ]} />

          <DataSection title="Compliance & Hygiene" columns={3} items={[
            ["SMS Status", smsCompliance ? smsCompliance.allowed ? "Eligible" : smsCompliance.blockLabel : labelForStatus(crmContact?.sms_opt_status || "unknown")],
            ["DNC", importedLeads.some(lead => lead.dnc) ? "Yes" : "No"],
            ["State DNC", importedLeads.some(lead => lead.state_dnc) ? "Yes" : "No"],
            ["Litigator", importedLeads.some(lead => lead.litigator) ? "Yes" : "No"],
            ["Do Not Mail", importedLeads.some(lead => lead.do_not_mail) ? "Yes" : "No"],
            ["Flags", [...complianceFlags, ...hygieneFlags].join(" / ") || "Clean"],
          ]} />

          <section style={panel}>
            <p style={eyebrowSmall}>Linked Properties</p>
            <div style={propertyList}>
              {importedLeads.map(lead => (
                <button key={lead.id} onClick={() => router.push(`/lead/${lead.id}?tab=properties`)} style={recordRow}>
                  <span>
                    <strong style={rowTitle}>{lead.property_address || lead.parcel_id || "Property record"}</strong>
                    <span style={rowMeta}>{[lead.city, lead.state].filter(Boolean).join(", ") || lead.county || "Location pending"} / {lead.parcel_id || "No APN"}</span>
                  </span>
                  <span style={rowMeta}>{numberValue(lead.acreage, " ac")} / {money(lead.market_value || lead.assessed_value)} / {lead.deal_id ? "Linked" : "Unlinked"}</span>
                </button>
              ))}
              {importedLeads.length === 0 && <p style={emptyText}>No imported properties are linked to this contact yet.</p>}
            </div>
          </section>

          <section style={panel}>
            <p style={eyebrowSmall}>Linked Opportunities</p>
            <div style={propertyList}>
              {linkedOpportunities.map(({ link, deal }) => (
                <button key={link.id} onClick={() => router.push(`/crm?view=deals&deal=${deal.id}`)} style={recordRow}>
                  <span>
                    <strong style={rowTitle}>{deal.title}</strong>
                    <span style={rowMeta}>{deal.address || deal.parcel_id || "Location pending"} / {labelForStatus(link.role)}</span>
                  </span>
                  <span style={rowMeta}>{labelForStatus(deal.status)} / {money(deal.asking_price)}</span>
                </button>
              ))}
              {linkedOpportunities.length === 0 && <p style={emptyText}>No CRM opportunities are linked to this contact yet.</p>}
            </div>
          </section>

          <ConversationPanel
            eyebrow="Outreach"
            title="Communication Timeline"
            subject={title}
            communications={communications}
            activities={activityItems}
            emptyText="No calls, texts, or list activities are tied to this contact yet."
            maxHeight={520}
          />
        </main>

        <aside style={{ display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}>
          <DataSection title="Workflow" columns={2} items={[
            ["Next Follow-Up", importedLeads.map(lead => lead.next_follow_up_date).filter(Boolean).sort()[0] || "N/A"],
            ["Outreach Count", fieldValue(importedLeads.reduce((sum, lead) => sum + (lead.outreach_count || 0), 0))],
            ["Last Activity", importedLeads.map(lead => lead.last_activity_at).filter(Boolean).sort().at(-1) || "N/A"],
            ["Assigned", uniqueText(importedLeads.map(lead => lead.assigned_to)).join(" / ") || "N/A"],
          ]} />

          <DataSection title="Enrichment" columns={2} items={[
            ["Seller IQ", primaryLead?.seller_iq || "N/A"],
            ["Age", fieldValue(primaryLead?.age)],
            ["Gender", primaryLead?.gender || "N/A"],
            ["Ethnicity", primaryLead?.ethnic_group || "N/A"],
            ["Religion", primaryLead?.religion || "N/A"],
            ["Education", primaryLead?.education_level || "N/A"],
            ["Occupation", primaryLead?.occupation || "N/A"],
            ["Language", primaryLead?.language || "N/A"],
            ["Marital", primaryLead?.marital_status || "N/A"],
          ]} />

          <DataSection title="Source Detail" columns={2} items={[
            ["CRM ID", crmContact?.id || "N/A"],
            ["Imported Key", primaryLead ? importedLeadContactIdentityKey(primaryLead) : "N/A"],
            ["Source System", uniqueText(importedLeads.map(lead => lead.source_system)).join(" / ") || crmContact?.source_system || "N/A"],
            ["Campaign", uniqueText(importedLeads.map(lead => lead.campaign_source)).join(" / ") || "N/A"],
            ["Duplicates", importedLeads.filter(lead => lead.duplicate_status && lead.duplicate_status !== "new").length || "None"],
            ["Raw Rows", importedLeads.length],
          ]} />

          {crmContact?.notes && (
            <section style={panel}>
              <p style={eyebrowSmall}>Notes</p>
              <p style={bodyText}>{crmContact.notes}</p>
            </section>
          )}

          {primaryLead?.notes && (
            <section style={panel}>
              <p style={eyebrowSmall}>List Notes</p>
              <p style={bodyText}>{primaryLead.notes}</p>
            </section>
          )}
        </aside>
      </div>

      <style jsx global>{`
        input, select, textarea {
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 8px;
          color: var(--ink);
          font: inherit;
          min-height: 40px;
          padding: 9px 10px;
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <span style={miniLabel}>{label}</span>
      <strong style={metricValue}>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={miniLabel}>{label}</dt>
      <dd style={detailValue}>{value || "N/A"}</dd>
    </div>
  );
}

function DataSection({ title, items, columns = 4 }: { title: string; items: Array<[string, ReactNode]>; columns?: number }) {
  return (
    <section style={panel}>
      <p style={eyebrowSmall}>{title}</p>
      <dl style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${columns <= 2 ? 220 : 160}px, 1fr))`, gap: 12, marginTop: 10 }}>
        {items.map(([label, value]) => <Detail key={label} label={label} value={value} />)}
      </dl>
    </section>
  );
}

const pageShell: CSSProperties = {
  background: "var(--paper)",
  minHeight: "100vh",
  padding: "24px clamp(16px, 3vw, 34px) 42px",
};

const panel: CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  boxShadow: "0 10px 28px rgba(20,17,13,0.05)",
  padding: 14,
};

const heroPanel: CSSProperties = {
  ...panel,
  alignItems: "end",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 420px)",
  marginBottom: 12,
};

const contentGrid: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 390px)",
};

const topActions: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-end",
  marginBottom: 12,
};

const editGrid: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  marginTop: 10,
};

const metricGrid: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const metricCard: CSSProperties = {
  background: "rgba(255,252,245,0.72)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
};

const propertyList: CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 10,
};

const recordRow: CSSProperties = {
  alignItems: "center",
  background: "rgba(255,252,245,0.78)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--ink)",
  cursor: "pointer",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  padding: 12,
  textAlign: "left",
};

const heroTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontFamily: DISPLAY_FONT,
  fontSize: "clamp(34px, 5vw, 58px)",
  fontWeight: 500,
  letterSpacing: 0,
  lineHeight: 0.95,
  marginTop: 4,
};

const heroMeta: CSSProperties = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.45,
  marginTop: 10,
};

const pillRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 12,
};

const pill: CSSProperties = {
  background: "rgba(176,137,84,0.09)",
  border: "1px solid rgba(176,137,84,0.38)",
  borderRadius: 999,
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 800,
  padding: "4px 8px",
  whiteSpace: "nowrap",
};

const goodPill: CSSProperties = {
  ...pill,
  background: "rgba(47,125,76,0.08)",
  borderColor: "rgba(47,125,76,0.26)",
  color: "#2f7d4c",
};

const mutedPill: CSSProperties = {
  ...pill,
  color: "var(--muted)",
};

const primaryButton: CSSProperties = {
  background: "var(--obsidian)",
  border: "1px solid var(--obsidian)",
  borderRadius: 8,
  color: "var(--bone)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  padding: "10px 12px",
  textTransform: "uppercase",
};

const secondaryButton: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  padding: "10px 12px",
  textTransform: "uppercase",
};

const notice: CSSProperties = {
  ...panel,
  background: "rgba(47,125,76,0.08)",
  color: "#2f7d4c",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 12,
};

const eyebrowSmall: CSSProperties = {
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const miniLabel: CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  marginBottom: 4,
  textTransform: "uppercase",
};

const metricValue: CSSProperties = {
  color: "var(--obsidian)",
  display: "block",
  fontFamily: DISPLAY_FONT,
  fontSize: 30,
  fontWeight: 500,
  lineHeight: 1,
  marginTop: 6,
};

const detailValue: CSSProperties = {
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.35,
  margin: 0,
  overflowWrap: "anywhere",
};

const rowTitle: CSSProperties = {
  color: "var(--obsidian)",
  display: "block",
  fontSize: 13,
  lineHeight: 1.25,
};

const rowMeta: CSSProperties = {
  color: "var(--muted)",
  display: "block",
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4,
};

const bodyText: CSSProperties = {
  color: "var(--ink)",
  fontSize: 13,
  lineHeight: 1.55,
  marginTop: 10,
  whiteSpace: "pre-wrap",
};

const emptyText: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
};
