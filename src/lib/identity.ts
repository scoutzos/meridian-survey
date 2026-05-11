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
