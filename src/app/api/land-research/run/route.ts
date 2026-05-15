import { NextRequest, NextResponse } from "next/server";

type FindingCategory = "access" | "flood" | "wetlands" | "zoning" | "tax" | "gis" | "comps" | "ownership" | "utilities" | "notes";
type FindingStatus = "verified" | "in-progress" | "blocked" | "todo" | "not-applicable";

interface ResearchLeadPayload {
  id?: string;
  property_address?: string | null;
  parcel_id?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  acreage?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  road_frontage_ft?: number | null;
  is_land_locked?: boolean | null;
  flood_zone_percent?: number | null;
  flood_zone_type?: string | null;
  wetlands_percent?: number | null;
  zoning?: string | null;
  assessed_value?: number | null;
  property_tax?: number | null;
  market_value_estimate_ppa?: number | null;
  market_value_estimate_comp_count?: number | null;
  property_url?: string | null;
  parcel_link?: string | null;
  raw_data?: Record<string, unknown>;
}

interface AutomatedFinding {
  category: FindingCategory;
  title: string;
  status: FindingStatus;
  result_summary: string;
  evidence_value: string | null;
  source_name: string;
  source_url: string;
  confidence: "high" | "medium" | "low";
  blocker?: string | null;
}

interface ResearchSourceLink {
  category: FindingCategory;
  source_name: string;
  source_url: string;
}

interface CountyParcelConfig {
  county: string;
  state: string;
  sourceName: string;
  layerUrl: string;
  parcelFields: string[];
  addressFields: string[];
  ownerFields: string[];
  acreageFields: string[];
  zoningFields: string[];
  landUseFields: string[];
  assessedValueFields: string[];
  taxFields: string[];
  mailingFields: string[];
}

interface CountyParcelMatch {
  sourceName: string;
  sourceUrl: string;
  parcelId: string | null;
  address: string | null;
  owner: string | null;
  acreage: number | null;
  zoning: string | null;
  landUse: string | null;
  assessedValue: number | null;
  propertyTax: number | null;
  mailingAddress: string | null;
  addressMatchesSubject: boolean | null;
  raw: Record<string, unknown>;
}

interface ResearchResponse {
  ok: boolean;
  location: {
    latitude: number | null;
    longitude: number | null;
    matched_address: string | null;
    county: string | null;
    state: string | null;
    geocoder: string;
  };
  parcel_match: CountyParcelMatch | null;
  findings: AutomatedFinding[];
  source_links: ResearchSourceLink[];
  warnings: string[];
  checked_at: string;
}

const REQUEST_TIMEOUT_MS = 9000;

const COUNTY_PARCEL_CONFIGS: CountyParcelConfig[] = [
  {
    county: "Gwinnett",
    state: "GA",
    sourceName: "Gwinnett County parcel GIS",
    layerUrl: "https://services1.arcgis.com/s9fZ9Xw5NF8fOMXl/arcgis/rest/services/HD98_Parcels_Gwinnett/FeatureServer/0",
    parcelFields: ["ParcelNew_PIN", "ParcelNew_TAXPIN", "ParcelNew_RPIN", "ParcelNew_PIN_1"],
    addressFields: ["ParcelNew_LOCADDR", "ParcelNew_ADDRESS"],
    ownerFields: ["ParcelNew_OWNER1", "ParcelNew_OWNER2"],
    acreageFields: ["ParcelNew_DEEDEDACRE", "ParcelNew_CALCULATED", "ParcelNew_LEGALAC"],
    zoningFields: ["ParcelNew_ZONING", "ParcelNew_ZONEDESC"],
    landUseFields: ["ParcelNew_PROPCLAS", "ParcelNew_PCDESC"],
    assessedValueFields: ["ParcelNew_TOTVAL1", "ParcelNew_LANDVAL1"],
    taxFields: ["ParcelNew_TAXTOT1"],
    mailingFields: ["ParcelNew_MAILADDR", "ParcelNew_MAILCITY", "ParcelNew_MAILSTAT", "ParcelNew_MAILZIP"],
  },
  {
    county: "Henry",
    state: "GA",
    sourceName: "Henry County parcels",
    layerUrl: "https://arcgis.co.henry.ga.us/server/rest/services/Parcels/MapServer/12",
    parcelFields: ["PARCEL_NO"],
    addressFields: ["FULLADDRES", "HOUSE", "STREETNAME"],
    ownerFields: [],
    acreageFields: ["ACREAGE_1"],
    zoningFields: ["ZONING"],
    landUseFields: ["FUTURE_LAN"],
    assessedValueFields: [],
    taxFields: [],
    mailingFields: [],
  },
  {
    county: "Rockdale",
    state: "GA",
    sourceName: "Rockdale County parcels",
    layerUrl: "https://services.arcgis.com/Tbke9ca9DhtF4VIx/ArcGIS/rest/services/Rockdale_County_Parcels/FeatureServer/38",
    parcelFields: ["PARCEL_NO"],
    addressFields: ["BOA_Addres", "Address", "Road_name"],
    ownerFields: [],
    acreageFields: ["Acreage", "Calc_Ac"],
    zoningFields: ["County_Zon", "City_Zonin", "County_Z_1", "City_Zon_1", "Sec_Cnty_Z", "Sec_City_Z"],
    landUseFields: ["County_Lan", "City_Land_", "Sec_Cnty_L", "Sec_City_L"],
    assessedValueFields: ["Fair_Marke", "Valuation"],
    taxFields: [],
    mailingFields: [],
  },
  {
    county: "DeKalb",
    state: "GA",
    sourceName: "DeKalb County tax parcels",
    layerUrl: "https://dcgis.dekalbcountyga.gov/hosted/rest/services/Tax_Parcels/FeatureServer/0",
    parcelFields: ["PARCELID", "LOWPARCELID"],
    addressFields: ["SITEADDRESS", "ADDRESS_NUMBER", "FULL_STREET_NAME", "CITY", "STATE", "ZIP"],
    ownerFields: ["OWNERNME1", "OWNERNME2"],
    acreageFields: ["STATEDAREA"],
    zoningFields: ["ZONING", "OVLDESC", "OVLDISTRICT"],
    landUseFields: ["USEDSCRP", "CLASSDSCRP", "LANDUSE"],
    assessedValueFields: ["TOTAPR1"],
    taxFields: [],
    mailingFields: ["PSTLADDRESS", "PSTLCITY", "PSTLSTATE", "PSTLZIP5"],
  },
  {
    county: "Fulton",
    state: "GA",
    sourceName: "Fulton County property map parcels",
    layerUrl: "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/PropertyMapViewerAGOL/FeatureServer/26",
    parcelFields: ["PARCELID", "PIN", "PARID"],
    addressFields: ["SITEADDRESS", "ADDRESS", "FULLADDR"],
    ownerFields: ["OWNER", "OWNERNME1", "OWNERNME2"],
    acreageFields: ["ACRES", "ACREAGE"],
    zoningFields: ["ZONING"],
    landUseFields: ["LANDUSE", "USECD", "USEDSCRP"],
    assessedValueFields: ["TOTAPR1", "TOTAL_VALUE"],
    taxFields: [],
    mailingFields: ["MAILADDR", "PSTLADDRESS"],
  },
  {
    county: "Cherokee",
    state: "GA",
    sourceName: "Cherokee County parcels",
    layerUrl: "https://gis.cherokeecountyga.gov/arcgis/rest/services/MainLayers/MapServer/1",
    parcelFields: ["TIN", "TINNoSpace", "PIN"],
    addressFields: ["Property_Address", "Property_City", "Property_Zip"],
    ownerFields: ["Owner"],
    acreageFields: ["Acreage"],
    zoningFields: ["Zoning"],
    landUseFields: ["Subdivision", "TaxDistrict"],
    assessedValueFields: [],
    taxFields: [],
    mailingFields: ["Mailing_Address", "Mailing_Suite", "Mailing_City", "Mailing_State", "Mailing_Zip"],
  },
  {
    county: "Forsyth",
    state: "GA",
    sourceName: "Forsyth County tax parcels",
    layerUrl: "https://geo.forsythco.com/gis/rest/services/Public/Tax_Parcel/MapServer/0",
    parcelFields: ["PARCELID"],
    addressFields: ["SITEADDRESS"],
    ownerFields: [],
    acreageFields: ["STATEDAREA"],
    zoningFields: ["ZONING"],
    landUseFields: ["USEDSCRP", "CLASSDSCRP", "USECD", "CLASSCD"],
    assessedValueFields: ["CNTASSDVAL", "PRVASSDVAL", "LNDVALUE", "CNTTXBLVAL", "PRVTXBLVAL"],
    taxFields: [],
    mailingFields: ["PSTLADDRESS", "PSTLCITY", "PSTLSTATE", "PSTLZIP5", "PSTLZIP4"],
  },
  {
    county: "Clayton",
    state: "GA",
    sourceName: "Clayton County parcel polygons",
    layerUrl: "https://gis.claytoncountyga.gov/server/rest/services/TYLER/DISPLAY/FeatureServer/17",
    parcelFields: ["PARCELID", "PIN2"],
    addressFields: ["SITEADDRES", "STREETNO", "STREETNAME", "SITECITY", "SITEZIP5"],
    ownerFields: ["OWNERNME"],
    acreageFields: ["ACERAGE"],
    zoningFields: ["ZONE"],
    landUseFields: ["LANDUSEC", "LANDUSED"],
    assessedValueFields: ["APPRVAL", "IMPROVEMNT"],
    taxFields: [],
    mailingFields: ["PSTLADDRES", "PSTLCITY", "PSTLSTATE", "PSTLZIP5"],
  },
  {
    county: "Douglas",
    state: "GA",
    sourceName: "Douglas County parcels",
    layerUrl: "https://maps.douglascountyga.gov/arcgis/rest/services/Layers/MapServer/13",
    parcelFields: ["ParcelNo", "PARCEL"],
    addressFields: ["PropertyAddress"],
    ownerFields: ["Owner"],
    acreageFields: ["totalacres"],
    zoningFields: ["ZONING_GIS", "SZ_GIS"],
    landUseFields: ["FLU_GIS", "SFLU_GIS", "digclass", "SUBDIVISION"],
    assessedValueFields: ["mavcurr", "mavprev"],
    taxFields: [],
    mailingFields: ["address1", "address2", "address3", "MailingAddressCity", "MailingAddressState", "MailingAddressZipCode"],
  },
  {
    county: "Fayette",
    state: "GA",
    sourceName: "Fayette County parcels",
    layerUrl: "https://gis.fayettecountyga.gov/arcgis/rest/services/Pictometry/parcelsRO/MapServer/0",
    parcelFields: ["PARCEL_NO", "PARCEL_KEY", "PARCEL"],
    addressFields: [],
    ownerFields: [],
    acreageFields: ["acres"],
    zoningFields: ["Zoning"],
    landUseFields: [],
    assessedValueFields: [],
    taxFields: [],
    mailingFields: [],
  },
];

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function countyName(value: string | null | undefined): string {
  return (value || "").replace(/\s+county$/i, "").trim();
}

function normalizeKey(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sqlText(value: string): string {
  return value.replace(/'/g, "''");
}

function oneLineAddress(lead: ResearchLeadPayload): string {
  return [
    lead.property_address,
    lead.city,
    lead.state,
    lead.zip,
  ].filter(Boolean).join(", ");
}

function searchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function pickAttr(attrs: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = clean(attrs[field]);
    if (value) return value;
  }
  return null;
}

function pickNumberAttr(attrs: Record<string, unknown>, fields: string[]): number | null {
  for (const field of fields) {
    const value = num(attrs[field]);
    if (value !== null) return value;
  }
  return null;
}

function joinAttrs(attrs: Record<string, unknown>, fields: string[]): string | null {
  const parts = fields.map(field => clean(attrs[field])).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "MeridianLandResearch/1.0",
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(lead: ResearchLeadPayload, warnings: string[]) {
  if (typeof lead.latitude === "number" && typeof lead.longitude === "number") {
    return {
      latitude: lead.latitude,
      longitude: lead.longitude,
      matched_address: oneLineAddress(lead) || null,
      county: lead.county || null,
      state: lead.state || null,
      geocoder: "Imported coordinates",
    };
  }

  const address = oneLineAddress(lead);
  if (!address) {
    warnings.push("No address or coordinates were available for automatic geocoding.");
    return { latitude: null, longitude: null, matched_address: null, county: lead.county || null, state: lead.state || null, geocoder: "None" };
  }

  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const json = await fetchJson(url) as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x?: number; y?: number };
          geographies?: Record<string, Array<Record<string, string>>>;
        }>;
      };
    };
    const match = json.result?.addressMatches?.[0];
    const county = match?.geographies?.Counties?.[0]?.NAME || lead.county || null;
    const state = match?.geographies?.States?.[0]?.STUSAB || lead.state || null;
    return {
      latitude: typeof match?.coordinates?.y === "number" ? match.coordinates.y : null,
      longitude: typeof match?.coordinates?.x === "number" ? match.coordinates.x : null,
      matched_address: match?.matchedAddress || address,
      county,
      state,
      geocoder: "U.S. Census Geocoder",
    };
  } catch (error) {
    warnings.push(`Census geocoder did not return a usable match: ${error instanceof Error ? error.message : "unknown error"}.`);
    return { latitude: null, longitude: null, matched_address: address, county: lead.county || null, state: lead.state || null, geocoder: "U.S. Census Geocoder" };
  }
}

async function floodFinding(lat: number, lon: number, lead: ResearchLeadPayload, warnings: string[]): Promise<AutomatedFinding> {
  const sourceUrl = "https://hazards.fema.gov/femaportal/resources/flood_map_svc.htm";
  if (lead.flood_zone_percent !== null && lead.flood_zone_percent !== undefined) {
    return {
      category: "flood",
      title: "Check FEMA flood zone",
      status: lead.flood_zone_percent > 25 ? "blocked" : lead.flood_zone_percent > 0 ? "in-progress" : "verified",
      result_summary: `Imported flood value found: ${lead.flood_zone_percent}%.`,
      evidence_value: `${lead.flood_zone_percent}%${lead.flood_zone_type ? ` · ${lead.flood_zone_type}` : ""}`,
      source_name: "Imported Land Insights flood field",
      source_url: sourceUrl,
      confidence: "medium",
      blocker: lead.flood_zone_percent > 25 ? "Large flood impact needs review before offer." : null,
    };
  }

  try {
    const params = new URLSearchParams({
      f: "json",
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,FLOODWAY,STATIC_BFE",
      returnGeometry: "false",
    });
    const json = await fetchJson(`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`) as {
      features?: Array<{ attributes?: Record<string, unknown> }>;
    };
    const attrs = json.features?.[0]?.attributes;
    if (!attrs) {
      return {
        category: "flood",
        title: "Check FEMA flood zone",
        status: "verified",
        result_summary: "No FEMA flood hazard polygon intersected the geocoded point.",
        evidence_value: "No point intersection",
        source_name: "FEMA NFHL",
        source_url: sourceUrl,
        confidence: "medium",
      };
    }
    const zone = clean(attrs.FLD_ZONE) || "Unknown zone";
    const sfha = clean(attrs.SFHA_TF);
    const floodway = clean(attrs.FLOODWAY);
    const blocker = sfha === "T" || zone.startsWith("A") || zone.startsWith("V") || floodway === "Y";
    return {
      category: "flood",
      title: "Check FEMA flood zone",
      status: blocker ? "blocked" : "verified",
      result_summary: blocker ? "FEMA flood hazard appears to touch the property point." : "FEMA flood zone does not appear to be a major SFHA blocker at the property point.",
      evidence_value: [zone, clean(attrs.ZONE_SUBTY), sfha ? `SFHA ${sfha}` : null, floodway ? `Floodway ${floodway}` : null].filter(Boolean).join(" · "),
      source_name: "FEMA NFHL",
      source_url: sourceUrl,
      confidence: "medium",
      blocker: blocker ? "Flood hazard needs map review before offer." : null,
    };
  } catch (error) {
    warnings.push(`FEMA flood lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    return {
      category: "flood",
      title: "Check FEMA flood zone",
      status: "todo",
      result_summary: "Automatic FEMA lookup was unavailable. VA should verify flood manually.",
      evidence_value: null,
      source_name: "FEMA NFHL",
      source_url: sourceUrl,
      confidence: "low",
    };
  }
}

async function wetlandsFinding(lat: number, lon: number, lead: ResearchLeadPayload, warnings: string[]): Promise<AutomatedFinding> {
  const sourceUrl = "https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper";
  if (lead.wetlands_percent !== null && lead.wetlands_percent !== undefined) {
    return {
      category: "wetlands",
      title: "Check wetlands impact",
      status: lead.wetlands_percent > 25 ? "blocked" : lead.wetlands_percent > 0 ? "in-progress" : "verified",
      result_summary: `Imported wetlands value found: ${lead.wetlands_percent}%.`,
      evidence_value: `${lead.wetlands_percent}%`,
      source_name: "Imported Land Insights wetlands field",
      source_url: sourceUrl,
      confidence: "medium",
      blocker: lead.wetlands_percent > 25 ? "Large wetlands impact needs review before offer." : null,
    };
  }

  try {
    const params = new URLSearchParams({
      f: "json",
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "ATTRIBUTE,WETLAND_TYPE,ACRES",
      returnGeometry: "false",
    });
    const json = await fetchJson(`https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?${params}`) as {
      features?: Array<{ attributes?: Record<string, unknown> }>;
    };
    const attrs = json.features?.[0]?.attributes;
    if (!attrs) {
      return {
        category: "wetlands",
        title: "Check wetlands impact",
        status: "verified",
        result_summary: "No NWI wetland polygon intersected the geocoded point.",
        evidence_value: "No point intersection",
        source_name: "USFWS NWI",
        source_url: sourceUrl,
        confidence: "medium",
      };
    }
    return {
      category: "wetlands",
      title: "Check wetlands impact",
      status: "in-progress",
      result_summary: "NWI wetland mapping appears to intersect the geocoded point. VA should verify parcel-level impact.",
      evidence_value: [clean(attrs.ATTRIBUTE), clean(attrs.WETLAND_TYPE), num(attrs.ACRES) ? `${num(attrs.ACRES)} mapped acres` : null].filter(Boolean).join(" · "),
      source_name: "USFWS NWI",
      source_url: sourceUrl,
      confidence: "medium",
      blocker: "Wetlands mapped at point; confirm usable acreage.",
    };
  } catch (error) {
    warnings.push(`Wetlands lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    return {
      category: "wetlands",
      title: "Check wetlands impact",
      status: "todo",
      result_summary: "Automatic wetlands lookup was unavailable. VA should verify wetlands manually.",
      evidence_value: null,
      source_name: "USFWS NWI",
      source_url: sourceUrl,
      confidence: "low",
    };
  }
}

async function elevationFinding(lat: number, lon: number, warnings: string[]): Promise<AutomatedFinding> {
  try {
    const json = await fetchJson(`https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet&wkid=4326`) as {
      value?: number;
      USGS_Elevation_Point_Query_Service?: { Elevation_Query?: { Elevation?: number } };
    };
    const elevation = typeof json.value === "number" ? json.value : json.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation;
    return {
      category: "notes",
      title: "Check elevation/topography risk",
      status: typeof elevation === "number" ? "verified" : "todo",
      result_summary: typeof elevation === "number" ? "USGS returned an elevation for the geocoded point." : "USGS did not return an elevation value.",
      evidence_value: typeof elevation === "number" ? `${Math.round(elevation).toLocaleString()} ft` : null,
      source_name: "USGS Elevation Point Query Service",
      source_url: "https://www.usgs.gov/the-national-map-data-delivery/gis-data-download",
      confidence: typeof elevation === "number" ? "medium" : "low",
    };
  } catch (error) {
    warnings.push(`Elevation lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    return {
      category: "notes",
      title: "Check elevation/topography risk",
      status: "todo",
      result_summary: "Automatic elevation lookup was unavailable.",
      evidence_value: null,
      source_name: "USGS Elevation Point Query Service",
      source_url: "https://www.usgs.gov/the-national-map-data-delivery/gis-data-download",
      confidence: "low",
    };
  }
}

async function accessFinding(lat: number, lon: number, lead: ResearchLeadPayload, warnings: string[]): Promise<AutomatedFinding> {
  if (lead.is_land_locked) {
    return {
      category: "access",
      title: "Confirm road frontage and landlocked risk",
      status: "blocked",
      result_summary: "Imported data marks the property as landlocked.",
      evidence_value: "Landlocked flag",
      source_name: "Imported Land Insights access field",
      source_url: `https://www.google.com/maps/search/${lat},${lon}`,
      confidence: "medium",
      blocker: "Landlocked property should be passed or escalated before deeper research.",
    };
  }
  if (lead.road_frontage_ft && lead.road_frontage_ft > 0) {
    return {
      category: "access",
      title: "Confirm road frontage and landlocked risk",
      status: "in-progress",
      result_summary: "Imported data includes road frontage. Map verification still recommended.",
      evidence_value: `${lead.road_frontage_ft} ft`,
      source_name: "Imported Land Insights access field",
      source_url: `https://www.google.com/maps/search/${lat},${lon}`,
      confidence: "medium",
    };
  }

  try {
    const query = `[out:json][timeout:8];way(around:90,${lat},${lon})["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|track"]["access"!="private"];out tags center 8;`;
    const json = await fetchJson("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    }) as { elements?: Array<{ tags?: Record<string, string> }> };
    const roads = json.elements ?? [];
    const names = roads.map(road => road.tags?.name || road.tags?.highway).filter(Boolean).slice(0, 3);
    return {
      category: "access",
      title: "Confirm road frontage and landlocked risk",
      status: roads.length ? "in-progress" : "todo",
      result_summary: roads.length ? "OpenStreetMap shows road features near the geocoded point. VA should confirm frontage touches the parcel." : "No nearby public road was found in OpenStreetMap within the first-pass radius.",
      evidence_value: roads.length ? `${roads.length} nearby OSM road feature(s): ${names.join(", ")}` : "No road within 90m OSM query",
      source_name: "OpenStreetMap / Overpass",
      source_url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
      confidence: roads.length ? "medium" : "low",
      blocker: roads.length ? null : "Possible access issue; verify county GIS and aerial map.",
    };
  } catch (error) {
    warnings.push(`Road/access lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    return {
      category: "access",
      title: "Confirm road frontage and landlocked risk",
      status: "todo",
      result_summary: "Automatic road lookup was unavailable. VA should verify access manually.",
      evidence_value: null,
      source_name: "OpenStreetMap / Overpass",
      source_url: `https://www.google.com/maps/search/${lat},${lon}`,
      confidence: "low",
    };
  }
}

function parcelConfigFor(county: string | null, state: string | null): CountyParcelConfig | null {
  const c = normalizeKey(county);
  const s = normalizeKey(state || "GA");
  return COUNTY_PARCEL_CONFIGS.find(config => normalizeKey(config.county) === c && normalizeKey(config.state) === s) ?? null;
}

async function queryParcelLayer(config: CountyParcelConfig, params: URLSearchParams): Promise<Record<string, unknown> | null> {
  const rows = await queryParcelLayerRows(config, params);
  return rows[0] ?? null;
}

async function queryParcelLayerRows(config: CountyParcelConfig, params: URLSearchParams): Promise<Array<Record<string, unknown>>> {
  params.set("f", "json");
  params.set("outFields", "*");
  params.set("returnGeometry", "false");
  params.set("resultRecordCount", params.get("resultRecordCount") || "12");
  const json = await fetchJson(`${config.layerUrl}/query?${params}`) as {
    features?: Array<{ attributes?: Record<string, unknown> }>;
  };
  return json.features?.map(feature => feature.attributes).filter((attrs): attrs is Record<string, unknown> => !!attrs) ?? [];
}

function addressMatchStatus(subjectAddress: string | null | undefined, matchedAddress: string | null): boolean | null {
  const subject = normalizeKey(subjectAddress);
  const matched = normalizeKey(matchedAddress);
  if (!subject || !matched) return null;
  const subjectPrefix = subject.slice(0, Math.min(12, subject.length));
  const matchedPrefix = matched.slice(0, Math.min(12, matched.length));
  return matched.includes(subjectPrefix) || subject.includes(matchedPrefix);
}

function addressMatchScore(subjectAddress: string, matchedAddress: string | null): number {
  const subject = normalizeKey(subjectAddress);
  const matched = normalizeKey(matchedAddress);
  if (!subject || !matched) return 0;
  const subjectHouse = subjectAddress.match(/^\s*(\d+)/)?.[1] ?? "";
  const matchedHouse = matchedAddress?.match(/^\s*(\d+)/)?.[1] ?? "";
  let score = 0;
  if (matched === subject) score += 100;
  if (subjectHouse && matchedHouse && subjectHouse === matchedHouse) score += 45;
  if (matched.includes(subject.slice(0, Math.min(18, subject.length)))) score += 35;
  if (matched.includes(subject.replace(/(road|rd|drive|dr|circle|cir|street|st|avenue|ave)/g, ""))) score += 15;
  return score;
}

function addressWhereClauses(config: CountyParcelConfig, address: string, broad = false): string[] {
  const firstLine = address.split(",")[0]?.trim() || address;
  const firstToken = firstLine.split(/\s+/)[0];
  const streetHint = firstLine.replace(/^\s*\d+\s+/, "").trim();
  const clauses = config.addressFields.flatMap(field => [
    `${field} LIKE '%${sqlText(firstLine)}%'`,
    firstToken && streetHint ? `(${field} LIKE '%${sqlText(firstToken)}%' AND ${field} LIKE '%${sqlText(streetHint)}%')` : "",
    broad && streetHint ? `${field} LIKE '%${sqlText(streetHint)}%'` : "",
    broad && firstToken && /^\d+$/.test(firstToken) ? `${field} LIKE '${sqlText(firstToken)} %'` : "",
  ]);
  return clauses.filter(Boolean);
}

async function queryParcelLayerByAddress(config: CountyParcelConfig, address: string): Promise<Record<string, unknown> | null> {
  const exactClauses = addressWhereClauses(config, address, false);
  const subject = normalizeKey(address);
  if (exactClauses.length) {
    const rows = await queryParcelLayerRows(config, new URLSearchParams({ where: exactClauses.join(" OR ") }));
    const best = rows
      .map(attrs => ({ attrs, score: addressMatchScore(address, pickAttr(attrs, config.addressFields) || joinAttrs(attrs, config.addressFields)) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0) return best.attrs;
    if (rows.length === 1) return rows[0];
  }

  const broadClauses = addressWhereClauses(config, address, true);
  if (!broadClauses.length) return null;
  const rows = await queryParcelLayerRows(config, new URLSearchParams({ where: broadClauses.join(" OR ") }));
  return rows.find(attrs => {
    const matchedAddress = pickAttr(attrs, config.addressFields) || joinAttrs(attrs, config.addressFields);
    return addressMatchStatus(subject, matchedAddress) === true;
  }) ?? null;
}

async function countyParcelMatch(
  lead: ResearchLeadPayload,
  county: string | null,
  state: string | null,
  lat: number | null,
  lon: number | null,
  warnings: string[],
): Promise<CountyParcelMatch | null> {
  const config = parcelConfigFor(county || lead.county || null, state || lead.state || "GA");
  if (!config) return null;

  let attrs: Record<string, unknown> | null = null;
  const parcel = clean(lead.parcel_id);
  const address = clean(lead.property_address);

  try {
    if (parcel) {
      const normalizedParcel = normalizeKey(parcel);
      const where = config.parcelFields
        .map(field => `UPPER(REPLACE(REPLACE(${field}, ' ', ''), '-', '')) = '${sqlText(normalizedParcel.toUpperCase())}'`)
        .join(" OR ");
      attrs = await queryParcelLayer(config, new URLSearchParams({ where }));
    }
    if (!attrs && address) {
      attrs = await queryParcelLayerByAddress(config, address);
    }
    if (!attrs && typeof lat === "number" && typeof lon === "number") {
      attrs = await queryParcelLayer(config, new URLSearchParams({
        geometry: `${lon},${lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
      }));
      const matchedAddress = attrs ? pickAttr(attrs, config.addressFields) || joinAttrs(attrs, config.addressFields) : null;
      if (attrs && address && addressMatchStatus(address, matchedAddress) === false) {
        attrs = await queryParcelLayerByAddress(config, address) ?? attrs;
      }
    }
  } catch (error) {
    warnings.push(`${config.sourceName} parcel lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    return null;
  }

  if (!attrs) return null;
  const matchedAddress = pickAttr(attrs, config.addressFields) || joinAttrs(attrs, config.addressFields);
  const subjectAddress = clean(lead.property_address);
  const addressMatchesSubject = addressMatchStatus(subjectAddress, matchedAddress);
  return {
    sourceName: config.sourceName,
    sourceUrl: config.layerUrl,
    parcelId: pickAttr(attrs, config.parcelFields),
    address: matchedAddress,
    owner: joinAttrs(attrs, config.ownerFields),
    acreage: pickNumberAttr(attrs, config.acreageFields),
    zoning: joinAttrs(attrs, config.zoningFields),
    landUse: joinAttrs(attrs, config.landUseFields),
    assessedValue: pickNumberAttr(attrs, config.assessedValueFields),
    propertyTax: pickNumberAttr(attrs, config.taxFields),
    mailingAddress: joinAttrs(attrs, config.mailingFields),
    addressMatchesSubject,
    raw: attrs,
  };
}

function parcelFinding(match: CountyParcelMatch | null, county: string | null, state: string | null): AutomatedFinding | null {
  if (!match) {
    const config = parcelConfigFor(county, state);
    if (!config) return null;
    return {
      category: "gis",
      title: "Open county GIS and confirm parcel identity",
      status: "todo",
      result_summary: "A public county parcel service is configured, but no parcel match was returned from the automatic lookup.",
      evidence_value: null,
      source_name: config.sourceName,
      source_url: config.layerUrl,
      confidence: "low",
    };
  }
  return {
    category: "gis",
    title: "Open county GIS and confirm parcel identity",
    status: "in-progress",
    result_summary: match.addressMatchesSubject === false
      ? "County parcel GIS returned a parcel at the point, but the returned site address does not clearly match the lead address. VA should verify coordinates and parcel boundary."
      : "County parcel GIS returned a matching parcel. VA should verify the parcel boundary and source record before relying on it.",
    evidence_value: [
      match.parcelId ? `Parcel ${match.parcelId}` : null,
      match.address,
      match.acreage ? `${match.acreage} ac` : null,
      match.zoning ? `Zoning ${match.zoning}` : null,
      match.landUse,
    ].filter(Boolean).join(" · "),
    source_name: match.sourceName,
    source_url: match.sourceUrl,
    confidence: match.addressMatchesSubject === false ? "low" : "medium",
  };
}

function parcelImportedFindings(match: CountyParcelMatch | null): AutomatedFinding[] {
  if (!match) return [];
  const findings: AutomatedFinding[] = [];
  if (match.owner || match.mailingAddress) {
    findings.push({
      category: "ownership",
      title: "Confirm seller/owner and mailing address",
      status: "in-progress",
      result_summary: "County parcel GIS returned owner or mailing information.",
      evidence_value: [match.owner, match.mailingAddress].filter(Boolean).join(" · "),
      source_name: match.sourceName,
      source_url: match.sourceUrl,
      confidence: "medium",
    });
  }
  if (match.zoning || match.landUse) {
    findings.push({
      category: "zoning",
      title: "Verify zoning, future land use, and minimum lot size",
      status: "in-progress",
      result_summary: "County parcel GIS returned zoning or land-use information.",
      evidence_value: [match.zoning ? `Zoning ${match.zoning}` : null, match.landUse].filter(Boolean).join(" · "),
      source_name: match.sourceName,
      source_url: match.sourceUrl,
      confidence: "medium",
    });
  }
  if (match.assessedValue || match.propertyTax) {
    findings.push({
      category: "tax",
      title: "Verify assessed value, taxes, and delinquency",
      status: "in-progress",
      result_summary: "County parcel GIS returned value or tax information.",
      evidence_value: [
        match.assessedValue ? `Assessed ${match.assessedValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : null,
        match.propertyTax ? `Tax ${match.propertyTax.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : null,
      ].filter(Boolean).join(" · "),
      source_name: match.sourceName,
      source_url: match.sourceUrl,
      confidence: "medium",
    });
  }
  return findings;
}

async function soilFinding(lat: number, lon: number, warnings: string[]): Promise<AutomatedFinding> {
  try {
    const query = `SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lon} ${lat})')`;
    const json = await fetchJson("https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, format: "JSON" }),
    }) as { Table?: unknown[][] };
    const mukey = Array.isArray(json.Table?.[0]) ? clean(json.Table?.[0]?.[0]) : null;
    return {
      category: "notes",
      title: "Check soil/septic risk",
      status: mukey ? "in-progress" : "todo",
      result_summary: mukey ? "USDA returned a soil map unit key at the geocoded point. Septic/drainage interpretation should be reviewed if rural exit depends on homesite use." : "USDA did not return a soil map unit key for the point.",
      evidence_value: mukey ? `SSURGO mukey ${mukey}` : null,
      source_name: "USDA NRCS Soil Data Access",
      source_url: "https://websoilsurvey.nrcs.usda.gov/",
      confidence: mukey ? "medium" : "low",
    };
  } catch (error) {
    warnings.push(`Soil lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    return {
      category: "notes",
      title: "Check soil/septic risk",
      status: "todo",
      result_summary: "Automatic soil lookup was unavailable.",
      evidence_value: null,
      source_name: "USDA NRCS Soil Data Access",
      source_url: "https://websoilsurvey.nrcs.usda.gov/",
      confidence: "low",
    };
  }
}

function importedFieldFindings(lead: ResearchLeadPayload, county: string | null, state: string | null): AutomatedFinding[] {
  const findings: AutomatedFinding[] = [];
  if (lead.zoning) {
    findings.push({
      category: "zoning",
      title: "Verify zoning, future land use, and minimum lot size",
      status: "in-progress",
      result_summary: "Zoning was imported. VA should confirm against county zoning/future land use.",
      evidence_value: lead.zoning,
      source_name: "Imported source field",
      source_url: searchUrl(`${county || ""} County ${state || "GA"} zoning map ${lead.parcel_id || lead.property_address || ""}`),
      confidence: "medium",
    });
  }
  if (lead.assessed_value || lead.property_tax) {
    findings.push({
      category: "tax",
      title: "Verify assessed value, taxes, and delinquency",
      status: "in-progress",
      result_summary: "Tax/assessed value data was imported. VA should verify against county tax records.",
      evidence_value: [lead.assessed_value ? `Assessed ${lead.assessed_value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : null, lead.property_tax ? `Tax ${lead.property_tax.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : null].filter(Boolean).join(" · "),
      source_name: "Imported source field",
      source_url: searchUrl(`${county || ""} County ${state || "GA"} tax assessor ${lead.parcel_id || lead.property_address || ""}`),
      confidence: "medium",
    });
  }
  if (lead.market_value_estimate_ppa || lead.market_value_estimate_comp_count) {
    findings.push({
      category: "comps",
      title: "Add at least three sold land comps",
      status: (lead.market_value_estimate_comp_count || 0) >= 3 ? "in-progress" : "todo",
      result_summary: "Land Insights value/comp fields were imported. These should seed comp review but not replace verified sold comps.",
      evidence_value: [lead.market_value_estimate_comp_count ? `${lead.market_value_estimate_comp_count} imported comps` : null, lead.market_value_estimate_ppa ? `${Math.round(lead.market_value_estimate_ppa).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/ac` : null].filter(Boolean).join(" · "),
      source_name: "Imported Land Insights value fields",
      source_url: lead.property_url || searchUrl(`${county || ""} County ${state || "GA"} vacant land sales ${lead.parcel_id || lead.property_address || ""}`),
      confidence: "medium",
    });
  }
  if (lead.parcel_id || lead.parcel_link) {
    findings.push({
      category: "gis",
      title: "Open county GIS and confirm parcel identity",
      status: "in-progress",
      result_summary: "Parcel identity data was imported. VA should confirm the parcel in county GIS.",
      evidence_value: lead.parcel_id || lead.parcel_link || null,
      source_name: "Imported parcel field",
      source_url: lead.parcel_link || searchUrl(`${county || ""} County ${state || "GA"} GIS parcel ${lead.parcel_id || lead.property_address || ""}`),
      confidence: "medium",
    });
  }
  return findings;
}

function sourceLinks(lead: ResearchLeadPayload, county: string | null, state: string | null, lat: number | null, lon: number | null): ResearchSourceLink[] {
  const c = countyName(county || lead.county || "");
  const s = state || lead.state || "GA";
  const subject = [lead.parcel_id, lead.property_address, c ? `${c} County` : null, s].filter(Boolean).join(" ");
  const parcelConfig = parcelConfigFor(c, s);
  return [
    { category: "gis", source_name: parcelConfig?.sourceName || "County GIS / parcel viewer", source_url: lead.parcel_link || parcelConfig?.layerUrl || searchUrl(`${c} County ${s} GIS parcel viewer ${subject}`) },
    { category: "tax", source_name: "County tax assessor", source_url: searchUrl(`${c} County ${s} tax assessor property search ${subject}`) },
    { category: "zoning", source_name: "County zoning / planning", source_url: searchUrl(`${c} County ${s} zoning map planning ${subject}`) },
    { category: "comps", source_name: "County sales records", source_url: searchUrl(`${c} County ${s} vacant land sales assessor ${subject}`) },
    { category: "flood", source_name: "FEMA flood map", source_url: "https://msc.fema.gov/portal/search" },
    { category: "wetlands", source_name: "USFWS wetlands mapper", source_url: "https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper" },
    { category: "access", source_name: "OpenStreetMap", source_url: lat && lon ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}` : searchUrl(`${subject} map road access`) },
    { category: "notes", source_name: "USDA Web Soil Survey", source_url: "https://websoilsurvey.nrcs.usda.gov/" },
    { category: "notes", source_name: "EPA Envirofacts", source_url: searchUrl(`EPA Envirofacts ${subject}`) },
  ];
}

export async function POST(req: NextRequest) {
  let body: { lead?: ResearchLeadPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid research request JSON." }, { status: 400 });
  }
  const lead = body.lead;
  if (!lead) return NextResponse.json({ error: "Missing property lead." }, { status: 400 });

  const warnings: string[] = [];
  const checkedAt = new Date().toISOString();
  const location = await geocode(lead, warnings);
  const lat = location.latitude;
  const lon = location.longitude;
  const county = countyName(location.county || lead.county || "");
  const state = location.state || lead.state || "GA";

  const findings: AutomatedFinding[] = [
    ...importedFieldFindings(lead, county, state),
  ];
  const parcelMatch = await countyParcelMatch(lead, county, state, lat, lon, warnings);
  const parcelIdentity = parcelFinding(parcelMatch, county, state);
  if (parcelIdentity) findings.push(parcelIdentity);
  findings.push(...parcelImportedFindings(parcelMatch));

  if (typeof lat === "number" && typeof lon === "number") {
    const [flood, wetlands, elevation, access, soil] = await Promise.all([
      floodFinding(lat, lon, lead, warnings),
      wetlandsFinding(lat, lon, lead, warnings),
      elevationFinding(lat, lon, warnings),
      accessFinding(lat, lon, lead, warnings),
      soilFinding(lat, lon, warnings),
    ]);
    findings.push(flood, wetlands, elevation, access, soil);
  } else {
    findings.push({
      category: "notes",
      title: "Geocode property",
      status: "todo",
      result_summary: "Automatic research needs coordinates. Add a better address or coordinates.",
      evidence_value: null,
      source_name: "U.S. Census Geocoder",
      source_url: "https://geocoding.geo.census.gov/geocoder/",
      confidence: "low",
    });
  }

  const response: ResearchResponse = {
    ok: true,
    location: {
      latitude: lat,
      longitude: lon,
      matched_address: location.matched_address,
      county: location.county || county || null,
      state,
      geocoder: location.geocoder,
    },
    parcel_match: parcelMatch,
    findings,
    source_links: sourceLinks(lead, county, state, lat, lon),
    warnings,
    checked_at: checkedAt,
  };
  return NextResponse.json(response);
}
