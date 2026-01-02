"use client";

import { useEffect } from "react";
import { useEventStore } from "@/store/useEventStore";

export default function DynamicSuggestionCard({
  onSend,
}: {
  onSend: (t: string) => void;
}) {
  const { events, dismissEvent, clearExpired } = useEventStore();

  // Auto-expiry cleanup
  useEffect(() => {
    const id = setInterval(clearExpired, 1500);
    return () => clearInterval(id);
  }, [clearExpired]);

  const visible = events.filter(
    (e) =>
      !e.dismissed &&
      e.actionable !== false &&
      e.category !== "system"
  );

  if (visible.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide">
      {visible.map((e) => (
        <button
          key={e.id}
          onClick={() => {
            onSend(e.message);
            dismissEvent(e.id);
          }}
          className={`
            px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium
            transition active:scale-95
            ${
              e.priority === "high"
                ? "bg-[#E11D2E] text-white"
                : e.priority === "medium"
                ? "bg-gray-700 text-white"
                : "bg-gray-800 text-gray-300"
            }
          `}
        >
          {e.title}
        </button>
      ))}
    </div>
  );
}
