// Action items — task tracker backed by Supabase action_items table.

import { supabase } from "./supabase";

export type ActionItemStatus = "open" | "in-progress" | "blocked" | "done";
export type ActionItemTaskType = "general" | "va-work" | "meeting-follow-up" | "deal-follow-up" | "project-task" | "document-review" | "money-approval";

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
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

export const ALL_MEMBERS_LABEL = "All Members";
export const VA_ASSIGNEE_LABEL = "Sophie / VA";

const HIDDEN_ACTION_ITEM_TITLES = new Set([
  "Complete Branding Survey",
]);

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
  return (data as ActionItem[]).filter(isVisibleActionItem);
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
  return { data: (data as ActionItem) ?? null, error: error?.message ?? null };
}

export async function updateActionItemStatus(
  id: string,
  status: ActionItemStatus,
  actor: string,
  note = "",
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
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
  return { error: error?.message ?? null };
}

export async function deleteActionItem(id: string, actor: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("action_items")
    .update({ deleted_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
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
