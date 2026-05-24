import { MEMBERS } from "@/data/questions";
import { supabase } from "./supabase";
import { activeTrackerMembers, type MemberProfile } from "./tracker";

export function activeMemberNamesFromProfiles(profiles: MemberProfile[]): string[] {
  return activeTrackerMembers(profiles).map(member => member.name);
}

export async function fetchActiveMemberNames(): Promise<string[]> {
  if (!supabase) return [...MEMBERS];
  const { data, error } = await supabase.from("meridian_members").select("name").order("name");
  if (error || !data) return [...MEMBERS];
  const active = new Set<string>(MEMBERS);
  return Array.from(new Set([...(data as Array<{ name: string }>).map(row => row.name).filter(name => active.has(name)), ...MEMBERS]));
}
