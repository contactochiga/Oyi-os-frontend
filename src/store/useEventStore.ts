import { create } from "zustand";
import { EstateEvent, EventPriority } from "@/types/events";

type EventState = {
  events: EstateEvent[];
  pushEvent: (e: EstateEvent) => void;
  dismissEvent: (id: string) => void;
  clearExpired: () => void;
};

export const useEventStore = create<EventState>((set) => ({
  events: [],

  pushEvent: (e) =>
    set((s) => {
      const next: EstateEvent[] = [
        {
          ...e,
          dismissed: false,
          actionable: e.actionable ?? true,
          priority: e.priority ?? "low",
        },
        ...s.events,
      ];

      // Priority sort: high → medium → low
      const weight: Record<EventPriority, number> = {
        high: 3,
        medium: 2,
        low: 1,
      };

      next.sort(
        (a, b) =>
          weight[b.priority ?? "low"] - weight[a.priority ?? "low"]
      );

      return { events: next.slice(0, 6) };
    }),

  dismissEvent: (id) =>
    set((s) => ({
      events: s.events.map((e) =>
        e.id === id ? { ...e, dismissed: true } : e
      ),
    })),

  clearExpired: () =>
    set((s) => {
      const now = Date.now();
      return {
        events: s.events.filter(
          (e) =>
            !e.dismissed &&
            (!e.expiresAt || e.expiresAt > now)
        ),
      };
    }),
}));
