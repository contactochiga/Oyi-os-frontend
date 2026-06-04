import { create } from "zustand";
import type { AppNotification } from "@/services/notificationsService";

type State = {
  items: AppNotification[];
  unreadCount: number;
  unreadByBucket: Record<string, number>;
  setItems: (items: AppNotification[]) => void;
  upsert: (n: AppNotification) => void;
  upsertMany: (items: AppNotification[]) => void;
  markNotificationsRead: (ids: string[]) => void;
  markBucketViewed: (bucket: string) => void;
};

function computeUnread(items: AppNotification[]) {
  return items.filter((n) => n.status !== "read").length;
}

function bucketFor(n: AppNotification) {
  const text = `${n.type || ""} ${n.title || ""} ${n.message || ""}`.toLowerCase();
  if (/community|announcement|notice|post|comment|reply/.test(text)) return "community";
  if (/message|inbox|chat|thread/.test(text)) return "messages";
  if (/visitor|guest|gate|access/.test(text)) return "activity";
  if (/maintenance|repair|service|wallet|payment|transaction|device|scene|automation|security|alert/.test(text)) return "activity";
  if (/profile|verify|verification|account|home assignment|invite/.test(text)) return "profile";
  return "activity";
}

function computeBuckets(items: AppNotification[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    if (item.status === "read") return acc;
    const bucket = bucketFor(item);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

export const useNotificationStore = create<State>((set, get) => ({
  items: [],
  unreadCount: 0,
  unreadByBucket: {},

  setItems: (items) =>
    set({
      items,
      unreadCount: computeUnread(items),
      unreadByBucket: computeBuckets(items),
    }),

  upsert: (n) => {
    const prev = get().items;
    const map = new Map(prev.map((x) => [x.id, x] as const));
    map.set(n.id, n);

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    set({ items: merged, unreadCount: computeUnread(merged), unreadByBucket: computeBuckets(merged) });
  },

  upsertMany: (incoming) => {
    const prev = get().items;
    const map = new Map(prev.map((x) => [x.id, x] as const));
    for (const n of incoming) map.set(n.id, n);

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    set({ items: merged, unreadCount: computeUnread(merged), unreadByBucket: computeBuckets(merged) });
  },

  markNotificationsRead: (ids) => {
    const target = new Set(ids.map((id) => String(id)).filter(Boolean));
    if (!target.size) return;
    const next = get().items.map((item) => (target.has(String(item.id)) ? { ...item, status: "read" as const } : item));
    set({ items: next, unreadCount: computeUnread(next), unreadByBucket: computeBuckets(next) });
  },

  markBucketViewed: (bucket) => {
    const next = get().items.map((item) => (bucketFor(item) === bucket ? { ...item, status: "read" as const } : item));
    set({ items: next, unreadCount: computeUnread(next), unreadByBucket: computeBuckets(next) });
  },
}));
