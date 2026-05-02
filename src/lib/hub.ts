import { supabase } from "./supabase";

export interface Announcement { id: string; author: string | null; text: string; date: string; }
export interface Decision { id: string; author: string | null; description: string; date: string; present: string[]; outcome: string; }
export interface HubDocument { id: string; author: string | null; filename: string; category: string; date: string; data: string; mimeType: string | null; }
export interface SharedLink { id: string; author: string | null; url: string; title: string; category: string; date: string; }
export interface MemberProfile { name: string; role: string; contact: string; lastActive: string; }

const KEYS = {
  announcements: "meridian_shared_announcements",
  decisions: "meridian_shared_decisions",
  documents: "meridian_shared_documents",
  links: "meridian_shared_links",
  profiles: "meridian_shared_profiles",
};

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, data: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(data));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function fetchHubData(): Promise<{
  announcements: Announcement[];
  decisions: Decision[];
  documents: HubDocument[];
  links: SharedLink[];
  profiles: Record<string, MemberProfile>;
}> {
  if (!supabase) {
    return {
      announcements: localGet<Announcement[]>(KEYS.announcements, []),
      decisions: localGet<Decision[]>(KEYS.decisions, []),
      documents: localGet<HubDocument[]>(KEYS.documents, []),
      links: localGet<SharedLink[]>(KEYS.links, []),
      profiles: localGet<Record<string, MemberProfile>>(KEYS.profiles, {}),
    };
  }

  const [announcements, decisions, documents, links, profiles] = await Promise.all([
    supabase.from("meridian_hub_announcements").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("meridian_hub_decisions").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("meridian_hub_documents").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("meridian_hub_links").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("meridian_hub_profiles").select("*"),
  ]);

  return {
    announcements: (announcements.data ?? []).map(row => ({ id: row.id, author: row.author, text: row.body, date: row.created_at })),
    decisions: (decisions.data ?? []).map(row => ({
      id: row.id,
      author: row.author,
      description: row.description,
      outcome: row.outcome ?? "",
      present: Array.isArray(row.present) ? row.present as string[] : [],
      date: row.created_at,
    })),
    documents: (documents.data ?? []).map(row => ({
      id: row.id,
      author: row.author,
      filename: row.filename,
      category: row.category,
      data: row.data,
      mimeType: row.mime_type,
      date: row.created_at,
    })),
    links: (links.data ?? []).map(row => ({
      id: row.id,
      author: row.author,
      url: row.url,
      title: row.title,
      category: row.category,
      date: row.created_at,
    })),
    profiles: Object.fromEntries((profiles.data ?? []).map(row => [row.member_name, {
      name: row.member_name,
      role: row.role ?? "",
      contact: row.contact ?? "",
      lastActive: row.last_active ?? "",
    }])),
  };
}

export async function saveAnnouncement(author: string, text: string): Promise<{ data: Announcement | null; error: string | null }> {
  if (!supabase) {
    const item = { id: genId(), author, text, date: new Date().toISOString() };
    localSet(KEYS.announcements, [item, ...localGet<Announcement[]>(KEYS.announcements, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_hub_announcements").insert({ author, body: text }).select().single();
  return { data: data ? { id: data.id, author: data.author, text: data.body, date: data.created_at } : null, error: error?.message ?? null };
}

export async function saveDecision(author: string, decision: Omit<Decision, "id" | "author" | "date">): Promise<{ data: Decision | null; error: string | null }> {
  if (!supabase) {
    const item = { id: genId(), author, date: new Date().toISOString(), ...decision };
    localSet(KEYS.decisions, [item, ...localGet<Decision[]>(KEYS.decisions, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_hub_decisions").insert({
    author,
    description: decision.description,
    outcome: decision.outcome || null,
    present: decision.present,
  }).select().single();
  return {
    data: data ? { id: data.id, author: data.author, description: data.description, outcome: data.outcome ?? "", present: data.present ?? [], date: data.created_at } : null,
    error: error?.message ?? null,
  };
}

export async function saveSharedLink(author: string, link: Omit<SharedLink, "id" | "author" | "date">): Promise<{ data: SharedLink | null; error: string | null }> {
  if (!supabase) {
    const item = { id: genId(), author, date: new Date().toISOString(), ...link };
    localSet(KEYS.links, [item, ...localGet<SharedLink[]>(KEYS.links, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_hub_links").insert({ author, ...link }).select().single();
  return { data: data ? { id: data.id, author: data.author, url: data.url, title: data.title, category: data.category, date: data.created_at } : null, error: error?.message ?? null };
}

export async function saveHubDocument(author: string, doc: Omit<HubDocument, "id" | "author" | "date">): Promise<{ data: HubDocument | null; error: string | null }> {
  if (!supabase) {
    const item = { id: genId(), author, date: new Date().toISOString(), ...doc };
    localSet(KEYS.documents, [item, ...localGet<HubDocument[]>(KEYS.documents, [])]);
    return { data: item, error: null };
  }
  const { data, error } = await supabase.from("meridian_hub_documents").insert({
    author,
    filename: doc.filename,
    category: doc.category,
    data: doc.data,
    mime_type: doc.mimeType,
  }).select().single();
  return { data: data ? { id: data.id, author: data.author, filename: data.filename, category: data.category, data: data.data, mimeType: data.mime_type, date: data.created_at } : null, error: error?.message ?? null };
}

export async function upsertHubProfile(profile: MemberProfile): Promise<{ data: MemberProfile | null; error: string | null }> {
  if (!supabase) {
    const profiles = localGet<Record<string, MemberProfile>>(KEYS.profiles, {});
    const next = { ...profiles, [profile.name]: profile };
    localSet(KEYS.profiles, next);
    return { data: profile, error: null };
  }
  const { data, error } = await supabase.from("meridian_hub_profiles").upsert({
    member_name: profile.name,
    role: profile.role,
    contact: profile.contact,
    last_active: profile.lastActive || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "member_name" }).select().single();
  return {
    data: data ? { name: data.member_name, role: data.role ?? "", contact: data.contact ?? "", lastActive: data.last_active ?? "" } : null,
    error: error?.message ?? null,
  };
}
