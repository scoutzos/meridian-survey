// Action items — task tracker backed by Supabase action_items table.

import { supabase } from "./supabase";

export type ActionItemStatus = "open" | "in-progress" | "blocked" | "done";
export type ActionItemTaskType = "general" | "va-work" | "meeting-follow-up" | "deal-follow-up" | "project-task" | "document-review" | "money-approval";
export type ActionItemEventType = "created" | "status-changed" | "completed" | "blocked" | "reopened" | "deleted" | "comment" | "reassigned" | "checklist-updated";

export interface ActionItemChecklistItem {
  id: string;
  text: string;
  done: boolean;
  completed_by: string | null;
  completed_at: string | null;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  deadline_at: string | null;
  expected_outcome: string | null;
  checklist_items: ActionItemChecklistItem[];
  status: ActionItemStatus;
  task_type: ActionItemTaskType | null;
  priority: "low" | "normal" | "high" | "urgent" | null;
  source_table: string | null;
  source_id: string | null;
  completion_note: string | null;
  blocker_reason: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface ActionItemEvent {
  id: string;
  action_item_id: string;
  event_type: ActionItemEventType;
  previous_status: ActionItemStatus | null;
  next_status: ActionItemStatus | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export const ALL_MEMBERS_LABEL = "All Members";
export const VA_ASSIGNEE_LABEL = "Sophie / VA";

const HIDDEN_ACTION_ITEM_TITLES = new Set([
  "Complete Branding Survey",
]);

function normalizeChecklist(value: unknown): ActionItemChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): ActionItemChecklistItem | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const text = String(row.text ?? "").trim();
      if (!text) return null;
      return {
        id: String(row.id ?? `item-${index + 1}`),
        text,
        done: row.done === true,
        completed_by: typeof row.completed_by === "string" ? row.completed_by : null,
        completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
      };
    })
    .filter((item): item is ActionItemChecklistItem => Boolean(item));
}

function normalizeActionItem(row: unknown): ActionItem {
  const item = row as ActionItem;
  return {
    ...item,
    deadline_at: item.deadline_at ?? null,
    expected_outcome: item.expected_outcome ?? null,
    checklist_items: normalizeChecklist(item.checklist_items),
  };
}

function isVisibleActionItem(item: ActionItem): boolean {
  return !HIDDEN_ACTION_ITEM_TITLES.has(item.title);
}

export async function fetchActionItems(): Promise<ActionItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("action_items")
    .select("*")
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(normalizeActionItem).filter(isVisibleActionItem);
}

export async function fetchActionItemEvents(actionItemIds: string[]): Promise<ActionItemEvent[]> {
  if (!supabase || actionItemIds.length === 0) return [];
  const { data, error } = await supabase
    .from("action_item_events")
    .select("*")
    .in("action_item_id", actionItemIds)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as ActionItemEvent[];
}

function eventTypeForStatus(status: ActionItemStatus): ActionItemEventType {
  if (status === "done") return "completed";
  if (status === "blocked") return "blocked";
  if (status === "open") return "reopened";
  return "status-changed";
}

async function recordActionItemEvent(
  actionItemId: string,
  eventType: ActionItemEventType,
  actor: string,
  options: { previous_status?: ActionItemStatus | null; next_status?: ActionItemStatus | null; note?: string | null } = {},
): Promise<void> {
  if (!supabase) return;
  await supabase.from("action_item_events").insert({
    action_item_id: actionItemId,
    event_type: eventType,
    previous_status: options.previous_status || null,
    next_status: options.next_status || null,
    note: options.note?.trim() || null,
    created_by: actor,
  });
}

export async function createActionItem(
  patch: {
    title: string;
    description?: string | null;
    assigned_to?: string | null;
    due_date?: string | null;
    task_type?: ActionItemTaskType | null;
    priority?: ActionItem["priority"];
    source_table?: string | null;
    source_id?: string | null;
    deadline_at?: string | null;
    expected_outcome?: string | null;
    checklist_items?: ActionItemChecklistItem[];
  },
  actor: string,
): Promise<{ data: ActionItem | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("action_items")
    .insert({
      title: patch.title.trim(),
      description: patch.description?.trim() || null,
      assigned_to: patch.assigned_to || null,
      due_date: patch.due_date || null,
      deadline_at: patch.deadline_at || null,
      expected_outcome: patch.expected_outcome?.trim() || null,
      checklist_items: patch.checklist_items || [],
      task_type: patch.task_type || (patch.assigned_to === VA_ASSIGNEE_LABEL ? "va-work" : "general"),
      priority: patch.priority || "normal",
      source_table: patch.source_table || null,
      source_id: patch.source_id || null,
      status: "open",
      created_by: actor,
      updated_by: actor,
    })
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? null };
  const item = normalizeActionItem(data);
  await recordActionItemEvent(item.id, "created", actor, { next_status: "open" });
  return { data: item, error: null };
}

export async function updateActionItemStatus(
  id: string,
  status: ActionItemStatus,
  actor: string,
  note = "",
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { data: existing } = await supabase
    .from("action_items")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const previousStatus = (existing?.status as ActionItemStatus | undefined) ?? null;
  const { error } = await supabase
    .from("action_items")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      completed_by: status === "done" ? actor : null,
      completion_note: status === "done" ? note.trim() || null : null,
      blocker_reason: status === "blocked" ? note.trim() || null : null,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })
    .eq("id", id);
  if (!error) {
    await recordActionItemEvent(id, eventTypeForStatus(status), actor, {
      previous_status: previousStatus,
      next_status: status,
      note,
    });
  }
  return { error: error?.message ?? null };
}

export async function resolveActionItemsForSource(
  sourceTable: string,
  sourceId: string,
  actor: string,
  note: string,
): Promise<{ count: number; error: string | null }> {
  if (!supabase) return { count: 0, error: "Supabase not configured" };
  const { data: existing, error: fetchError } = await supabase
    .from("action_items")
    .select("id, status")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .is("deleted_at", null)
    .neq("status", "done");
  if (fetchError || !existing) return { count: 0, error: fetchError?.message ?? "Could not fetch action items." };

  const items = existing as Array<{ id: string; status: ActionItemStatus }>;
  if (items.length === 0) return { count: 0, error: null };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("action_items")
    .update({
      status: "done",
      completed_at: now,
      completed_by: actor,
      completion_note: note.trim() || null,
      updated_at: now,
      updated_by: actor,
    })
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .is("deleted_at", null)
    .neq("status", "done");
  if (error) return { count: 0, error: error.message };

  await Promise.all(items.map(item => recordActionItemEvent(item.id, "completed", actor, {
    previous_status: item.status,
    next_status: "done",
    note,
  })));
  return { count: items.length, error: null };
}

export async function addActionItemComment(id: string, actor: string, note: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const trimmed = note.trim();
  if (!trimmed) return { error: "Comment is required" };
  await recordActionItemEvent(id, "comment", actor, { note: trimmed });
  const { error } = await supabase
    .from("action_items")
    .update({ updated_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function reassignActionItem(id: string, actor: string, assignedTo: string): Promise<{ data: ActionItem | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const assignee = assignedTo.trim();
  if (!assignee) return { data: null, error: "Assignee is required" };
  const { data: existing } = await supabase
    .from("action_items")
    .select("assigned_to")
    .eq("id", id)
    .maybeSingle();
  const previousAssignee = existing?.assigned_to as string | null | undefined;
  const { data, error } = await supabase
    .from("action_items")
    .update({
      assigned_to: assignee,
      task_type: assignee === VA_ASSIGNEE_LABEL ? "va-work" : "general",
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? null };
  await recordActionItemEvent(id, "reassigned", actor, {
    note: `Reassigned from ${previousAssignee || "Unassigned"} to ${assignee}.`,
  });
  return { data: normalizeActionItem(data), error: null };
}

export async function updateActionItemChecklist(
  id: string,
  checklistItems: ActionItemChecklistItem[],
  actor: string,
  note: string,
): Promise<{ data: ActionItem | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("action_items")
    .update({
      checklist_items: checklistItems,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? null };
  await recordActionItemEvent(id, "checklist-updated", actor, { note });
  return { data: normalizeActionItem(data), error: null };
}

export async function deleteActionItem(id: string, actor: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("action_items")
    .update({ deleted_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  if (!error) await recordActionItemEvent(id, "deleted", actor);
  return { error: error?.message ?? null };
}

/** True if this item is "yours" — assigned to you specifically or to all members. */
export function isOwnedBy(item: ActionItem, member: string): boolean {
  if (!item.assigned_to) return false;
  if (item.assigned_to === ALL_MEMBERS_LABEL) return true;
  return item.assigned_to === member;
}

export function isVaTask(item: ActionItem): boolean {
  return item.assigned_to === VA_ASSIGNEE_LABEL || item.task_type === "va-work";
}
