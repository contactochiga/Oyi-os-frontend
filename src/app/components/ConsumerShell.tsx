"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import LayoutWrapper from "./LayoutWrapper";
import InviteSuggestionBridge from "./InviteSuggestionBridge";
import MessagesInboxButton from "./MessagesInboxButton";
import BottomNav from "./BottomNav";
import useActiveContext from "@/hooks/useActiveContext";
import { useRuntimeIntelligenceStore } from "@/store/useRuntimeIntelligenceStore";

const DEFAULT_HEADER_HEIGHT = 68;

export default function ConsumerShell({
  children,
  title,
  subtitle,
  strip = [],
  preStripSlot,
  // Pages opt into a strip only when its metrics support a resident decision.
  hideStrip = true,
  disableContentScroll = false,
  backHref,
  // Operational/list-heavy modules (Community, Activity, Visitors,
  // Maintenance, Cameras, Services, Messages) opt into more canvas at
  // laptop/desktop widths; reading-focused pages (Wallet, Security,
  // Support, Connected Systems, Proximity, Reports, Room, Watch) keep the
  // narrower default so text/forms stay comfortable rather than stretching
  // edge-to-edge.
  wide = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  strip?: Array<{ label: string; value: string | number }>;
  preStripSlot?: ReactNode;
  hideStrip?: boolean;
  disableContentScroll?: boolean;
  backHref?: string;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeContext = useActiveContext();
  const latestAwareness = useRuntimeIntelligenceStore((state) => state.latestAwareness);
  const latestRecommendations = useRuntimeIntelligenceStore((state) => state.latestRecommendations);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
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

  // The header is fixed (matching the canonical Devices/Profile treatment),
  // so it no longer reserves its own space in normal flow — measure its
  // real rendered height (which varies when a subtitle/strip/preStripSlot
  // is present) and pad the scroll container to match, rather than hiding
  // content underneath it.
  useEffect(() => {
    const node = headerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeaderHeight(Math.ceil(entry.contentRect.height) + 28);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#03070c] text-white md:left-[88px]">
        <div className="oyi-ambient-bg" />
        <InviteSuggestionBridge />

        <div ref={headerRef} className="fixed inset-x-0 z-[80] px-4 md:left-[88px] md:px-8" style={{ top: "calc(8px + var(--sat))" }}>
          <div className={`mx-auto w-full ${wide ? "max-w-[860px] lg:max-w-[1180px] xl:max-w-[1400px]" : "max-w-[860px] lg:max-w-[920px] xl:max-w-[980px]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {backHref ? (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined" && window.history.length > 1) router.back();
                        else router.push(backHref);
                      }}
                      aria-label="Back"
                      className="grid h-full w-full place-items-center rounded-full text-white/78 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h1 className="truncate text-[24px] font-semibold leading-none tracking-[-0.055em] text-white">
                    {title || "Oyi Home"}
                  </h1>
                  {subtitle ? (
                    <p className="mt-1 max-w-2xl truncate text-[12px] leading-5 text-white/50">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                  <MessagesInboxButton />
                </div>
              </div>
            </div>

            {preStripSlot ? <div className="mt-3">{preStripSlot}</div> : null}

            {!hideStrip ? (
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
            ) : null}
          </div>
        </div>

        <div
          className={`relative z-10 flex-1 overflow-x-hidden px-4 md:px-8 ${disableContentScroll ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{
            paddingTop: `calc(${headerHeight}px + var(--sat))`,
            paddingBottom: disableContentScroll
              ? "calc(78px + var(--sab))"
              : "calc(96px + var(--sab) + var(--kb))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className={`oyi-living-page oyi-page-fade mx-auto w-full pb-6 md:pb-10 ${wide ? "max-w-[860px] lg:max-w-[1180px] xl:max-w-[1400px]" : "max-w-[860px] lg:max-w-[920px] xl:max-w-[980px]"}`}>
            {children}
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
