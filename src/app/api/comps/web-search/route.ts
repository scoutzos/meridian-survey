import { NextRequest, NextResponse } from "next/server";

type CompStatus = "sold" | "pending" | "active" | "unknown";
type CompConfidence = "high" | "medium" | "low" | "needs-review";

interface WebCompLeadPayload {
  property_address?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  zip?: string | null;
  acreage?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  raw_data?: Record<string, unknown> | null;
}

interface SearchResult {
  provider: string;
  query: string;
  title: string;
  url: string;
  content: string;
  rawContent?: string | null;
}

interface WebCompCandidate {
  address: string;
  price: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  saleDate: string | null;
  status: CompStatus;
  newConstruction: boolean;
  score: number;
  confidence: CompConfidence;
  sourceSystem: string;
  sourceUrl: string;
  sourceTitle: string;
  snippet: string;
  matchReason: string;
  listingDetails: Record<string, string | number | null>;
  rawData: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 12_000;
const CURRENT_YEAR = new Date().getFullYear();
const TARGET_DOMAINS = ["homes.com", "redfin.com", "zillow.com", "realtor.com"];
const ADDRESS_PATTERN = /\b\d{2,6}\s+[A-Za-z0-9.'#\-\s]+?(?:Rd|Road|Dr|Drive|Ave|Avenue|Way|Ct|Court|Ln|Lane|St|Street|Blvd|Boulevard|Pkwy|Parkway|Trail|Trl|Cir|Circle|Place|Pl|Terrace|Ter|Path|Run|Ridge|Hwy|Highway)\b[^,\n]{0,50},\s*[A-Za-z.'\-\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi;

function clean(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value || "").replace(/[$,\s]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAddress(value: string | null | undefined): string {
  return clean(value)
    .toLowerCase()
    .replace(/\b(sw|se|nw|ne|n|s|e|w)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityStateZip(lead: WebCompLeadPayload): string {
  return [lead.city, lead.state || "GA", lead.zip].filter(Boolean).join(" ");
}

function buildQueries(lead: WebCompLeadPayload): string[] {
  const city = lead.city || "";
  const state = lead.state || "GA";
  const zip = lead.zip || "";
  const location = cityStateZip(lead) || [lead.county, state].filter(Boolean).join(" ");
  const quotedCity = city ? `"${city}"` : "";
  const quotedZip = zip ? `"${zip}"` : "";
  const address = lead.property_address ? `"${lead.property_address}"` : "";

  return Array.from(new Set([
    `${location} sold new construction homes built ${CURRENT_YEAR} ${CURRENT_YEAR - 1} Homes.com`,
    `${quotedCity} ${quotedZip} "Sold" "Built ${CURRENT_YEAR}" "Sq Ft"`,
    `site:homes.com ${city} ${state} ${zip} sold new construction built ${CURRENT_YEAR}`,
    `site:redfin.com ${city} ${state} ${zip} sold "Year Built" "${CURRENT_YEAR}"`,
    `${address} nearby sold new construction homes ${city} ${zip}`,
  ].map(query => query.replace(/\s+/g, " ").trim()).filter(Boolean))).slice(0, 5);
}

function searchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "MeridianCompSearch/1.0",
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function tavilySearch(query: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const json = await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      country: "united states",
      max_results: 8,
      include_answer: false,
      include_raw_content: "text",
      include_domains: TARGET_DOMAINS,
    }),
  }) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      raw_content?: string | null;
    }>;
  };

  return (json.results || []).map(result => ({
    provider: "Tavily",
    query,
    title: clean(result.title),
    url: clean(result.url),
    content: clean(result.content),
    rawContent: result.raw_content || null,
  })).filter(result => result.url);
}

async function braveSearch(query: string): Promise<SearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    q: query,
    country: "US",
    search_lang: "en",
    safesearch: "moderate",
    count: "10",
    spellcheck: "1",
  });
  const json = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
  }) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        extra_snippets?: string[];
      }>;
    };
  };

  return (json.web?.results || []).map(result => ({
    provider: "Brave",
    query,
    title: clean(result.title),
    url: clean(result.url),
    content: clean([result.description, ...(result.extra_snippets || [])].filter(Boolean).join(" ")),
  })).filter(result => result.url);
}

async function runSearches(queries: string[]): Promise<{ provider: string; results: SearchResult[]; warnings: string[] }> {
  const warnings: string[] = [];
  const provider = process.env.TAVILY_API_KEY ? "Tavily" : process.env.BRAVE_SEARCH_API_KEY ? "Brave" : "not-configured";
  if (provider === "not-configured") return { provider, results: [], warnings };

  const search = provider === "Tavily" ? tavilySearch : braveSearch;
  const batches = await Promise.all(queries.slice(0, 4).map(async query => {
    try {
      return await search(query);
    } catch (error) {
      warnings.push(`${provider} search failed for "${query}": ${error instanceof Error ? error.message : "unknown error"}`);
      return [];
    }
  }));

  const seen = new Set<string>();
  return {
    provider,
    warnings,
    results: batches.flat().filter(result => {
      const key = result.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

function moneyMatches(text: string): Array<{ value: number; index: number }> {
  const matches = Array.from(text.matchAll(/\$\s*([0-9][0-9,.]*)([kKmM])?/g));
  return matches
    .map(match => {
      const raw = Number(String(match[1] || "").replace(/,/g, ""));
      const multiplier = /m/i.test(match[2] || "") ? 1_000_000 : /k/i.test(match[2] || "") ? 1_000 : 1;
      return { value: raw * multiplier, index: match.index || 0 };
    })
    .filter(match => Number.isFinite(match.value) && match.value >= 120_000 && match.value <= 2_000_000);
}

function nearestNumber(
  text: string,
  center: number,
  pattern: RegExp,
  parser: (match: RegExpMatchArray) => number | null,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): number | null {
  const matches = Array.from(text.matchAll(pattern))
    .map(match => ({ value: parser(match), index: match.index || 0 }))
    .filter((match): match is { value: number; index: number } => match.value !== null && match.value >= min && match.value <= max)
    .sort((a, b) => Math.abs(a.index - center) - Math.abs(b.index - center));
  return matches[0]?.value ?? null;
}

function nearestPrice(text: string, center: number): number | null {
  return moneyMatches(text)
    .sort((a, b) => Math.abs(a.index - center) - Math.abs(b.index - center))[0]?.value ?? null;
}

function parseSqft(text: string, center: number): number | null {
  return nearestNumber(text, center, /([0-9][0-9,.]*)(k)?\s*(?:sq\s*ft|sqft|sf)\b/gi, match => {
    const raw = Number(String(match[1] || "").replace(/,/g, ""));
    if (!Number.isFinite(raw)) return null;
    return /k/i.test(match[2] || "") ? Math.round(raw * 1000) : raw;
  }, 500, 8000);
}

function parseBeds(text: string, center: number): number | null {
  return nearestNumber(text, center, /(\d+(?:\.\d+)?)\s*(?:bd|bed|beds|bedroom|bedrooms)\b/gi, match => Number(match[1]), 1, 10);
}

function parseBaths(text: string, center: number): number | null {
  return nearestNumber(text, center, /(\d+(?:\.\d+)?)\s*(?:ba|bath|baths|bathroom|bathrooms)\b/gi, match => Number(match[1]), 1, 10);
}

function parseYearBuilt(text: string, center: number): number | null {
  return nearestNumber(text, center, /(?:built(?:\s+in)?|year built)\s*:?\s*(20\d{2}|19\d{2})|(20\d{2}|19\d{2})\s+(?:year\s+built|built)/gi, match => {
    const year = Number(match[1] || match[2]);
    return Number.isFinite(year) ? year : null;
  }, 1990, CURRENT_YEAR + 1);
}

function parseDateValue(value: string): string | null {
  const date = new Date(value.replace(/\s+/g, " "));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseSaleDate(text: string, center: number, status: CompStatus): string | null {
  const window = text.slice(Math.max(0, center - 260), Math.min(text.length, center + 260));
  const patterns = [
    /\bSold\s+(?:on\s+)?([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /\bSOLD\s+([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})\s*\|\s*(?:Sold|Closed)/i,
    /\b(?:Closed|Sold)\s+(?:sale\s+)?(?:on\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = window.match(pattern);
    const parsed = match?.[1] ? parseDateValue(match[1]) : null;
    if (parsed) return parsed;
  }
  if (status !== "sold") return null;
  const yearOnly = window.match(/\bSold\b[^.]{0,40}\b(20\d{2})\b/i);
  return yearOnly?.[1] ? `${yearOnly[1]}-01-01` : null;
}

function inferStatus(text: string, center: number, result: SearchResult): CompStatus {
  const window = `${result.title} ${text.slice(Math.max(0, center - 240), Math.min(text.length, center + 240))}`;
  if (/\bSold\b|\bRecently Sold\b|\bLast Sold\b|\bClosed\b/i.test(window)) return "sold";
  if (/\bPending\b|\bContingent\b|\bUnder Contract\b/i.test(window)) return "pending";
  if (/\bActive\b|\bFor Sale\b|\bListed\b/i.test(window)) return "active";
  return "unknown";
}

function isLandOnly(text: string): boolean {
  return /\b(?:lot\/land|land for sale|acres?\s+lot|unimproved land|vacant land|residential lot)\b/i.test(text);
}

function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0]?.replace(/^\w/, char => char.toUpperCase()) || "Web";
  } catch {
    return "Web";
  }
}

function scoreCandidate(candidate: Omit<WebCompCandidate, "score" | "confidence" | "matchReason">, lead: WebCompLeadPayload): { score: number; confidence: CompConfidence; matchReason: string } {
  let score = 0;
  const reasons: string[] = [];
  if (candidate.status === "sold") { score += 28; reasons.push("sold/closed result"); }
  else if (candidate.status === "pending") { score += 12; reasons.push("pending signal only"); }
  else if (candidate.status === "active") { score += 6; reasons.push("active listing, not ARV proof"); }

  if (candidate.newConstruction) { score += 25; reasons.push(candidate.yearBuilt ? `built ${candidate.yearBuilt}` : "new-construction wording"); }
  if (lead.zip && candidate.address.includes(String(lead.zip))) { score += 14; reasons.push("same ZIP"); }
  if (lead.city && candidate.address.toLowerCase().includes(lead.city.toLowerCase())) { score += 10; reasons.push("same city"); }
  if (candidate.sqft) { score += 8; reasons.push(`${candidate.sqft.toLocaleString()} sf`); }
  if (candidate.beds || candidate.baths) { score += 5; reasons.push("bed/bath present"); }
  if (candidate.saleDate) {
    const months = (Date.now() - new Date(candidate.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (months <= 18) { score += 10; reasons.push("recent sale date"); }
    else score += 4;
  }
  if (/homes|redfin|zillow|realtor/i.test(candidate.sourceSystem)) score += 4;
  if (isLandOnly(candidate.snippet) && !candidate.sqft && !candidate.beds) score -= 45;
  if (normalizeAddress(candidate.address) === normalizeAddress(lead.property_address)) score -= 60;
  score = Math.max(0, Math.min(100, score));

  const confidence: CompConfidence = score >= 76 && candidate.status === "sold" && candidate.newConstruction
    ? "high"
    : score >= 58
      ? "medium"
      : score >= 40
        ? "low"
        : "needs-review";
  return {
    score,
    confidence,
    matchReason: reasons.length ? reasons.join(" · ") : "Public web search candidate; verify before ARV proof.",
  };
}

function extractCandidates(result: SearchResult, lead: WebCompLeadPayload): WebCompCandidate[] {
  const combined = clean([result.title, result.content, result.rawContent].filter(Boolean).join(" "));
  const addressMatches = Array.from(combined.matchAll(ADDRESS_PATTERN));
  const subjectKey = normalizeAddress(lead.property_address);
  return addressMatches.map(match => {
    const address = clean(match[0]);
    const center = match.index || 0;
    const snippet = clean(combined.slice(Math.max(0, center - 340), Math.min(combined.length, center + 520)));
    const status = inferStatus(combined, center, result);
    const yearBuilt = parseYearBuilt(combined, center);
    const saleDate = parseSaleDate(combined, center, status);
    const sqft = parseSqft(combined, center);
    const beds = parseBeds(combined, center);
    const baths = parseBaths(combined, center);
    const sourceSystem = sourceName(result.url);
    const newConstruction = Boolean(
      (yearBuilt && yearBuilt >= CURRENT_YEAR - 2)
      || /\b(?:new construction|new build|new home|move in ready|builder|built 2025|built 2026|built 2027|century communities|d\.?r\.?\s+horton|lennar|pulte)\b/i.test(snippet),
    );
    const price = nearestPrice(combined, center);
    const base = {
      address,
      price,
      sqft,
      beds,
      baths,
      yearBuilt,
      saleDate,
      status,
      newConstruction,
      sourceSystem,
      sourceUrl: result.url,
      sourceTitle: result.title,
      snippet,
      listingDetails: {
        "Asset Type": "finished-home",
        "Beds": beds,
        "Baths": baths,
        "Square Feet": sqft,
        "Year Built": yearBuilt,
        "Public Sale Status": status,
        "New Construction Signal": newConstruction ? "Yes" : "No",
        "Search Query": result.query,
      },
      rawData: {
        "Comp Search Provider": result.provider,
        "Comp Search Query": result.query,
        "Comp Search Title": result.title,
        "Comp Search Snippet": snippet,
        "Comp Public Candidate": true,
        "Comp Requires MLS Verification": true,
      },
    };
    const scored = scoreCandidate(base, lead);
    return { ...base, ...scored };
  }).filter(candidate => {
    if (!candidate.address || normalizeAddress(candidate.address) === subjectKey) return false;
    if (candidate.price !== null && candidate.price < 120_000) return false;
    if (isLandOnly(candidate.snippet) && !candidate.sqft && !candidate.beds) return false;
    return Boolean(candidate.price)
      || candidate.status === "sold"
      || candidate.newConstruction
      || Boolean(candidate.sqft || candidate.beds);
  });
}

function uniqueCandidates(candidates: WebCompCandidate[]): WebCompCandidate[] {
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(candidate => {
      const key = `${normalizeAddress(candidate.address)}:${candidate.price || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { lead?: WebCompLeadPayload; max_results?: number };
  const lead = body.lead || {};
  const queries = buildQueries(lead);
  if (!queries.length) {
    return NextResponse.json({ error: "A city, ZIP, county, or address is required to run web comp search." }, { status: 400 });
  }

  const { provider, results, warnings } = await runSearches(queries);
  if (provider === "not-configured") {
    return NextResponse.json({
      error: "Web comp search is not configured. Add TAVILY_API_KEY or BRAVE_SEARCH_API_KEY in Vercel to let the portal search the public web.",
      provider,
      queries,
      manual_search_links: queries.map(query => ({ query, url: searchUrl(query) })),
      candidates: [],
      searched_at: new Date().toISOString(),
    }, { status: 424 });
  }

  const candidates = uniqueCandidates(results.flatMap(result => extractCandidates(result, lead)))
    .slice(0, Math.max(1, Math.min(num(body.max_results) || 8, 12)));

  return NextResponse.json({
    ok: true,
    provider,
    queries,
    searched_at: new Date().toISOString(),
    result_count: results.length,
    candidate_count: candidates.length,
    warnings,
    manual_search_links: queries.map(query => ({ query, url: searchUrl(query) })),
    candidates,
  });
}
