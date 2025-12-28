import { create } from "zustand";
import { EstateEvent } from "@/types/events";

type EventState = {
  events: EstateEvent[];
  pushEvent: (e: EstateEvent) => void;
  clearEvents: () => void;
};

export const useEventStore = create<EventState>((set) => ({
  events: [],
  pushEvent: (e) =>
    set((s) => ({ events: [e, ...s.events].slice(0, 5) })),
  clearEvents: () => set({ events: [] }),
}));
