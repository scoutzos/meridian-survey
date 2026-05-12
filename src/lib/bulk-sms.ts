import type { ImportedLandLead } from "./land-leads";

export type BulkSmsExclusionReason =
  // Compliance blockers — legally cannot send
  | "tcpa-litigator"
  | "federal-dnc"
  | "state-dnc"
  | "opted-out"
  // Data quality — will not deliver or risky
  | "no-phone"
  | "landline"
  | "voip"
  // Recency / dedupe
  | "recently-texted"
  | "duplicate"
  | "passed-or-converted";

export type BulkSmsExclusionSeverity = "compliance" | "data-quality" | "recency-dedupe";

const RECENT_TEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const EXCLUSION_LABEL: Record<BulkSmsExclusionReason, string> = {
  "tcpa-litigator": "TCPA litigator",
  "federal-dnc": "Federal DNC list",
  "state-dnc": "State DNC list",
  "opted-out": "Opted out (STOP received)",
  "no-phone": "Missing phone",
  "landline": "Landline (cannot text)",
  "voip": "VOIP (TCPA risk)",
  "recently-texted": "Texted in last 7 days",
  "duplicate": "Duplicate phone (kept first)",
  "passed-or-converted": "Already passed or converted",
};

const EXCLUSION_SEVERITY: Record<BulkSmsExclusionReason, BulkSmsExclusionSeverity> = {
  "tcpa-litigator": "compliance",
  "federal-dnc": "compliance",
  "state-dnc": "compliance",
  "opted-out": "compliance",
  "no-phone": "data-quality",
  "landline": "data-quality",
  "voip": "data-quality",
  "recently-texted": "recency-dedupe",
  "duplicate": "recency-dedupe",
  "passed-or-converted": "recency-dedupe",
};

export const EXCLUSION_SEVERITY_ORDER: BulkSmsExclusionSeverity[] = [
  "compliance",
  "data-quality",
  "recency-dedupe",
];

export const EXCLUSION_SEVERITY_LABEL: Record<BulkSmsExclusionSeverity, string> = {
  "compliance": "Compliance blockers",
  "data-quality": "Data quality",
  "recency-dedupe": "Recency / dedupe",
};

export const EXCLUSION_SEVERITY_HINT: Record<BulkSmsExclusionSeverity, string> = {
  "compliance": "Legally cannot send — never overrideable",
  "data-quality": "Texts will not deliver or carry TCPA risk",
  "recency-dedupe": "Pacing and de-duplication",
};

export const EXCLUSION_REASONS_BY_SEVERITY: Record<BulkSmsExclusionSeverity, BulkSmsExclusionReason[]> = {
  "compliance": ["tcpa-litigator", "federal-dnc", "state-dnc", "opted-out"],
  "data-quality": ["no-phone", "landline", "voip"],
  "recency-dedupe": ["recently-texted", "duplicate", "passed-or-converted"],
};

export interface BulkSmsExcludedRow {
  lead: ImportedLandLead;
  reason: BulkSmsExclusionReason;
}

export interface BulkSmsCategorization {
  eligible: ImportedLandLead[];
  /** Eligible lead's chosen mobile-first phone, keyed by lead id. */
  eligiblePhones: Record<string, string>;
  excluded: BulkSmsExcludedRow[];
  excludedByReason: Record<BulkSmsExclusionReason, number>;
  totalConsidered: number;
}

interface PhoneSlot {
  number: string | null | undefined;
  type: string | null | undefined;
}

function readPhoneSlots(lead: ImportedLandLead): PhoneSlot[] {
  return [
    { number: lead.phone, type: lead.phone_1_type },
    { number: lead.phone_2, type: lead.phone_2_type },
    { number: lead.phone_3, type: lead.phone_3_type },
    { number: lead.phone_4, type: lead.phone_4_type },
    { number: lead.phone_5, type: lead.phone_5_type },
    { number: lead.phone_6, type: lead.phone_6_type },
  ];
}

function classifyPhoneType(rawType: string | null | undefined): "mobile" | "landline" | "voip" | "unknown" {
  if (!rawType) return "unknown";
  const t = rawType.toLowerCase();
  if (t.includes("mobile") || t.includes("cell") || t.includes("wireless")) return "mobile";
  if (t.includes("landline") || t.includes("land line") || t.includes("fixed")) return "landline";
  if (t.includes("voip") || t.includes("voice over ip")) return "voip";
  return "unknown";
}

/**
 * Pick the first mobile phone number from a lead's 6 phone slots.
 * Falls back to the first non-empty number if no mobile is tagged.
 * Returns null if no phone is present.
 */
export function pickTextablePhone(lead: ImportedLandLead): { number: string; type: "mobile" | "landline" | "voip" | "unknown" } | null {
  const slots = readPhoneSlots(lead).filter(slot => !!slot.number);
  if (slots.length === 0) return null;
  const mobile = slots.find(slot => classifyPhoneType(slot.type) === "mobile");
  if (mobile) return { number: mobile.number as string, type: "mobile" };
  const unknown = slots.find(slot => classifyPhoneType(slot.type) === "unknown");
  if (unknown) return { number: unknown.number as string, type: "unknown" };
  const voip = slots.find(slot => classifyPhoneType(slot.type) === "voip");
  if (voip) return { number: voip.number as string, type: "voip" };
  const landline = slots.find(slot => classifyPhoneType(slot.type) === "landline");
  if (landline) return { number: landline.number as string, type: "landline" };
  return null;
}

export function categorizeForBulkSms(leads: ImportedLandLead[]): BulkSmsCategorization {
  const recentCutoff = Date.now() - RECENT_TEXT_WINDOW_MS;
  const seenPhones = new Set<string>();
  const eligible: ImportedLandLead[] = [];
  const eligiblePhones: Record<string, string> = {};
  const excluded: BulkSmsExcludedRow[] = [];
  const excludedByReason: Record<BulkSmsExclusionReason, number> = {
    "tcpa-litigator": 0,
    "federal-dnc": 0,
    "state-dnc": 0,
    "opted-out": 0,
    "no-phone": 0,
    "landline": 0,
    "voip": 0,
    "recently-texted": 0,
    "duplicate": 0,
    "passed-or-converted": 0,
  };

  for (const lead of leads) {
    let reason: BulkSmsExclusionReason | null = null;

    // Compliance first — hard blocks
    if (lead.litigator === true) reason = "tcpa-litigator";
    else if (lead.dnc === true) reason = "federal-dnc";
    else if (lead.state_dnc === true) reason = "state-dnc";
    else if (lead.sms_opt_status === "opted-out") reason = "opted-out";

    // Data quality
    const phonePick = !reason ? pickTextablePhone(lead) : null;
    if (!reason && !phonePick) reason = "no-phone";
    if (!reason && phonePick?.type === "landline") reason = "landline";
    if (!reason && phonePick?.type === "voip") reason = "voip";

    // Lifecycle + recency
    if (!reason && (lead.status === "passed" || lead.status === "converted")) reason = "passed-or-converted";
    if (!reason && lead.duplicate_status && lead.duplicate_status !== "new") reason = "duplicate";
    if (
      !reason
      && lead.last_sms_direction === "outbound"
      && lead.last_sms_at
      && new Date(lead.last_sms_at).getTime() > recentCutoff
    ) {
      reason = "recently-texted";
    }
    if (!reason && phonePick && seenPhones.has(phonePick.number)) reason = "duplicate";

    if (reason) {
      excluded.push({ lead, reason });
      excludedByReason[reason] += 1;
    } else if (phonePick) {
      seenPhones.add(phonePick.number);
      eligible.push(lead);
      eligiblePhones[lead.id] = phonePick.number;
    }
  }

  return { eligible, eligiblePhones, excluded, excludedByReason, totalConsidered: leads.length };
}

export function exclusionReasonLabel(reason: BulkSmsExclusionReason): string {
  return EXCLUSION_LABEL[reason];
}

export function exclusionSeverity(reason: BulkSmsExclusionReason): BulkSmsExclusionSeverity {
  return EXCLUSION_SEVERITY[reason];
}

const COMPLIANCE_FOOTER = "Reply STOP to opt out.";

export function appendComplianceFooter(message: string): string {
  const trimmed = message.trimEnd();
  if (!trimmed) return COMPLIANCE_FOOTER;
  const lowered = trimmed.toLowerCase();
  if (lowered.includes("reply stop") || lowered.includes("text stop")) return trimmed;
  return `${trimmed}\n\n${COMPLIANCE_FOOTER}`;
}

const MERGE_FIELDS = ["first_name", "county", "property_count", "primary_property_address", "property_list"] as const;
type MergeField = (typeof MERGE_FIELDS)[number];

const MERGE_FIELD_PATTERN = /\{\{\s*(first_name|county|property_count|primary_property_address|property_list)\s*\}\}/g;

function pickFirstName(lead: Pick<ImportedLandLead, "owner_name">): string {
  const raw = (lead.owner_name || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[,;].*$/, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts[0] || "";
}

function pickCounty(lead: Pick<ImportedLandLead, "county">): string {
  const raw = (lead.county || "").trim();
  if (!raw) return "";
  return /county$/i.test(raw) ? raw : `${raw} County`;
}

function renderMergeValue(field: MergeField, lead: ImportedLandLead, propertyCount: number): string {
  if (field === "first_name") return pickFirstName(lead);
  if (field === "county") return pickCounty(lead);
  if (field === "property_count") return String(propertyCount);
  if (field === "primary_property_address") return propertyCount === 1 ? (lead.property_address || "") : "";
  if (field === "property_list") {
    if (propertyCount === 1) return `your land in ${pickCounty(lead)}`;
    return `the land you own in ${pickCounty(lead)}`;
  }
  return "";
}

export function renderMergeFields(template: string, lead: ImportedLandLead, propertyCount = 1): string {
  return template.replace(MERGE_FIELD_PATTERN, (_match, raw: string) => {
    const field = raw as MergeField;
    return renderMergeValue(field, lead, propertyCount);
  });
}

export function renderMessageForRecipient(template: string, lead: ImportedLandLead, propertyCount = 1): string {
  return appendComplianceFooter(renderMergeFields(template, lead, propertyCount));
}

export function estimateSegments(message: string): number {
  if (!message) return 0;
  const length = appendComplianceFooter(message).length;
  return Math.max(1, Math.ceil(length / 160));
}

export const BULK_SMS_MERGE_FIELDS = MERGE_FIELDS;
