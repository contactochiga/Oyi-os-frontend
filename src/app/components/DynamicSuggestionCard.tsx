// src/app/components/DynamicSuggestionCard.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/useEventStore";

export default function DynamicSuggestionCard({
  onSend,
}: {
  onSend: (t: string) => void;
}) {
  const router = useRouter();
  const { events, dismissEvent, clearExpired } = useEventStore();

  // Auto-expiry cleanup
  useEffect(() => {
    const id = setInterval(clearExpired, 1500);
    return () => clearInterval(id);
  }, [clearExpired]);

  const visible = useMemo(() => {
    return events.filter(
      (e) => !e.dismissed && e.actionable !== false && e.category !== "system"
    );
  }, [events]);

  if (visible.length === 0) return null;

  function handleClick(e: any) {
    // ✅ Optional: allow events to navigate (e.g. invite → "/invites")
    // We keep this loose so you don't have to change EstateEvent type immediately.
    const route = e?.route || e?.action?.route;
    if (typeof route === "string" && route.startsWith("/")) {
      router.push(route);
      return;
    }

    // Default behavior: send message into chat
    onSend(e?.message || "");
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto py-2 scrollbar-hide"
      role="list"
      aria-label="Suggestions"
    >
      {visible.map((e: any) => (
        <button
          key={e.id}
          type="button"
          onClick={() => {
            handleClick(e);
            dismissEvent(e.id);
          }}
          className={`
            px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium
            transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/10
            ${
              e.priority === "high"
                ? "bg-[#E11D2E] text-white"
                : e.priority === "medium"
                ? "bg-gray-700 text-white"
                : "bg-gray-800 text-gray-300"
            }
          `}
          title={typeof e?.title === "string" ? e.title : "Suggestion"}
          aria-label={typeof e?.title === "string" ? e.title : "Suggestion"}
        >
          {e.title}
        </button>
      ))}
    </div>
  );
}
