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
  { key: "home", label: "Home", href: "/home", anyOf: ["homes.read", "devices.read"] },
  { key: "rooms", label: "Spaces", href: "/spaces", anyOf: ["homes.read"] },
  { key: "devices", label: "Devices", href: "/devices", badgeKey: "devices", anyOf: ["devices.read"] },
  { key: "scenes", label: "Scenes", href: "/scenes", anyOf: ["devices.read"] },
  { key: "activity", label: "Activity", href: "/activity", anyOf: ["homes.read", "devices.read"] },
  { key: "community", label: "Community", href: "/community", badgeKey: "community", anyOf: ["community.read", "community.write"] },
  { key: "messages", label: "Messages", href: "/messages" },
  { key: "visitors", label: "Visitors", href: "/visitors", badgeKey: "visitors", anyOf: ["visitors.create", "visitors.manage"] },
  { key: "maintenance", label: "Maintenance", href: "/maintenance", badgeKey: "maintenance", anyOf: ["support.read"] },
  { key: "wallet", label: "Wallet", href: "/wallet", badgeKey: "wallet", anyOf: ["wallets.read"] },
  { key: "services", label: "Services", href: "/services", anyOf: ["homes.read"] },
  { key: "security", label: "Security", href: "/security", anyOf: ["visitors.create", "visitors.manage", "cameras.view"] },
  { key: "utilities", label: "Utilities", href: "/utilities", anyOf: ["devices.read", "homes.read"] },
  { key: "watch", label: "Watch", href: "/watch", anyOf: ["devices.read"] },
  { key: "intelligence", label: "Oyi Intelligence", href: "/ai" },
  { key: "reports", label: "Reports", href: "/reports", anyOf: ["homes.read", "devices.read", "wallets.read"] },
];
