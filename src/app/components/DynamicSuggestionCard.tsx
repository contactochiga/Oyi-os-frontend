"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/useEventStore";

function pickSubtitle(e: any) {
  return e.subtitle || e.hint || e.description || "";
}

function renderIcon(icon?: string) {
  // Use emoji / simple string icons for now (no extra deps)
  if (!icon) return null;
  return (
    <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-[16px]">
      {icon}
    </div>
  );
}

export default function DynamicSuggestionCard({
  onSend,
}: {
  onSend: (t: string) => void;
}) {
  const router = useRouter();
  const { events, dismissEvent, clearExpired } = useEventStore();

  useEffect(() => {
    const id = setInterval(clearExpired, 1500);
    return () => clearInterval(id);
  }, [clearExpired]);

  const visible = useMemo(() => {
    return events
      .filter((e) => !e.dismissed && e.actionable !== false && e.category !== "system")
      .slice(0, 12);
  }, [events]);

  if (visible.length === 0) return null;

  function handleClick(e: any) {
    const route = e?.route || e?.action?.route;
    if (typeof route === "string" && route.startsWith("/")) {
      router.push(route);
      return;
    }
    onSend(e?.message || "");
  }

  return (
    <div className="flex gap-3 overflow-x-auto py-2 pr-2 scrollbar-hide" role="list" aria-label="Suggestions">
      {visible.map((e: any) => {
        const title = String(e.title || "Suggestion");
        const subtitle = String(pickSubtitle(e) || "");
        const icon = typeof e.icon === "string" ? e.icon : null;

        const tone =
          e.priority === "high"
            ? "bg-white text-black"
            : "bg-white/5 text-white";

        const border =
          e.priority === "high"
            ? "border-white/20"
            : "border-white/10";

        return (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              handleClick(e);
              dismissEvent(e.id);
            }}
            className={`min-w-[210px] max-w-[260px] rounded-2xl border ${border} ${tone}
              px-4 py-3 text-left transition active:scale-[0.98] hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10`}
            title={title}
            aria-label={title}
          >
            <div className="flex items-start gap-3">
              {icon ? renderIcon(icon) : null}

              <div className="min-w-0 flex-1">
                <div className={`text-[13px] font-semibold truncate ${e.priority === "high" ? "text-black" : "text-white"}`}>
                  {title}
                </div>

                {subtitle ? (
                  <div className={`mt-1 text-[11px] line-clamp-2 ${e.priority === "high" ? "text-black/60" : "text-white/45"}`}>
                    {subtitle}
                  </div>
                ) : (
                  <div className={`mt-1 text-[11px] ${e.priority === "high" ? "text-black/50" : "text-white/35"}`}>
                    Tap to run
                  </div>
                )}
              </div>

              <div className={`text-[11px] shrink-0 ${e.priority === "high" ? "text-black/50" : "text-white/35"}`}>
                →
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
