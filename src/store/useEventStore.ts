import { create } from "zustand";
import { EstateEvent } from "@/types/events";

type EventState = {
  events: EstateEvent[];
  pushEvent: (e: EstateEvent) => void;
  dismissEvent: (id: string) => void;
  clearExpired: () => void;
};

export const useEventStore = create<EventState>((set, get) => ({
  events: [],

  pushEvent: (e) =>
    set((s) => {
      const next = [
        {
          ...e,
          dismissed: false,
        },
        ...s.events,
      ];

      // Priority sort: high → medium → low
      next.sort((a, b) => {
        const p = { high: 3, medium: 2, low: 1 };
        return (p[b.priority ?? "low"] ?? 0) - (p[a.priority ?? "low"] ?? 0);
      });

      return { events: next.slice(0, 6) };
    }),

  dismissEvent: (id) =>
    set((s) => ({
      events: s.events.map((e) =>
        e.id === id ? { ...e, dismissed: true } : e
      ),
    })),

  clearExpired: () => {
    const now = Date.now();
    set((s) => ({
      events: s.events.filter(
        (e) =>
          !e.dismissed &&
          (!e.expiresAt || e.expiresAt > now)
      ),
    }));
  },
}));
