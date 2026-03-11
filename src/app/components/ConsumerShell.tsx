"use client";

import { ReactNode, useMemo } from "react";
import { useRouter } from "next/navigation";

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
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
}) {
  const router = useRouter();

  const canGoBack = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.history.length > 1;
  }, []);

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
          className="flex-1 overflow-y-auto px-4"
          style={{
            // top space: header(64px) + safe-area + spacing
            paddingTop: "calc(64px + var(--sat) + 16px)",
            // bottom space: footer + safe-area
            paddingBottom: "calc(88px + var(--sab))",
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

            {children}
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
