import { create } from "zustand";
import { EstateEvent } from "@/types/events";

/**
 * Extended enterprise event model
 */
export type UIEvent = EstateEvent & {
  priority?: "high" | "medium" | "low";
  category?: "ai" | "wallet" | "room" | "community" | "security" | "system";
  source?: "ai" | "system" | "estate";
  expiresAt?: number; // unix ms
  dismissed?: boolean;
};

type EventState = {
  events: UIEvent[];

  pushEvent: (e: UIEvent) => void;
  dismissEvent: (id: string) => void;
  clearExpired: () => void;
  clearAll: () => void;
};

const MAX_EVENTS = 20;

export const useEventStore = create<EventState>((set, get) => ({
  events: [],

  /**
   * Add new event with stacking + priority
   */
  pushEvent: (e) =>
    set((state) => {
      const now = Date.now();

      const cleaned = state.events.filter(
        (ev) =>
          !ev.expiresAt || ev.expiresAt > now
      );

      const next = [
        {
          ...e,
          dismissed: false,
        },
        ...cleaned,
      ];

      // Priority sort: high → medium → low
      next.sort((a, b) => {
        const p = { high: 3, medium: 2, low: 1 };
        return (p[b.priority || "low"] ?? 0) - (p[a.priority || "low"] ?? 0);
      });

      return {
        events: next.slice(0, MAX_EVENTS),
      };
    }),

  /**
   * User dismissed (swipe / close)
   */
  dismissEvent: (id) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, dismissed: true } : e
      ),
    })),

  /**
   * Auto-clean expired events
   */
  clearExpired: () =>
    set((state) => {
      const now = Date.now();
      return {
        events: state.events.filter(
          (e) =>
            !e.expiresAt ||
            e.expiresAt > now
        ),
      };
    }),

  /**
   * Hard reset (logout, estate switch)
   */
  clearAll: () => ({
    events: [],
  }),
}));
