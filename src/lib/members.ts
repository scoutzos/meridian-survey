import { MEMBERS } from "@/data/questions";
import { supabase } from "./supabase";
import { activeTrackerMembers, type MemberProfile } from "./tracker";

export function activeMemberNamesFromProfiles(profiles: MemberProfile[]): string[] {
  return activeTrackerMembers(profiles).map(member => member.name);
}

export async function fetchActiveMemberNames(): Promise<string[]> {
  if (!supabase) return [...MEMBERS];
  const { data, error } = await supabase.from("tracker_member_profiles").select("*").order("member_name");
  if (error || !data) return [...MEMBERS];
  return activeTrackerMembers((data as MemberProfile[] | null) ?? []).map(member => member.name);
}
