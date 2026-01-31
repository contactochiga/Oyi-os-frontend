import { create } from "zustand";
import type { AppNotification } from "@/services/notificationsService";

type State = {
  items: AppNotification[];
  unreadCount: number;
  setItems: (items: AppNotification[]) => void;
  upsert: (n: AppNotification) => void;
  upsertMany: (items: AppNotification[]) => void;
};

function computeUnread(items: AppNotification[]) {
  return items.filter((n) => n.status !== "read").length;
}

export const useNotificationStore = create<State>((set, get) => ({
  items: [],
  unreadCount: 0,

  setItems: (items) =>
    set({
      items,
      unreadCount: computeUnread(items),
    }),

  upsert: (n) => {
    const prev = get().items;
    const map = new Map(prev.map((x) => [x.id, x] as const));
    map.set(n.id, n);

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    set({ items: merged, unreadCount: computeUnread(merged) });
  },

  upsertMany: (incoming) => {
    const prev = get().items;
    const map = new Map(prev.map((x) => [x.id, x] as const));
    for (const n of incoming) map.set(n.id, n);

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    set({ items: merged, unreadCount: computeUnread(merged) });
  },
}));
