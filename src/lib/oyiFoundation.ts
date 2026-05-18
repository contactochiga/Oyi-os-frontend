export const OCHIGA_CONTRACT_VERSION = "ochiga.tier1.2026-05-16";

export const PERMISSION_KEYS = [
  "estates.read",
  "estates.write",
  "homes.read",
  "homes.write",
  "devices.read",
  "devices.control",
  "cameras.view",
  "visitors.create",
  "visitors.manage",
  "wallets.read",
  "wallets.manage",
  "support.read",
  "support.assign",
  "documents.generate",
  "twin.view",
  "twin.control",
  "planstudio.read",
  "planstudio.write",
  "staff.manage",
  "settings.manage",
  "audit.read",
  "office.read",
  "office.manage",
  "community.read",
  "community.write",
  "notifications.read",
  "notifications.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type OyiIdentity = {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  estate_name?: string;
  unit_name?: string;
  unit_id?: string;
  role?: string;
  estate_id?: string;
  home_id?: string;
  permissions?: string[];
  permission_scopes?: string[];
  exp?: number;
};

const ROLE_ALIASES: Record<string, string> = {
  admin: "super_admin",
  system_admin: "super_admin",
  manager: "facility_manager",
  operator: "maintenance_operator",
  owner: "estate_admin",
  security: "security_operator",
  staff: "ochiga_staff",
  member: "resident",
  viewer: "guest",
};

const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  super_admin: PERMISSION_KEYS,
  ochiga_admin: PERMISSION_KEYS,
  estate_admin: ["estates.read", "estates.write", "homes.read", "homes.write", "devices.read", "devices.control", "cameras.view", "visitors.create", "visitors.manage", "wallets.read", "wallets.manage", "support.read", "support.assign", "community.read", "community.write", "notifications.read"],
  facility_manager: ["estates.read", "estates.write", "homes.read", "homes.write", "devices.read", "devices.control", "cameras.view", "visitors.manage", "wallets.read", "support.read", "support.assign", "community.read", "community.write", "notifications.read"],
  security_operator: ["estates.read", "homes.read", "devices.read", "devices.control", "cameras.view", "visitors.create", "visitors.manage", "support.read", "notifications.read"],
  maintenance_operator: ["estates.read", "homes.read", "devices.read", "devices.control", "support.read", "support.assign", "notifications.read"],
  finance_operator: ["estates.read", "homes.read", "wallets.read", "wallets.manage", "documents.generate", "support.read", "notifications.read"],
  resident: ["estates.read", "homes.read", "devices.read", "devices.control", "visitors.create", "wallets.read", "support.read", "community.read", "community.write", "notifications.read"],
  guest: ["visitors.create"],
  ai_agent: ["office.read", "estates.read", "homes.read", "devices.read", "cameras.view", "support.read", "community.read", "twin.view", "planstudio.read"],
  ochiga_staff: ["office.read", "estates.read", "homes.read", "devices.read", "cameras.view", "support.read", "support.assign", "documents.generate", "community.read", "notifications.read", "notifications.manage"],
};

export function canonicalRole(role?: string | null) {
  const raw = String(role || "guest").trim().toLowerCase();
  return ROLE_ALIASES[raw] || raw;
}

export function permissionsForRole(role?: string | null, extraScopes: string[] = []) {
  return Array.from(new Set([...(ROLE_PERMISSIONS[canonicalRole(role)] || ROLE_PERMISSIONS.guest), ...extraScopes]));
}

export function hasPermission(user: OyiIdentity | null | undefined, permission: PermissionKey | string) {
  if (!user) return false;
  const scopes = [...(user.permission_scopes || []), ...(user.permissions || [])];
  return permissionsForRole(user.role, scopes).includes(permission);
}
