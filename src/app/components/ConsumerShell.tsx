"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";

import LayoutWrapper from "./LayoutWrapper";
import InviteSuggestionBridge from "./InviteSuggestionBridge";
import NotificationsBridge from "./NotificationsBridge";
import TopBar from "./TopBar";

export default function ConsumerShell({
  children,
  title,
  subtitle,
  showBack = false,
  backHref = "/home",
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
}) {
  const router = useRouter();

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 flex flex-col">
        <InviteSuggestionBridge />
        <NotificationsBridge />

        {/* ✅ Top bar stays for every page */}
        <header className="fixed top-0 left-0 right-0 z-[80] h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800">
          <div className="max-w-3xl mx-auto h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showBack && (
                <button
                  onClick={() => {
                    // best effort: go back; if not, go home
                    try {
                      router.back();
                      setTimeout(() => router.push(backHref), 250);
                    } catch {
                      router.push(backHref);
                    }
                  }}
                  className="rounded-xl px-3 py-2 bg-white/10 text-white text-sm"
                >
                  ← Back
                </button>
              )}
            </div>

            {/* your existing hamburger + notification logic lives inside TopBar */}
            <TopBar />
          </div>
        </header>

        {/* ✅ Page header strip (optional) */}
        {(title || subtitle) && (
          <div className="pt-20 px-4">
            <div className="max-w-3xl mx-auto">
              {title && <div className="text-white text-lg font-semibold">{title}</div>}
              {subtitle && <div className="text-white/60 text-sm mt-1">{subtitle}</div>}
            </div>
          </div>
        )}

        {/* ✅ Page body */}
        <div className={`flex-1 overflow-y-auto px-4 ${title || subtitle ? "pt-4" : "pt-20"} pb-28`}>
          <div className="max-w-3xl mx-auto">{children}</div>
        </div>

        {/* ✅ Minimal footer nav so “footer doesn’t disappear” */}
        <footer className="fixed bottom-0 left-0 right-0 z-[60] p-4 bg-gray-900 border-t border-gray-800">
          <div className="max-w-3xl mx-auto flex gap-2">
            <button
              onClick={() => router.push("/home")}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/maintenance")}
              className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-semibold"
            >
              Maintenance
            </button>
          </div>
        </footer>
      </main>
    </LayoutWrapper>
  );
}
