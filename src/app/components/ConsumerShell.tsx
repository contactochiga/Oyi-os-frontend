"use client";

import { ReactNode, useMemo } from "react";
import { useRouter } from "next/navigation";
import useActiveContext from "@/hooks/useActiveContext";

import LayoutWrapper from "./LayoutWrapper";
import InviteSuggestionBridge from "./InviteSuggestionBridge";
import NotificationsBridge from "./NotificationsBridge";
import HamburgerMenu from "./HamburgerMenu";
import NotificationBell from "./NotificationBell";
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

  const environmentName = String(home?.name || "").trim() || estate?.name || homeLabel || "Home";
  const contextLine = [
    estate?.name ? String(estate.name) : null,
    homeLabel && homeLabel !== environmentName ? homeLabel : null,
    available_contexts.length > 1 ? "Multiple spaces" : "Resident scope",
  ].filter(Boolean).join(" · ");

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

        <div
          className={`relative z-10 flex-1 overflow-x-hidden px-3 sm:px-4 ${disableContentScroll ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{
            paddingTop: "calc(12px + var(--sat))",
            paddingBottom: disableContentScroll
              ? "calc(78px + var(--sab))"
              : "calc(88px + var(--sab) + var(--kb))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="oyi-living-page oyi-page-fade mx-auto w-full max-w-5xl">
            <section className="oyi-context-layer mb-3 rounded-[24px] px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="pt-0.5">
                    <HamburgerMenu />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-sky-100/58">{contextLine || "Living Intelligence OS"}</div>
                    <h1 className="mt-1 text-[17px] font-semibold tracking-tight text-white sm:text-xl">
                      {title || environmentName}
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">
                      {subtitle || "Home stable · Perimeter secure · Quiet monitoring active"}
                    </p>
                    {showBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="mt-2 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[11px] text-white/55 transition hover:bg-white/[0.075]"
                      >
                        Back
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <NotificationBell />
                  <div className="oyi-orb h-10 w-10" aria-hidden="true" />
                  {available_contexts.length > 1 ? (
                    <div className="hidden rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] text-sky-100 sm:block">
                      Switch
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {children}
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
