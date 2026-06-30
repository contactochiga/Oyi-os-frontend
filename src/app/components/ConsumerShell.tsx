"use client";

import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";

import LayoutWrapper from "./LayoutWrapper";
import InviteSuggestionBridge from "./InviteSuggestionBridge";
import HamburgerMenu from "./HamburgerMenu";
import MessagesInboxButton from "./MessagesInboxButton";
import BottomNav from "./BottomNav";
import useActiveContext from "@/hooks/useActiveContext";
import { useRuntimeIntelligenceStore } from "@/store/useRuntimeIntelligenceStore";

export default function ConsumerShell({
  children,
  title,
  subtitle,
  strip = [],
  disableContentScroll = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  strip?: Array<{ label: string; value: string | number }>;
  disableContentScroll?: boolean;
}) {
  const pathname = usePathname();
  const activeContext = useActiveContext();
  const latestAwareness = useRuntimeIntelligenceStore((state) => state.latestAwareness);
  const latestRecommendations = useRuntimeIntelligenceStore((state) => state.latestRecommendations);
  const defaultStrip = useMemo(() => {
    const contextLabel = String(
      activeContext.home?.name ||
        [activeContext.home?.block, activeContext.home?.unit].filter(Boolean).join(" / ") ||
        activeContext.estate?.name ||
        "Context pending",
    );
    const runtimeLabel = latestAwareness?.severity
      ? String(latestAwareness.severity).replace(/^\w/, (value: string) => value.toUpperCase())
      : "Live";
    const moduleLabel = String(pathname || "/")
      .replace(/^\//, "")
      .split("/")[0]
      .replace(/-/g, " ") || "home";
    return [
      { label: "Context", value: contextLabel },
      { label: "Runtime", value: runtimeLabel },
      { label: "Module", value: moduleLabel.replace(/^\w/, (value) => value.toUpperCase()) },
      { label: "Action", value: latestRecommendations[0]?.title || "Ask Oyi" },
    ];
  }, [activeContext.estate?.name, activeContext.home?.block, activeContext.home?.name, activeContext.home?.unit, latestAwareness?.severity, latestRecommendations, pathname]);
  const stripItems = strip.length ? strip : defaultStrip;

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#03070c] text-white">
        <div className="oyi-ambient-bg" />
        <InviteSuggestionBridge />

        <div
          className={`relative z-10 flex-1 overflow-x-hidden px-4 ${disableContentScroll ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{
            paddingTop: "calc(14px + var(--sat))",
            paddingBottom: disableContentScroll
              ? "calc(78px + var(--sab))"
              : "calc(96px + var(--sab) + var(--kb))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="oyi-living-page oyi-page-fade mx-auto w-full max-w-[860px]">
            <header className="mb-3.5 px-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="pt-0.5">
                    <HamburgerMenu />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h1 className="text-[26px] font-semibold leading-none tracking-[-0.055em] text-white sm:text-[29px]">
                      {title || "Oyi Home"}
                    </h1>
                    <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-white/50">
                      {subtitle || "Your living environment."}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MessagesInboxButton />
                  <div className="hidden h-10 w-10 sm:block">
                    <div className="oyi-orb h-10 w-10" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] px-2.5 py-2 shadow-[0_12px_38px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {stripItems.slice(0, 6).map((item) => (
                    <div
                      key={`${item.label}:${item.value}`}
                      className="min-w-[118px] shrink-0 snap-start rounded-[16px] border border-white/[0.05] bg-white/[0.028] px-3 py-2"
                    >
                      <div className="text-[9px] uppercase tracking-[0.16em] text-white/32">
                        {item.label}
                      </div>
                      <div className="mt-1 text-[13px] font-semibold leading-4 tracking-[-0.03em] text-white/88">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </header>

            {children}
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
