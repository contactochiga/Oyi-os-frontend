// src/app/components/TopBar.tsx
"use client";

import Image from "next/image";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";

export default function TopBar() {
  return (
    <header
      className="
        fixed left-0 right-0 z-[80]
        border-b border-white/10
        bg-[#0B1220]/95
        backdrop-blur-xl
      "
      style={{
        top: 0,
        height: "calc(64px + var(--sat))",
        paddingTop: "var(--sat)",
        isolation: "isolate",
        transform: "translateZ(0)",
      }}
    >
      <div className="flex h-16 w-full items-center px-4">
        <div className="flex items-center gap-3">
          <HamburgerMenu />

          <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-black/20">
            <Image
              src="/oyi-logo-transparent.png"
              alt="Oyi"
              width={32}
              height={32}
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </div>

        <div className="flex-1" />

        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <MessagesInboxButton />
        </div>
      </div>
    </header>
  );
}
