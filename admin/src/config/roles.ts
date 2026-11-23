import type { Profile } from "@/config/api/profile.api";

export type Role = Profile["role"];

export const ROLES = {
  OWNER:  "OWNER",
  DESIGNER: "DESIGNER",
} as const satisfies Record<string, Role>;

export const ROLE_GROUPS = {
  ALL:         ["OWNER", "DESIGNER"] as const satisfies readonly Role[],
  OWNER: ["OWNER"]                 as const satisfies readonly Role[],
} as const;