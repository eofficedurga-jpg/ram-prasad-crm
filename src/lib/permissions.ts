export type Role = "owner" | "management" | "sales" | "operations" | "finance";

export type Permission =
  | "requirements:write"
  | "oems:write"
  | "sourcing:write"
  | "quotes:write"
  | "quotes:approve"
  | "orders:write"
  | "fulfilment:write"
  | "pdi:write"
  | "deliveries:write"
  | "finance:write"
  | "documents:write"
  | "documents:approve"
  | "coverage:override"
  | "losses:write"
  | "users:manage"
  | "audit:view";

const ALL: Role[] = ["owner", "management", "sales", "operations", "finance"];

export const PERMISSIONS: Record<Permission, Role[]> = {
  "requirements:write": ["owner", "management", "sales"],
  "oems:write": ["owner", "management", "operations"],
  "sourcing:write": ["owner", "management", "sales", "operations"],
  "quotes:write": ["owner", "management", "sales"],
  "quotes:approve": ["owner", "management"],
  "orders:write": ["owner", "management", "operations"],
  "fulfilment:write": ["owner", "management", "operations"],
  "pdi:write": ["owner", "management", "operations"],
  "deliveries:write": ["owner", "management", "operations"],
  "finance:write": ["owner", "management", "finance"],
  "documents:write": ["owner", "management", "finance", "operations"],
  "documents:approve": ["owner", "management"],
  "coverage:override": ["owner", "management"],
  "losses:write": ["owner", "management", "sales"],
  "users:manage": ["owner"],
  "audit:view": ["owner", "management"],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[permission].includes(role as Role);
}

export function canAny(role: string | null | undefined): Role[] {
  return role ? ALL.filter((r) => r === role) : [];
}
