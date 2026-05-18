import { hasPermission, type OyiIdentity, type PermissionKey } from "@/lib/oyiFoundation";

export type VisibilityScope = PermissionKey | string;

export type ModuleDefinition = {
  key: string;
  label: string;
  href: string;
  domain?: string;
  badgeKey?: "devices" | "wallet" | "community" | "visitors" | "maintenance";
  anyOf?: VisibilityScope[];
  allOf?: VisibilityScope[];
};

export type TabDefinition = {
  key: string;
  label: string;
  anyOf?: VisibilityScope[];
  allOf?: VisibilityScope[];
};

export function isSuperAdmin(user: OyiIdentity | null | undefined) {
  const role = String(user?.role || "").toLowerCase();
  return ["super_admin", "ochiga_admin", "admin", "system_admin"].includes(role);
}

export function canSee(user: OyiIdentity | null | undefined, item: Pick<ModuleDefinition, "anyOf" | "allOf">) {
  if (isSuperAdmin(user)) return true;
  const anyOf = item.anyOf || [];
  const allOf = item.allOf || [];
  if (allOf.length && !allOf.every((permission) => hasPermission(user, permission))) return false;
  if (anyOf.length) return anyOf.some((permission) => hasPermission(user, permission));
  return true;
}

export function visibleModules<T extends ModuleDefinition>(user: OyiIdentity | null | undefined, modules: T[]) {
  return modules.filter((module) => canSee(user, module));
}

export function visibleTabs<T extends TabDefinition>(user: OyiIdentity | null | undefined, tabs: T[]) {
  return tabs.filter((tab) => canSee(user, tab));
}

export const CONSUMER_MODULES: ModuleDefinition[] = [
  { key: "home", label: "Home Overview", href: "/home", domain: "Smart Home Modules", anyOf: ["homes.read", "devices.read"] },
  { key: "rooms", label: "Rooms & Spaces", href: "/rooms", domain: "Smart Home Modules", anyOf: ["homes.read"] },
  { key: "devices", label: "Smart Devices", href: "/devices", domain: "Smart Home Modules", badgeKey: "devices", anyOf: ["devices.read"] },
  { key: "security", label: "Security & Access", href: "/security", domain: "Smart Home Modules", badgeKey: "visitors", anyOf: ["visitors.create", "visitors.manage", "cameras.view"] },
  { key: "utilities", label: "Utilities", href: "/utilities", domain: "Smart Home Modules", anyOf: ["devices.read", "homes.read"] },
  { key: "maintenance", label: "Maintenance & Support", href: "/maintenance", domain: "Smart Home Modules", badgeKey: "maintenance", anyOf: ["support.read"] },
  { key: "visitors", label: "Visitors", href: "/visitors", domain: "Smart Home Modules", badgeKey: "visitors", anyOf: ["visitors.create", "visitors.manage"] },
  { key: "community", label: "Community", href: "/community", domain: "Smart Home Modules", badgeKey: "community", anyOf: ["community.read", "community.write"] },
  { key: "wallet", label: "Wallet & Services", href: "/wallet", domain: "Smart Home Modules", badgeKey: "wallet", anyOf: ["wallets.read"] },
  { key: "reports", label: "Reports", href: "/reports", domain: "Smart Home Modules", anyOf: ["homes.read", "devices.read", "wallets.read"] },
  { key: "ai", label: "AI & Automation", href: "/ai", domain: "Smart Home Modules", anyOf: ["homes.read", "devices.read"] },
  { key: "account", label: "Account", href: "/account", domain: "Smart Home Modules" },
];
