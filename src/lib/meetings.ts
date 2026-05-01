// Meetings — upcoming + past meeting records backed by Supabase.

import { supabase } from "./supabase";

export interface MeetingNote {
  id: string;
  meeting_date: string;
  agenda: string | null;
  notes: string | null;
  attendees: string[];
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface NextMeeting {
  key: "next";
  meeting_date: string | null;
  meeting_time: string | null;
  agenda: string | null;
  updated_at: string;
  updated_by: string | null;
}

export async function fetchNextMeeting(): Promise<NextMeeting | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("next_meeting")
    .select("*")
    .eq("key", "next")
    .maybeSingle();
  if (error || !data) return null;
  return data as NextMeeting;
}

export async function updateNextMeeting(
  patch: { meeting_date?: string | null; meeting_time?: string | null; agenda?: string | null },
  actor: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("next_meeting")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: actor })
    .eq("key", "next");
  return { error: error?.message ?? null };
}

export async function fetchMeetingNotes(): Promise<MeetingNote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("meeting_notes")
    .select("*")
    .is("deleted_at", null)
    .order("meeting_date", { ascending: false });
  if (error || !data) return [];
  return (data as MeetingNote[]).map(r => ({ ...r, attendees: Array.isArray(r.attendees) ? r.attendees : [] }));
}

export async function createMeetingNote(
  patch: { meeting_date: string; agenda?: string | null; notes?: string | null; attendees?: string[] },
  actor: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.from("meeting_notes").insert({
    meeting_date: patch.meeting_date,
    agenda: patch.agenda?.trim() || null,
    notes: patch.notes?.trim() || null,
    attendees: patch.attendees ?? [],
    created_by: actor,
    updated_by: actor,
  });
  return { error: error?.message ?? null };
}

export async function deleteMeetingNote(id: string, actor: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("meeting_notes")
    .update({ deleted_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  return { error: error?.message ?? null };
}
