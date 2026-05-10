import { MEMBERS } from "@/data/questions";

export type MeridianRole = "member" | "va";

export const VA_USERS = ["Sophie / VA"] as const;

export const LOGIN_USERS = [...MEMBERS, ...VA_USERS] as const;

export function getUserRole(name: string | null): MeridianRole {
  if (name && (VA_USERS as readonly string[]).includes(name)) return "va";
  return "member";
}

export function isVaUser(name: string | null): boolean {
  return getUserRole(name) === "va";
}

