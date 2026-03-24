"use client";

import { ReactNode, useMemo } from "react";
import { useRouter } from "next/navigation";
import useActiveContext from "@/hooks/useActiveContext";

import LayoutWrapper from "./LayoutWrapper";
import InviteSuggestionBridge from "./InviteSuggestionBridge";
import NotificationsBridge from "./NotificationsBridge";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function ConsumerShell({
  children,
  title,
  subtitle,
  showBack = true,
  backHref = "/home",
  disableContentScroll = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  disableContentScroll?: boolean;
}) {
  const router = useRouter();
  const { estate, home, available_contexts } = useActiveContext();

  const canGoBack = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.history.length > 1;
  }, []);

  const homeLabel = useMemo(() => {
    const block = String(home?.block || "").trim();
    const unit = String(home?.unit || "").trim();
    if (block && unit) return `${block} / ${unit}`;
    if (block) return block;
    if (unit) return unit;
    return String(home?.name || "").trim() || null;
  }, [home]);

  function handleBack() {
    if (canGoBack) router.back();
    else router.push(backHref);
  }

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 flex flex-col">
        <InviteSuggestionBridge />
        <NotificationsBridge />

        {/* ✅ Top bar (fixed + safe-area aware via your global setup) */}
        <header className="fixed top-0 left-0 right-0 z-[80] h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800">
          <div className="max-w-3xl mx-auto h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 active:scale-[0.99] transition text-white text-sm"
                >
                  ← Back
                </button>
              )}
            </div>

            {/* Hamburger + bell live inside TopBar */}
            <TopBar />
          </div>
        </header>

        {/* ✅ Scrollable content area (NO footer here) */}
        <div
          className={`flex-1 px-4 ${disableContentScroll ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{
            // top space: header(64px) + safe-area + spacing
            paddingTop: "calc(64px + var(--sat) + 16px)",
            // bottom space: footer + safe-area + keyboard offset
            paddingBottom: disableContentScroll
              ? "calc(88px + var(--sab))"
              : "calc(88px + var(--sab) + var(--kb))",
          }}
        >
          <div className="max-w-3xl mx-auto">
            {(title || subtitle) && (
              <div className="mb-4">
                {title && (
                  <div className="text-white text-lg font-semibold">{title}</div>
                )}
                {subtitle && (
                  <div className="text-white/60 text-sm mt-1">{subtitle}</div>
                )}
              </div>
            )}

            {(estate?.name || homeLabel) && (
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                      Active Home
                    </div>
                    <div className="mt-1 text-sm font-medium text-white truncate">
                      {String(home?.name || "").trim() || estate?.name || homeLabel || "Home not selected"}
                    </div>
                  </div>
                  {available_contexts.length > 1 ? (
                    <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] text-cyan-100">
                      Switch in menu
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {children}
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
