import { MEMBERS } from "@/data/questions";
import { supabase } from "./supabase";

export type MeridianRole = "member" | "va";
export const MERIDIAN_USER_KEY = "meridian_user";

export const VA_USERS = ["Sophie / VA"] as const;

export const LOGIN_USERS = [...MEMBERS, ...VA_USERS] as const;

export function getUserRole(name: string | null): MeridianRole {
  if (name && (VA_USERS as readonly string[]).includes(name)) return "va";
  return "member";
}

export function isVaUser(name: string | null): boolean {
  return getUserRole(name) === "va";
}

export function setCurrentMeridianUser(name: string): void {
  if (typeof window !== "undefined") localStorage.setItem(MERIDIAN_USER_KEY, name);
}

export function getCurrentMeridianUser(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(MERIDIAN_USER_KEY);
}

export async function signOutMeridianUser(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
  if (typeof window !== "undefined") localStorage.removeItem(MERIDIAN_USER_KEY);
}

export async function hydrateMeridianUserFromAuth(): Promise<string | null> {
  const current = getCurrentMeridianUser();
  if (current || !supabase) return current;

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return null;

  const metadataName = typeof authUser.user_metadata?.member_name === "string"
    ? authUser.user_metadata.member_name
    : null;

  if (metadataName) {
    setCurrentMeridianUser(metadataName);
    await supabase
      .from("meridian_members")
      .update({ auth_user_id: authUser.id, auth_provider: "supabase-auth", auth_migrated_at: new Date().toISOString(), last_login: new Date().toISOString() })
      .eq("name", metadataName);
    return metadataName;
  }

  if (!authUser.email) return null;
  const { data } = await supabase
    .from("meridian_members")
    .select("name")
    .eq("auth_email", authUser.email)
    .maybeSingle();

  const memberName = data?.name as string | undefined;
  if (!memberName) return null;
  setCurrentMeridianUser(memberName);
  await supabase
    .from("meridian_members")
    .update({ auth_user_id: authUser.id, auth_provider: "supabase-auth", auth_migrated_at: new Date().toISOString(), last_login: new Date().toISOString() })
    .eq("name", memberName);
  return memberName;
}
