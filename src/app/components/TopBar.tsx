"use client";

import HamburgerMenu from "@/app/components/HamburgerMenu";
import NotificationBell from "@/app/components/NotificationBell";

export default function TopBar({
  title,
  rightSlot,
}: {
  title?: string;
  rightSlot?: React.ReactNode; // optional future: quick actions
}) {
  return (
    <header className="sticky top-0 z-[60] bg-zinc-950/70 backdrop-blur-xl border-b border-white/10">
      <div className="h-14 px-3 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          <HamburgerMenu />
          {title ? (
            <div className="text-sm font-semibold text-zinc-200 truncate">
              {title}
            </div>
          ) : null}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {rightSlot}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
