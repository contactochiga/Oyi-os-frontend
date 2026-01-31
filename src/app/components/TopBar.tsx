"use client";

import Image from "next/image";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import NotificationBell from "@/app/components/NotificationBell";

export default function TopBar() {
  return (
    <header
      className="
        fixed top-0 left-0 right-0 z-[80]
        h-16 w-full
        border-b border-white/10
        bg-[#0B1220]/95
        backdrop-blur-xl
      "
    >
      <div className="h-full w-full px-4 flex items-center justify-between">
        {/* LEFT */}
        <div className="flex items-center gap-2">
          <HamburgerMenu />
        </div>

        {/* CENTER (Logo + Name) */}
        <div className="flex items-center gap-2 select-none">
          <div className="h-8 w-8 rounded-lg overflow-hidden border border-white/10 bg-black/20">
            <Image
              src="/oyi-logo-transparent.png"
              alt="Oyi"
              width={32}
              height={32}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white tracking-wide">
              OYI
            </div>
            <div className="text-[11px] text-white/50">Control</div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
