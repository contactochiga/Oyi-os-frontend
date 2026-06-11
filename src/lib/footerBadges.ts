import type { AppNotification } from "@/services/notificationsService";

export type FooterBadgeKey = "spaces" | "devices" | "community" | "activity" | "visitors" | "wallet" | "maintenance" | "services" | "profile" | "messages";

export type BadgeScope = {
  userId?: string | null;
  estateId?: string | null;
  homeId?: string | null;
};

export type BadgeValue = { count: number; dot: boolean };

export type FooterBadgeMap = Record<FooterBadgeKey, BadgeValue>;

const EMPTY: FooterBadgeMap = {
  spaces: { count: 0, dot: false },
  devices: { count: 0, dot: false },
  community: { count: 0, dot: false },
  activity: { count: 0, dot: false },
  visitors: { count: 0, dot: false },
  wallet: { count: 0, dot: false },
  maintenance: { count: 0, dot: false },
  services: { count: 0, dot: false },
  profile: { count: 0, dot: false },
  messages: { count: 0, dot: false },
};

function clean(value: any) {
  return String(value ?? "").trim();
}

export function notificationText(item: any) {
  return `${item?.type || ""} ${item?.title || ""} ${item?.message || ""} ${item?.payload?.kind || ""} ${item?.payload?.bucket || ""} ${item?.payload?.category || ""}`.toLowerCase();
}

export function isUnreadNotification(item: any) {
  const status = String(item?.status || "").toLowerCase();
  return status !== "read" && status !== "acknowledged" && status !== "seen";
}

export function notificationScope(item: any): BadgeScope {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return {
    userId: clean(item?.user_id || payload.user_id || payload.userId || metadata.user_id || metadata.userId),
    estateId: clean(item?.estate_id || payload.estate_id || payload.estateId || metadata.estate_id || metadata.estateId),
    homeId: clean(item?.home_id || payload.home_id || payload.homeId || metadata.home_id || metadata.homeId),
  };
}

export function eventScope(payload: any): BadgeScope {
  const data = payload?.detail || payload?.data || payload?.payload || payload || {};
  const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
  return {
    userId: clean(data?.user_id || data?.userId || metadata.user_id || metadata.userId),
    estateId: clean(data?.estate_id || data?.estateId || data?.site_id || data?.siteId || metadata.estate_id || metadata.estateId),
    homeId: clean(data?.home_id || data?.homeId || metadata.home_id || metadata.homeId),
  };
}

export function isInActiveScope(item: any, scope: BadgeScope, options?: { allowUnscoped?: boolean; profileGlobal?: boolean }) {
  const itemScope = notificationScope(item);
  return scopeMatches(itemScope, scope, options);
}

export function scopeMatches(itemScope: BadgeScope, activeScope: BadgeScope, options?: { allowUnscoped?: boolean; profileGlobal?: boolean }) {
  const estateId = clean(activeScope.estateId);
  const homeId = clean(activeScope.homeId);
  const userId = clean(activeScope.userId);
  const itemEstate = clean(itemScope.estateId);
  const itemHome = clean(itemScope.homeId);
  const itemUser = clean(itemScope.userId);

  if (itemUser && userId && itemUser !== userId) return false;
  if (itemEstate && estateId && itemEstate !== estateId) return false;
  if (itemHome && homeId && itemHome !== homeId) return false;
  if (itemHome && !homeId) return false;
  if (itemEstate && !estateId) return false;
  if (!itemEstate && !itemHome) return Boolean(options?.allowUnscoped || options?.profileGlobal);
  return true;
}

export function bucketForNotification(item: AppNotification): FooterBadgeKey {
  const text = notificationText(item);
  if (/message|inbox|chat|thread|dm/.test(text)) return "messages";
  if (/community|announcement|notice|post|comment|reply|official/.test(text)) return "community";
  if (/visitor|guest|gate|access/.test(text)) return "visitors";
  if (/maintenance|repair|work order|ticket/.test(text)) return "maintenance";
  if (/wallet|payment|transaction|billing|dues|fund/.test(text)) return "wallet";
  if (/service|concierge|booking|request/.test(text)) return "services";
  if (/space|room assignment|room/.test(text)) return "spaces";
  if (/device|switch|light|socket|plug|climate|ac|tv|provider|tuya|sync|offline|failed/.test(text)) return "devices";
  if (/profile|verify|verification|account|setup|invite/.test(text)) return "profile";
  return "activity";
}

export function isAttentionNotification(item: AppNotification, bucket: FooterBadgeKey) {
  const text = notificationText(item);
  if (bucket === "devices") return /offline|failed|failure|critical|alert|unavailable|lost|error/.test(text);
  if (bucket === "spaces") return /offline|failed|failure|critical|alert|unavailable|lost|error|room assignment|space/.test(text);
  if (bucket === "community") return /community|announcement|notice|post|comment|reply|urgent|official|security|maintenance|administration/.test(text);
  if (bucket === "activity") return true;
  if (bucket === "profile") return /profile|verify|verification|account|setup|invite/.test(text);
  return true;
}

export function shouldKeepAttention(item: AppNotification, bucket: FooterBadgeKey) {
  const text = notificationText(item);
  if (bucket === "activity" || bucket === "community") return /urgent|critical|security|emergency|lockdown|alarm/.test(text);
  return false;
}

export function deriveFooterBadges(items: AppNotification[], scope: BadgeScope, localDots: Partial<Record<FooterBadgeKey, boolean>> = {}): FooterBadgeMap {
  const next: FooterBadgeMap = JSON.parse(JSON.stringify(EMPTY));
  for (const item of items) {
    if (!isUnreadNotification(item)) continue;
    const bucket = bucketForNotification(item);
    const allowGlobal = bucket === "profile";
    if (!isInActiveScope(item, scope, { allowUnscoped: allowGlobal, profileGlobal: allowGlobal })) continue;
    if (!isAttentionNotification(item, bucket)) continue;
    next[bucket].count += 1;
    if (bucket !== "activity") next.activity.count += 1;
  }
  for (const [key, value] of Object.entries(localDots) as Array<[FooterBadgeKey, boolean]>) {
    if (value && !next[key].count) next[key].dot = true;
  }
  return next;
}

export function scopedViewedKey(scope: BadgeScope, bucket: string) {
  return `oyi:viewed:${clean(scope.userId) || "user"}:${clean(scope.estateId) || "estate"}:${clean(scope.homeId) || "home"}:${bucket}`;
}

export function markViewedLocal(scope: BadgeScope, bucket: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedViewedKey(scope, bucket), new Date().toISOString());
}

export function eventIndicatesAttention(eventName: string, payload: any, bucket: FooterBadgeKey) {
  const text = `${eventName} ${notificationText(payload)} ${payload?.status || ""} ${payload?.state || ""} ${payload?.health_status || ""} ${payload?.stream_status || ""}`.toLowerCase();
  if (bucket === "devices" || bucket === "spaces") return /offline|failed|failure|critical|alert|unavailable|lost|error/.test(text);
  if (bucket === "community") return /community|post|comment|notice|announcement|urgent|official/.test(text);
  return true;
}
