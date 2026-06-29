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
            <header className="mb-4 flex items-start justify-between gap-3 px-0.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="pt-0.5">
                  <HamburgerMenu />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h1 className="text-[28px] font-semibold leading-none tracking-[-0.055em] text-white sm:text-[31px]">
                    {title || "Oyi Home"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-[13px] leading-5 text-white/54">
                    {subtitle || "Your living environment."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {stripItems.slice(0, 4).map((item) => (
                      <span key={`${item.label}:${item.value}`} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/56">
                        <span className="text-white/34">{item.label}</span> {item.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <MessagesInboxButton />
                <div className="hidden h-10 w-10 sm:block">
                  <div className="oyi-orb h-10 w-10" aria-hidden="true" />
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
