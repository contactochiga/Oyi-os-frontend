// src/app/components/TopBar.tsx
"use client";

import Image from "next/image";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import NotificationBell from "@/app/components/NotificationBell";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

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
      <div className="h-full w-full px-4 flex items-center">
        {/* LEFT: hamburger + logo */}
        <div className="flex items-center gap-3">
          <HamburgerMenu />

          <div className="h-8 w-8 rounded-lg overflow-hidden border border-white/10 bg-black/20">
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

        {/* CENTER: keep empty (prevents logo centering) */}
        <div className="flex-1" />

        {/* RIGHT: notifications + 3-dots */}
        <div className="flex items-center gap-2">
          <NotificationBell />

          <button
            type="button"
            className="rounded-lg p-2 hover:bg-white/10 transition"
            aria-label="More options"
            onClick={() => {
              // later: open menu/modal
              // console.log("More options");
            }}
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-zinc-300" />
          </button>
        </div>
      </div>
    </header>
  );
}
