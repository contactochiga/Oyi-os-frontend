"use client";

import { ReactNode } from "react";

import LayoutWrapper from "./LayoutWrapper";
import InviteSuggestionBridge from "./InviteSuggestionBridge";
import HamburgerMenu from "./HamburgerMenu";
import MessagesInboxButton from "./MessagesInboxButton";
import BottomNav from "./BottomNav";

export default function ConsumerShell({
  children,
  title,
  subtitle,
  disableContentScroll = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  disableContentScroll?: boolean;
}) {
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
