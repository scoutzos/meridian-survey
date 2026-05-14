export type SourceFieldType = "text" | "number" | "boolean" | "date" | "url";
export type SourceFieldCategory =
  | "parcel"
  | "owner"
  | "contact"
  | "location"
  | "valuation"
  | "tax"
  | "legal"
  | "mortgage"
  | "development"
  | "environment"
  | "topography"
  | "links"
  | "compliance"
  | "demographics"
  | "source";

export interface CoercedSourceFieldValue {
  source_header: string;
  field_key: string;
  category: SourceFieldCategory;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
  data_type: SourceFieldType;
  searchable: boolean;
  filterable: boolean;
  calculator_ready: boolean;
  source_order: number;
}

export function normalizeSourceFieldKey(header: string): string {
  return header
    .replace(/%/g, " pct ")
    .replace(/>/g, " over ")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

export function parseSourceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown): boolean | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(text)) return true;
  if (["n", "no", "false", "0"].includes(text)) return false;
  return null;
}

function parseDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function inferCategory(header: string, fieldKey: string): SourceFieldCategory {
  const text = `${header} ${fieldKey}`.toLowerCase();
  if (/(phone|email|contact)/.test(text)) return "contact";
  if (/(owner|mail|selleriq)/.test(text)) return "owner";
  if (/(city|state|zip|county|latitude|longitude|fips|school)/.test(text)) return "location";
  if (/(value|price|estimate|ppa|comp|market)/.test(text)) return "valuation";
  if (/(tax|delinquent)/.test(text)) return "tax";
  if (/(deed|legal|sale|previous)/.test(text)) return "legal";
  if (/(mortgage|lender|interest)/.test(text)) return "mortgage";
  if (/(zoning|subdivision|lot|block|land_use|frontage|locked|tag|structure|farmland|entitlement|hoa)/.test(text)) return "development";
  if (/(wetland|flood)/.test(text)) return "environment";
  if (/(slope|elevation|topography)/.test(text)) return "topography";
  if (/(link|url|map|earth)/.test(text)) return "links";
  if (/(dnc|litigator|do_not_mail)/.test(text)) return "compliance";
  if (/(age|gender|ethnic|religion|education|occupation|language|marital)/.test(text)) return "demographics";
  if (/(apn|parcel|acreage|address)/.test(text)) return "parcel";
  return "source";
}

function inferType(header: string, fieldKey: string, value: unknown): SourceFieldType {
  const text = `${header} ${fieldKey}`.toLowerCase();
  if (/(link|url|map|earth)/.test(text)) return "url";
  if (/(date|since)/.test(text)) return "date";
  if (/^(y|n|yes|no|true|false)$/i.test(String(value ?? "").trim())) return "boolean";
  if (/(phone|zip|apn|fips|book|page)/.test(text)) return "text";
  if (parseSourceNumber(value) !== null) return "number";
  return "text";
}

export function buildSourceFieldValues(rawData: Record<string, unknown>): CoercedSourceFieldValue[] {
  return Object.entries(rawData).map(([header, value], index) => {
    const fieldKey = normalizeSourceFieldKey(header);
    const category = inferCategory(header, fieldKey);
    const dataType = inferType(header, fieldKey, value);
    const text = value === null || value === undefined ? "" : String(value);
    const blank = !text.trim();
    return {
      source_header: header,
      field_key: fieldKey,
      category,
      value_text: blank ? null : text,
      value_number: !blank && dataType === "number" ? parseSourceNumber(value) : null,
      value_boolean: !blank && dataType === "boolean" ? parseBoolean(value) : null,
      value_date: !blank && dataType === "date" ? parseDate(value) : null,
      value_json: value ?? null,
      data_type: dataType,
      searchable: dataType === "text" || dataType === "url",
      filterable: dataType === "number" || dataType === "boolean" || dataType === "date",
      calculator_ready: ["parcel", "valuation", "development", "environment", "topography"].includes(category),
      source_order: index,
    };
  });
}
