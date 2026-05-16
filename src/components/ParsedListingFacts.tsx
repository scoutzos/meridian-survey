import type { CSSProperties, ReactNode } from "react";

type RawData = Record<string, unknown> | null | undefined;
type ParsedRow = Record<string, string>;

interface ParsedListingFactsProps {
  rawData: RawData;
  listingText?: string | null;
  sourceUrl?: string | null;
  title?: string;
  compact?: boolean;
}

const LISTING_PREFIX = /^Listing\s+/;

const SUMMARY_FIELDS = [
  "Deal Property Type",
  "Listing Status",
  "Headline Price",
  "Primary Address",
  "Property Type",
  "Home Type",
  "Property Subtype",
  "Acreage Display",
  "Lot Size Text",
  "MLS Number",
  "Listing Agent",
  "Listing Agent Phone",
  "Listing Brokerage",
  "Also Listed On",
];

const RESIDENTIAL_FIELDS = [
  "Bedrooms",
  "Bathrooms",
  "Full Bathrooms",
  "Half Bathrooms",
  "Main Level Bedrooms",
  "Main Level Bathrooms",
  "Interior Livable Area",
  "Total Structure Area",
  "Finished Area Above Ground",
  "Finished Area Below Ground",
  "Year Built",
  "Built In",
  "Condition",
  "New Construction",
  "Builder Name",
  "Architectural Style",
  "Materials",
  "Foundation",
  "Roof",
  "Levels",
  "Stories",
  "Parking Total Spaces",
  "Parking Features",
  "Garage Spaces",
  "Basement",
  "Flooring",
  "Appliances Included",
  "Laundry",
  "Interior Features",
  "Fireplaces",
  "Fireplace Features",
  "Patio And Porch",
  "Exterior Features",
  "Pool Features",
  "Spa Features",
  "Fencing",
  "Has View",
  "View Description",
];

const SITE_FIELDS = [
  "Region",
  "Subdivision",
  "Community Name",
  "Community Features",
  "HOA Fee",
  "HOA Monthly Display",
  "Waterfront",
  "Waterfront Features",
  "Waterfront Frontage",
  "Body Of Water",
  "Lot Features",
  "Lot Dimensions",
  "Special Conditions",
  "Listing Terms",
  "Road Surface Type",
  "Water",
  "Sewer",
  "Electric",
  "Utilities",
  "Electric Utility On Property",
  "Flood Zone",
  "Neighborhood",
  "Walk Score",
  "Walk Score Label",
  "Bike Score",
  "Bike Score Label",
  "Buildability Note",
  "Recreational Use Mentioned",
];

const VALUE_FIELDS = [
  "Zestimate",
  "Estimated Sales Range",
  "Rent Zestimate",
  "Zestimate History",
  "Price Per Sqft",
  "Offer Insights",
  "Monthly Estimated Payment",
  "BuyAbility Estimated Payment",
  "Monthly Principal And Interest",
  "Monthly Property Taxes",
  "Monthly Home Insurance",
  "Monthly HOA Fees",
  "Down Payment",
  "Credit Score",
  "Down Payment Assistance",
  "Cumulative Days On Market",
  "Days On Zillow",
  "Views",
  "Saves",
  "Listing Updated",
  "Zillow Last Checked",
];

const TABLE_KEYS = [
  "Price History",
  "Public Tax History",
  "Nearby Homes",
  "Similar Homes",
  "Homes For You",
  "Search Result Listings",
  "Available Homes",
  "Other Available Plans",
];

const NEVER_OTHER_KEYS = new Set([
  ...SUMMARY_FIELDS,
  ...RESIDENTIAL_FIELDS,
  ...SITE_FIELDS,
  ...VALUE_FIELDS,
  ...TABLE_KEYS,
  "Schools",
  "Payment Breakdown",
  "URL",
  "Text",
]);

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value).trim();
  if (!text || ["--", "-", "n/a", "na", "none", "unknown"].includes(text.toLowerCase())) return null;
  return text;
}

function listingEntries(rawData: RawData): Record<string, string> {
  return Object.entries(rawData || {}).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!LISTING_PREFIX.test(key)) return acc;
    const text = textValue(value);
    if (!text) return acc;
    acc[key.replace(LISTING_PREFIX, "")] = text;
    return acc;
  }, {});
}

function exactRawValue(rawData: RawData, keys: string[]): string | null {
  for (const key of keys) {
    const value = textValue(rawData?.[key]);
    if (value) return value;
  }
  return null;
}

function fieldPairs(entries: Record<string, string>, keys: string[]): Array<[string, string]> {
  return keys.flatMap(key => entries[key] ? [[key, entries[key]] as [string, string]] : []);
}

function parseRows(value: string | null | undefined): ParsedRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(row => row && typeof row === "object" && !Array.isArray(row))
      .map(row => Object.fromEntries(
        Object.entries(row as Record<string, unknown>)
          .map(([key, raw]) => [key, textValue(raw) || ""])
          .filter(([, raw]) => raw),
      ));
  } catch {
    return [];
  }
}

function readableJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function hasAnyData(rawData: RawData): boolean {
  return Object.keys(listingEntries(rawData)).length > 0
    || Boolean(exactRawValue(rawData, ["Listing URL", "Source URL"]));
}

export function CompactParsedListingFacts({ rawData, sourceUrl, title = "Parsed Listing" }: ParsedListingFactsProps) {
  if (!hasAnyData(rawData)) return null;
  const entries = listingEntries(rawData);
  const url = sourceUrl || exactRawValue(rawData, ["Listing URL", "Source URL"]);
  const compactRows = fieldPairs(entries, [
    "Deal Property Type",
    "Listing Status",
    "Headline Price",
    "Bedrooms",
    "Bathrooms",
    "Interior Livable Area",
    "Year Built",
    "Acreage Display",
    "Lot Size Text",
    "Zestimate",
    "Rent Zestimate",
    "Cumulative Days On Market",
  ]).slice(0, 10);
  const schools = entries["Schools"];
  return (
    <section style={compactPanel}>
      <div style={sectionHeader}>
        <p style={eyebrow}>{title}</p>
        {url && <a href={url} target="_blank" rel="noreferrer" style={linkStyle}>Open source</a>}
      </div>
      <FactGrid items={compactRows} columns={2} />
      {schools && (
        <p style={compactNote}>
          <strong>Schools: </strong>{schools.split("|").map(part => part.trim()).filter(Boolean).slice(0, 8).join(" | ")}
        </p>
      )}
    </section>
  );
}

export default function ParsedListingFacts({ rawData, listingText, sourceUrl, title = "Parsed Listing Facts", compact = false }: ParsedListingFactsProps) {
  if (!hasAnyData(rawData)) return null;
  if (compact) return <CompactParsedListingFacts rawData={rawData} sourceUrl={sourceUrl} title={title} />;

  const entries = listingEntries(rawData);
  const url = sourceUrl || exactRawValue(rawData, ["Listing URL", "Source URL"]);
  const originalText = listingText || entries.Text || exactRawValue(rawData, ["Listing Text"]);
  const priceHistory = parseRows(entries["Price History"]);
  const taxHistory = parseRows(entries["Public Tax History"]);
  const nearby = parseRows(entries["Nearby Homes"]);
  const similar = parseRows(entries["Similar Homes"]);
  const homesForYou = parseRows(entries["Homes For You"]);
  const searchListings = parseRows(entries["Search Result Listings"]);
  const availableHomes = parseRows(entries["Available Homes"]);
  const plans = parseRows(entries["Other Available Plans"]);
  const paymentRows = parsePaymentRows(entries["Payment Breakdown"]);
  const otherEntries = Object.entries(entries)
    .filter(([key]) => !NEVER_OTHER_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <section style={panel}>
      <div style={sectionHeader}>
        <div>
          <p style={eyebrow}>{title}</p>
          <h3 style={titleStyle}>{entries["Primary Address"] || exactRawValue(rawData, ["Property Address"]) || "Captured listing data"}</h3>
        </div>
        {url && <a href={url} target="_blank" rel="noreferrer" style={buttonLink}>Open Source</a>}
      </div>

      <FactSection title="Listing Summary" items={fieldPairs(entries, SUMMARY_FIELDS)} />
      <FactSection title="Residential Facts" items={fieldPairs(entries, RESIDENTIAL_FIELDS)} />
      <FactSection title="Land, Site, And Location" items={fieldPairs(entries, SITE_FIELDS)} />
      <FactSection title="Value, Tax, And Listing Activity" items={fieldPairs(entries, VALUE_FIELDS)} />
      {paymentRows.length > 0 && <SimpleTable title="Payment Breakdown" rows={paymentRows} columns={["label", "value"]} />}
      {entries.Schools && <SchoolsBlock value={entries.Schools} />}
      {priceHistory.length > 0 && <SimpleTable title="Listing / Price History" rows={priceHistory} columns={["date", "event", "price", "change", "pricePerSqft", "source"]} />}
      {taxHistory.length > 0 && <SimpleTable title="Public Tax History" rows={taxHistory} columns={["year", "propertyTaxes", "taxAssessment"]} />}
      {nearby.length > 0 && <CardRows title="Nearby Homes" rows={nearby} />}
      {similar.length > 0 && <CardRows title="Similar Homes" rows={similar} />}
      {homesForYou.length > 0 && <CardRows title="Homes For You" rows={homesForYou} />}
      {searchListings.length > 0 && <CardRows title="Search Result Listings" rows={searchListings} />}
      {availableHomes.length > 0 && <SimpleTable title="Available Homes" rows={availableHomes} columns={["listing", "price", "bedBath", "status"]} />}
      {plans.length > 0 && <SimpleTable title="Other Available Plans" rows={plans} columns={["name", "price", "summary", "status", "builder"]} />}
      {otherEntries.length > 0 && <OtherParsedFields entries={otherEntries} />}
      {originalText && (
        <details style={detailsPanel}>
          <summary style={summaryStyle}>Original Listing Text</summary>
          <pre style={preStyle}>{originalText}</pre>
        </details>
      )}
    </section>
  );
}

function parsePaymentRows(value: string | null | undefined): ParsedRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .map(([label, raw]) => ({ label, value: textValue(raw) || "" }))
      .filter(row => row.value);
  } catch {
    return [];
  }
}

function FactSection({ title, items }: { title: string; items: Array<[string, string]> }) {
  if (!items.length) return null;
  return (
    <section style={sectionPanel}>
      <p style={eyebrow}>{title}</p>
      <FactGrid items={items} />
    </section>
  );
}

function FactGrid({ items, columns = 3 }: { items: Array<[string, string]>; columns?: number }) {
  if (!items.length) return null;
  return (
    <dl style={{ ...gridStyle, gridTemplateColumns: `repeat(auto-fit, minmax(${columns === 2 ? 150 : 180}px, 1fr))` }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <dt style={labelStyle}>{label}</dt>
          <dd style={valueStyle}>{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SimpleTable({ title, rows, columns }: { title: string; rows: ParsedRow[]; columns: string[] }) {
  if (!rows.length) return null;
  return (
    <section style={sectionPanel}>
      <p style={eyebrow}>{title}</p>
      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {columns.map(column => <th key={column} style={thStyle}>{humanize(column)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {columns.map(column => <td key={column} style={tdStyle}>{displayValue(row[column])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SchoolsBlock({ value }: { value: string }) {
  const rows = value.split("|").map(part => part.trim()).filter(Boolean);
  if (!rows.length) return null;
  return (
    <section style={sectionPanel}>
      <p style={eyebrow}>Schools</p>
      <div style={{ display: "grid", gap: 6 }}>
        {rows.slice(0, 24).map((row, index) => (
          <p key={`${row}-${index}`} style={schoolRow}>{row}</p>
        ))}
      </div>
    </section>
  );
}

function CardRows({ title, rows }: { title: string; rows: ParsedRow[] }) {
  if (!rows.length) return null;
  return (
    <section style={sectionPanel}>
      <p style={eyebrow}>{title}</p>
      <div style={cardGrid}>
        {rows.map((row, index) => (
          <article key={`${title}-${index}`} style={listingCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <strong style={cardTitle}>{row.address || row.name || row.listing || "Listing"}</strong>
              <span style={priceStyle}>{row.price || "Price ?"}</span>
            </div>
            <p style={metaStyle}>{[row.summary, row.status, row.bedBath].filter(Boolean).join(" · ") || "Details missing"}</p>
            {row.source && <p style={metaStyle}>{row.source}</p>}
            {row.note && <p style={noteStyle}>{row.note}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function OtherParsedFields({ entries }: { entries: Array<[string, string]> }) {
  return (
    <details style={detailsPanel} open>
      <summary style={summaryStyle}>Other Parsed Fields ({entries.length})</summary>
      <dl style={{ ...gridStyle, marginTop: 12 }}>
        {entries.map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <dt style={labelStyle}>{label}</dt>
            <dd style={{ ...valueStyle, whiteSpace: looksLikeJson(value) ? "pre-wrap" : "normal" }}>{displayValue(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function displayValue(value: string | undefined): ReactNode {
  if (!value) return "—";
  if (looksLikeJson(value)) return readableJson(value);
  return value;
}

function looksLikeJson(value: string): boolean {
  return /^\s*[\[{]/.test(value);
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

const panel: CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  display: "grid",
  gap: 12,
  padding: 14,
};

const compactPanel: CSSProperties = {
  borderTop: "1px solid var(--fog)",
  display: "grid",
  gap: 8,
  padding: "14px 16px",
};

const sectionPanel: CSSProperties = {
  background: "rgba(255,255,255,0.62)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
};

const detailsPanel: CSSProperties = {
  ...sectionPanel,
  maxHeight: 620,
  overflow: "auto",
};

const sectionHeader: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const eyebrow: CSSProperties = {
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
  lineHeight: 1.3,
  margin: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  color: "var(--obsidian)",
  fontFamily: "var(--font-display)",
  fontSize: 18,
  fontWeight: 500,
  lineHeight: 1.2,
  margin: "5px 0 0",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  margin: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.11em",
  marginBottom: 4,
  textTransform: "uppercase",
};

const valueStyle: CSSProperties = {
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.38,
  margin: 0,
  overflowWrap: "anywhere",
};

const linkStyle: CSSProperties = {
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const buttonLink: CSSProperties = {
  background: "var(--obsidian)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  color: "var(--bone)",
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  minHeight: 34,
  padding: "8px 11px",
  textDecoration: "none",
  textTransform: "uppercase",
};

const compactNote: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: 0,
};

const tableWrap: CSSProperties = {
  maxWidth: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  minWidth: "100%",
};

const thStyle: CSSProperties = {
  borderBottom: "1px solid var(--fog)",
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  padding: "0 8px 8px 0",
  textAlign: "left",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  borderBottom: "1px solid rgba(20,17,13,0.08)",
  color: "var(--ink)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
  padding: "8px 10px 8px 0",
  verticalAlign: "top",
};

const schoolRow: CSSProperties = {
  color: "var(--ink)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.38,
  margin: 0,
};

const cardGrid: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const listingCard: CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 10,
};

const cardTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 13,
  lineHeight: 1.25,
};

const priceStyle: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const metaStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.35,
  margin: "5px 0 0",
};

const noteStyle: CSSProperties = {
  color: "var(--ink)",
  fontSize: 12,
  lineHeight: 1.38,
  margin: "6px 0 0",
};

const summaryStyle: CSSProperties = {
  color: "var(--obsidian)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const preStyle: CSSProperties = {
  color: "var(--muted)",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: "10px 0 0",
  maxHeight: 360,
  overflow: "auto",
  whiteSpace: "pre-wrap",
};
