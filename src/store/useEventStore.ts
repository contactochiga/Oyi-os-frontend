import { create } from "zustand";
import { EstateEvent } from "@/types/events";

export type EventPriority = "low" | "medium" | "high";

type EventState = {
  events: EstateEvent[];

  pushEvent: (e: EstateEvent) => void;
  dismissEvent: (id: string) => void;
  clearExpired: () => void;
  clearAll: () => void;
};

export const useEventStore = create<EventState>((set, get) => ({
  events: [],

  /**
   * Push a new suggestion / system event
   * - Prevents duplicates by ID
   * - Applies defaults
   * - Orders by priority
   */
  pushEvent: (e) =>
    set((state) => {
      // Prevent duplicate IDs
      if (state.events.some((x) => x.id === e.id)) {
        return state;
      }

      const event: EstateEvent = {
        dismissed: false,
        actionable: true,
        priority: "medium",
        timestamp: Date.now(),
        ...e,
      };

      const next = [event, ...state.events];

      // Priority ordering: high → medium → low
      next.sort((a, b) => {
        const p = { high: 3, medium: 2, low: 1 };
        return (p[b.priority || "medium"] ?? 2) - (p[a.priority || "medium"] ?? 2);
      });

      return {
        events: next.slice(0, 10),
      };
    }),

  /**
   * Soft-dismiss (used when user taps a suggestion)
   */
  dismissEvent: (id) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, dismissed: true } : e
      ),
    })),

  /**
   * Remove expired events (run on interval / render)
   */
  clearExpired: () => {
    const now = Date.now();
    set((state) => ({
      events: state.events.filter(
        (e) => !e.expiresAt || e.expiresAt > now
      ),
    }));
  },

  /**
   * Hard reset (logout / estate switch)
   */
  clearAll: () => set({ events: [] }),
}));
