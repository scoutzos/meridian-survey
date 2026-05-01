import { supabase } from "./supabase";
import type { Deal } from "./deals";

export type ProjectStatus = "planning" | "due-diligence" | "under-contract" | "closed" | "active" | "stabilized" | "sold" | "paused" | "passed";

export interface Project {
  id: string;
  deal_id: string | null;
  name: string;
  property_type: string;
  strategy: string;
  status: ProjectStatus;
  address: string | null;
  parcel_id: string | null;
  acquisition_price: number | null;
  target_exit_value: number | null;
  repair_budget: number | null;
  site_budget: number | null;
  budget_total: number | null;
  actual_spend: number;
  contingency: number | null;
  next_step: string | null;
  risk_summary: string | null;
  notes: string | null;
  source_snapshot: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface ProjectTimelineEvent {
  id: string;
  project_id: string;
  event_date: string | null;
  title: string;
  detail: string | null;
  event_type: string;
  created_at: string;
  created_by: string | null;
}

const LOCAL_PROJECTS = "meridian_projects_local";
const LOCAL_EVENTS = "meridian_project_events_local";

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function toProject(row: Record<string, unknown>): Project {
  return {
    ...(row as unknown as Project),
    source_snapshot: row.source_snapshot && typeof row.source_snapshot === "object" ? row.source_snapshot as Record<string, unknown> : {},
    actual_spend: Number(row.actual_spend ?? 0),
  };
}

export async function fetchProjects(): Promise<Project[]> {
  if (!supabase) return localGet<Project[]>(LOCAL_PROJECTS, []);
  const { data, error } = await supabase
    .from("meridian_projects")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(toProject);
}

export async function fetchProjectTimeline(projectId: string): Promise<ProjectTimelineEvent[]> {
  if (!supabase) return localGet<ProjectTimelineEvent[]>(LOCAL_EVENTS, []).filter(e => e.project_id === projectId);
  const { data, error } = await supabase
    .from("meridian_project_timeline_events")
    .select("*")
    .eq("project_id", projectId)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as ProjectTimelineEvent[];
}

export async function createProjectFromDeal(deal: Deal, actor: string): Promise<{ data: Project | null; error: string | null }> {
  const existing = (await fetchProjects()).find(p => p.deal_id === deal.id);
  if (existing) return { data: existing, error: null };

  const budget = (deal.repair_estimate ?? 0) || null;
  const row = {
    deal_id: deal.id.startsWith("local-") ? null : deal.id,
    name: deal.title,
    property_type: deal.property_type,
    strategy: deal.strategy,
    status: "due-diligence" as ProjectStatus,
    address: deal.address ?? null,
    parcel_id: deal.parcel_id ?? null,
    acquisition_price: deal.asking_price ?? null,
    target_exit_value: deal.arv ?? null,
    repair_budget: deal.property_type === "land" ? null : budget,
    site_budget: deal.property_type === "land" ? budget : null,
    budget_total: budget,
    actual_spend: 0,
    contingency: null,
    next_step: "Complete due diligence and confirm offer strategy.",
    risk_summary: deal.analysis?.riskFlags?.join("\n") || null,
    notes: deal.notes ?? null,
    source_snapshot: deal as unknown as Record<string, unknown>,
    created_by: actor,
    updated_by: actor,
  };

  if (!supabase) {
    const now = new Date().toISOString();
    const project: Project = {
      ...row,
      id: `project-${Date.now()}`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    localSet(LOCAL_PROJECTS, [project, ...localGet<Project[]>(LOCAL_PROJECTS, [])]);
    const event: ProjectTimelineEvent = {
      id: `event-${Date.now()}`,
      project_id: project.id,
      event_date: now.slice(0, 10),
      title: "Converted from Deal Desk",
      detail: `Source recommendation: ${deal.analysis?.recommendation ?? "Needs Review"}`,
      event_type: "conversion",
      created_at: now,
      created_by: actor,
    };
    localSet(LOCAL_EVENTS, [event, ...localGet<ProjectTimelineEvent[]>(LOCAL_EVENTS, [])]);
    return { data: project, error: null };
  }

  const { data, error } = await supabase.from("meridian_projects").insert(row).select().single();
  if (error || !data) return { data: null, error: error?.message ?? "Project create failed" };
  const project = toProject(data as Record<string, unknown>);
  await supabase.from("meridian_project_timeline_events").insert({
    project_id: project.id,
    event_date: new Date().toISOString().slice(0, 10),
    title: "Converted from Deal Desk",
    detail: `Source recommendation: ${deal.analysis?.recommendation ?? "Needs Review"}`,
    event_type: "conversion",
    created_by: actor,
  });
  await supabase.from("meridian_deals").update({
    status: "active-project",
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }).eq("id", deal.id);
  return { data: project, error: null };
}

