import type { Role } from "@prisma/client";

const HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export const ROLES = Object.keys(HIERARCHY) as Role[];

/** True when `userRole` is at least as privileged as `minimum`. */
export function hasRole(userRole: Role, minimum: Role): boolean {
  return HIERARCHY[userRole] >= HIERARCHY[minimum];
}
