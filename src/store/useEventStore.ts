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
    set((state) => {
      // Prevent duplicate IDs
      if (state.events.find((x) => x.id === e.id)) return state;

      return {
        events: [
          {
            dismissed: false,
            priority: "medium",
            ...e,
          },
          ...state.events,
        ].slice(0, 10),
      };
    }),

  dismissEvent: (id) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, dismissed: true } : e
      ),
    })),

  clearExpired: () => {
    const now = Date.now();
    set((state) => ({
      events: state.events.filter(
        (e) => !e.expiresAt || e.expiresAt > now
      ),
    }));
  },
}));
