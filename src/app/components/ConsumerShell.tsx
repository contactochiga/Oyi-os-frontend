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
      <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#03070c] text-white">
        <div className="oyi-ambient-bg" />
        <InviteSuggestionBridge />
        <NotificationsBridge />
        <TopBar />

        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="fixed left-4 z-[82] rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/65 backdrop-blur-xl transition hover:bg-white/10 active:scale-[0.98]"
            style={{ top: "calc(76px + var(--sat))" }}
          >
            Back
          </button>
        ) : null}

        <div
          className={`relative z-10 flex-1 px-4 ${disableContentScroll ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{
            paddingTop: showBack ? "calc(112px + var(--sat))" : "calc(78px + var(--sat))",
            paddingBottom: disableContentScroll
              ? "calc(88px + var(--sab))"
              : "calc(96px + var(--sab) + var(--kb))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="mx-auto max-w-5xl">
            {(title || subtitle) && (
              <section className="mb-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-sky-200/65">Oyi Home</div>
                    {title ? <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">{title}</h1> : null}
                    {subtitle ? <p className="mt-1 text-sm leading-6 text-white/55">{subtitle}</p> : null}
                  </div>
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(95,227,161,0.8)]" />
                </div>
              </section>
            )}

            {(estate?.name || homeLabel) && (
              <section className="mb-4 rounded-[24px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Active Environment</div>
                    <div className="mt-1 truncate text-sm font-medium text-white/88">
                      {String(home?.name || "").trim() || estate?.name || homeLabel || "Home not selected"}
                    </div>
                  </div>
                  {available_contexts.length > 1 ? (
                    <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] text-sky-100">
                      Switch in menu
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {children}
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
