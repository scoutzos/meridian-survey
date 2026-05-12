import type { ImportedLandLead } from "./land-leads";

export type BulkSmsExclusionReason =
  | "opted-out"
  | "no-phone"
  | "passed-or-converted"
  | "duplicate"
  | "recently-texted";

const RECENT_TEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const EXCLUSION_LABEL: Record<BulkSmsExclusionReason, string> = {
  "opted-out": "Opted out",
  "no-phone": "Missing phone",
  "passed-or-converted": "Passed or converted",
  "duplicate": "Duplicate (kept first)",
  "recently-texted": "Texted in last 7 days",
};

export interface BulkSmsExcludedRow {
  lead: ImportedLandLead;
  reason: BulkSmsExclusionReason;
}

export interface BulkSmsCategorization {
  eligible: ImportedLandLead[];
  excluded: BulkSmsExcludedRow[];
  excludedByReason: Record<BulkSmsExclusionReason, number>;
  totalConsidered: number;
}

export function categorizeForBulkSms(leads: ImportedLandLead[]): BulkSmsCategorization {
  const recentCutoff = Date.now() - RECENT_TEXT_WINDOW_MS;
  const seenPhones = new Set<string>();
  const eligible: ImportedLandLead[] = [];
  const excluded: BulkSmsExcludedRow[] = [];
  const excludedByReason: Record<BulkSmsExclusionReason, number> = {
    "opted-out": 0,
    "no-phone": 0,
    "passed-or-converted": 0,
    "duplicate": 0,
    "recently-texted": 0,
  };

  for (const lead of leads) {
    const phone = lead.phone || lead.phone_2 || "";
    let reason: BulkSmsExclusionReason | null = null;

    if (lead.sms_opt_status === "opted-out") reason = "opted-out";
    else if (!phone) reason = "no-phone";
    else if (lead.status === "passed" || lead.status === "converted") reason = "passed-or-converted";
    else if (lead.duplicate_status && lead.duplicate_status !== "new") reason = "duplicate";
    else if (lead.last_sms_direction === "outbound" && lead.last_sms_at && new Date(lead.last_sms_at).getTime() > recentCutoff) reason = "recently-texted";
    else if (phone && seenPhones.has(phone)) reason = "duplicate";

    if (reason) {
      excluded.push({ lead, reason });
      excludedByReason[reason] += 1;
    } else {
      seenPhones.add(phone);
      eligible.push(lead);
    }
  }

  return { eligible, excluded, excludedByReason, totalConsidered: leads.length };
}

export function exclusionReasonLabel(reason: BulkSmsExclusionReason): string {
  return EXCLUSION_LABEL[reason];
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
