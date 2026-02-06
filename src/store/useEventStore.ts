import { create } from "zustand";
import { EstateEvent, EventPriority } from "@/types/events";

type EventState = {
  events: EstateEvent[];
  pushEvent: (e: EstateEvent) => void;
  dismissEvent: (id: string) => void;
  clearExpired: () => void;
  clearAll: () => void;
};

const priorityScore: Record<EventPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const useEventStore = create<EventState>((set, get) => ({
  events: [],

  pushEvent: (e) =>
    set((s) => {
      const next: EstateEvent[] = [
        {
          ...e,
          dismissed: e.dismissed ?? false,
          actionable: e.actionable ?? true,
          category: e.category ?? "assistant",
          priority: e.priority ?? "low",
        },
        ...s.events,
      ];

      // remove duplicates by id (keep latest)
      const byId = new Map<string, EstateEvent>();
      for (const ev of next) byId.set(ev.id, ev);
      const deduped = Array.from(byId.values());

      // sort by priority then timestamp
      deduped.sort((a, b) => {
        const pa = priorityScore[a.priority ?? "low"] ?? 0;
        const pb = priorityScore[b.priority ?? "low"] ?? 0;
        if (pb !== pa) return pb - pa;
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      });

      return { events: deduped.slice(0, 6) };
    }),

  dismissEvent: (id) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, dismissed: true } : e)),
    })),

  clearExpired: () => {
    const now = Date.now();
    set((s) => ({
      events: s.events.filter((e) => {
        if (e.dismissed) return false;
        if (typeof e.expiresAt === "number" && e.expiresAt <= now) return false;
        return true;
      }),
    }));
  },

  clearAll: () => set({ events: [] }),
}));
