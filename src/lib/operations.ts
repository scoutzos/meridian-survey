import { supabase } from "./supabase";

export type RiskLevel = "low" | "medium" | "high";
export type RiskStatus = "open" | "monitoring" | "mitigated" | "closed";
export type NotificationPriority = "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  notification_type: string;
  priority: NotificationPriority;
  assigned_to: string | null;
  href: string | null;
  source_table: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ProjectRisk {
  id: string;
  project_id: string | null;
  deal_id: string | null;
  title: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  mitigation: string | null;
  owner: string | null;
  status: RiskStatus;
  next_review_date: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  company: string | null;
  role: string;
  phone: string | null;
  email: string | null;
  reliability: string | null;
  pricing_notes: string | null;
  general_notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface ProjectDocument {
  id: string;
  project_id: string | null;
  deal_id: string | null;
  title: string;
  category: string;
  url: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const LOCAL_NOTIFICATIONS = "meridian_notifications_local";
const LOCAL_RISKS = "meridian_project_risks_local";
const LOCAL_VENDORS = "meridian_vendors_local";
const LOCAL_DOCUMENTS = "meridian_project_documents_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

export async function fetchNotifications(memberName: string): Promise<Notification[]> {
  if (!supabase) {
    return localGet<Notification[]>(LOCAL_NOTIFICATIONS, [])
      .filter(n => !n.read_at && (!n.assigned_to || n.assigned_to === memberName))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await supabase
    .from("meridian_notifications")
    .select("*")
    .is("read_at", null)
    .or(`assigned_to.is.null,assigned_to.eq.${memberName}`)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Notification[];
}

export async function createNotification(
  patch: { title: string; body?: string | null; priority?: NotificationPriority; assigned_to?: string | null; href?: string | null; source_table?: string | null; source_id?: string | null; notification_type?: string },
  actor: string,
): Promise<{ error: string | null }> {
  const row = {
    title: patch.title.trim(),
    body: patch.body?.trim() || null,
    priority: patch.priority ?? "normal",
    assigned_to: patch.assigned_to || null,
    href: patch.href || null,
    source_table: patch.source_table || null,
    source_id: patch.source_id || null,
    notification_type: patch.notification_type ?? "info",
    created_by: actor,
  };
  if (!supabase) {
    const now = new Date().toISOString();
    localSet(LOCAL_NOTIFICATIONS, [{ ...row, id: `notice-${Date.now()}`, read_at: null, created_at: now }, ...localGet<Notification[]>(LOCAL_NOTIFICATIONS, [])]);
    return { error: null };
  }
  const { error } = await supabase.from("meridian_notifications").insert(row);
  return { error: error?.message ?? null };
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  if (!supabase) {
    const rows = localGet<Notification[]>(LOCAL_NOTIFICATIONS, []);
    localSet(LOCAL_NOTIFICATIONS, rows.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    return { error: null };
  }
  const { error } = await supabase.from("meridian_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function fetchProjectRisks(projectId: string): Promise<ProjectRisk[]> {
  if (!supabase) return localGet<ProjectRisk[]>(LOCAL_RISKS, []).filter(r => r.project_id === projectId && !r.deleted_at);
  const { data, error } = await supabase
    .from("meridian_project_risks")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as ProjectRisk[];
}

export async function createProjectRisk(
  patch: { project_id: string; title: string; likelihood: RiskLevel; impact: RiskLevel; mitigation?: string | null; owner?: string | null; next_review_date?: string | null },
  actor: string,
): Promise<{ data: ProjectRisk | null; error: string | null }> {
  const row = { ...patch, mitigation: patch.mitigation?.trim() || null, owner: patch.owner?.trim() || null, next_review_date: patch.next_review_date || null, created_by: actor, updated_by: actor };
  if (!supabase) {
    const now = new Date().toISOString();
    const risk: ProjectRisk = { ...row, id: `risk-${Date.now()}`, deal_id: null, status: "open", created_at: now, updated_at: now, deleted_at: null };
    localSet(LOCAL_RISKS, [risk, ...localGet<ProjectRisk[]>(LOCAL_RISKS, [])]);
    return { data: risk, error: null };
  }
  const { data, error } = await supabase.from("meridian_project_risks").insert(row).select().single();
  return { data: (data as ProjectRisk) ?? null, error: error?.message ?? null };
}

export async function updateProjectRiskStatus(id: string, status: RiskStatus, actor: string): Promise<{ error: string | null }> {
  if (!supabase) {
    const rows = localGet<ProjectRisk[]>(LOCAL_RISKS, []);
    localSet(LOCAL_RISKS, rows.map(r => r.id === id ? { ...r, status, updated_at: new Date().toISOString(), updated_by: actor } : r));
    return { error: null };
  }
  const { error } = await supabase.from("meridian_project_risks").update({ status, updated_at: new Date().toISOString(), updated_by: actor }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function fetchVendors(): Promise<Vendor[]> {
  if (!supabase) return localGet<Vendor[]>(LOCAL_VENDORS, []).filter(v => !v.deleted_at);
  const { data, error } = await supabase.from("meridian_vendors").select("*").is("deleted_at", null).order("name");
  if (error || !data) return [];
  return data as Vendor[];
}

export async function createVendor(
  patch: { name: string; company?: string | null; role: string; phone?: string | null; email?: string | null; reliability?: string | null; pricing_notes?: string | null; general_notes?: string | null },
  actor: string,
): Promise<{ data: Vendor | null; error: string | null }> {
  const row = {
    name: patch.name.trim(),
    company: patch.company?.trim() || null,
    role: patch.role.trim() || "Contractor",
    phone: patch.phone?.trim() || null,
    email: patch.email?.trim() || null,
    reliability: patch.reliability?.trim() || null,
    pricing_notes: patch.pricing_notes?.trim() || null,
    general_notes: patch.general_notes?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  if (!supabase) {
    const now = new Date().toISOString();
    const vendor: Vendor = { ...row, id: `vendor-${Date.now()}`, created_at: now, updated_at: now, deleted_at: null };
    localSet(LOCAL_VENDORS, [vendor, ...localGet<Vendor[]>(LOCAL_VENDORS, [])]);
    return { data: vendor, error: null };
  }
  const { data, error } = await supabase.from("meridian_vendors").insert(row).select().single();
  return { data: (data as Vendor) ?? null, error: error?.message ?? null };
}

export async function fetchProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  if (!supabase) return localGet<ProjectDocument[]>(LOCAL_DOCUMENTS, []).filter(d => d.project_id === projectId && !d.deleted_at);
  const { data, error } = await supabase.from("meridian_project_documents").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as ProjectDocument[];
}

export async function createProjectDocument(
  patch: { project_id: string; title: string; category: string; url?: string | null; notes?: string | null },
  actor: string,
): Promise<{ data: ProjectDocument | null; error: string | null }> {
  const row = {
    project_id: patch.project_id,
    title: patch.title.trim(),
    category: patch.category.trim() || "Other",
    url: patch.url?.trim() || null,
    notes: patch.notes?.trim() || null,
    uploaded_by: actor,
  };
  if (!supabase) {
    const now = new Date().toISOString();
    const doc: ProjectDocument = { ...row, id: `doc-${Date.now()}`, deal_id: null, created_at: now, updated_at: now, deleted_at: null };
    localSet(LOCAL_DOCUMENTS, [doc, ...localGet<ProjectDocument[]>(LOCAL_DOCUMENTS, [])]);
    return { data: doc, error: null };
  }
  const { data, error } = await supabase.from("meridian_project_documents").insert(row).select().single();
  return { data: (data as ProjectDocument) ?? null, error: error?.message ?? null };
}

