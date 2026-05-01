// Action items — task tracker backed by Supabase action_items table.

import { supabase } from "./supabase";

export type ActionItemStatus = "open" | "in-progress" | "done";

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  completed_at: string | null;
  deleted_at: string | null;
}

export const ALL_MEMBERS_LABEL = "All Members";

export async function fetchActionItems(): Promise<ActionItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("action_items")
    .select("*")
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as ActionItem[];
}

export async function createActionItem(
  patch: { title: string; description?: string | null; assigned_to?: string | null; due_date?: string | null },
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
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("action_items")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
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
