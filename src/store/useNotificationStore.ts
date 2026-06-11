import { create } from "zustand";
import type { AppNotification } from "@/services/notificationsService";
import { bucketForNotification, deriveFooterBadges, isUnreadNotification, shouldKeepAttention, type BadgeScope, type FooterBadgeKey } from "@/lib/footerBadges";

type State = {
  items: AppNotification[];
  unreadCount: number;
  unreadByBucket: Record<string, number>;
  scopeKey: string;
  setScopeKey: (scopeKey: string) => void;
  setItems: (items: AppNotification[], scopeKey?: string) => void;
  clear: () => void;
  upsert: (n: AppNotification) => void;
  upsertMany: (items: AppNotification[]) => void;
  markNotificationsRead: (ids: string[]) => void;
  markBucketViewed: (bucket: string) => void;
};

function computeUnread(items: AppNotification[]) {
  return items.filter(isUnreadNotification).length;
}

function computeBuckets(items: AppNotification[]) {
  const badges = deriveFooterBadges(items, {}, {});
  return Object.entries(badges).reduce<Record<string, number>>((acc, [key, value]) => {
    if (value.count) acc[key] = value.count;
    return acc;
  }, {});
}

function sortItems(items: AppNotification[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export const useNotificationStore = create<State>((set, get) => ({
  items: [],
  unreadCount: 0,
  unreadByBucket: {},
  scopeKey: "",

  setScopeKey: (scopeKey) => {
    if (get().scopeKey === scopeKey) return;
    set({ scopeKey, items: [], unreadCount: 0, unreadByBucket: {} });
  },

  clear: () => set({ items: [], unreadCount: 0, unreadByBucket: {} }),

  setItems: (items, scopeKey) => {
    if (scopeKey && get().scopeKey && scopeKey !== get().scopeKey) return;
    const sorted = sortItems(items);
    set({ items: sorted, unreadCount: computeUnread(sorted), unreadByBucket: computeBuckets(sorted) });
  },

  upsert: (n) => {
    const prev = get().items;
    const map = new Map(prev.map((x) => [x.id, x] as const));
    map.set(n.id, n);
    const merged = sortItems(Array.from(map.values()));
    set({ items: merged, unreadCount: computeUnread(merged), unreadByBucket: computeBuckets(merged) });
  },

  upsertMany: (incoming) => {
    const prev = get().items;
    const map = new Map(prev.map((x) => [x.id, x] as const));
    for (const n of incoming) map.set(n.id, n);
    const merged = sortItems(Array.from(map.values()));
    set({ items: merged, unreadCount: computeUnread(merged), unreadByBucket: computeBuckets(merged) });
  },

  markNotificationsRead: (ids) => {
    const target = new Set(ids.map((id) => String(id)).filter(Boolean));
    if (!target.size) return;
    const next = get().items.map((item) => (target.has(String(item.id)) ? { ...item, status: "read" as const } : item));
    set({ items: next, unreadCount: computeUnread(next), unreadByBucket: computeBuckets(next) });
  },

  markBucketViewed: (bucket) => {
    const key = bucket as FooterBadgeKey;
    const next = get().items.map((item) => {
      const itemBucket = bucketForNotification(item);
      const shouldMark = itemBucket === key || (key === "activity" && itemBucket !== "profile");
      return shouldMark && !shouldKeepAttention(item, itemBucket) ? { ...item, status: "read" as const } : item;
    });
    set({ items: next, unreadCount: computeUnread(next), unreadByBucket: computeBuckets(next) });
  },
}));

export function contextScopeKey(scope: BadgeScope) {
  return `${scope.userId || "user"}:${scope.estateId || "estate"}:${scope.homeId || "home"}`;
}
