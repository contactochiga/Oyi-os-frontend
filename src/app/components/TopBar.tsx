// src/app/components/TopBar.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import NotificationBell from "@/app/components/NotificationBell";
import { ChatBubbleOvalLeftEllipsisIcon } from "@heroicons/react/24/outline";
import messagesService from "@/services/messagesService";

export default function TopBar() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  async function refreshUnread() {
    try {
      const list = await messagesService.listInbox();
      const total = (Array.isArray(list) ? list : []).reduce(
        (acc: number, t: any) => acc + Number(t?.unread_count || 0),
        0
      );
      setUnread(total);
    } catch {
      setUnread(0);
    }
  }

  useEffect(() => {
    refreshUnread();
    const tm = window.setInterval(refreshUnread, 15000);
    return () => window.clearInterval(tm);
  }, []);

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
      <div className="h-16 w-full px-4 flex items-center">
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

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <NotificationBell />

          <button
            type="button"
            onClick={() => router.push("/messages")}
            className="rounded-lg p-2 hover:bg-white/10 transition active:scale-[0.98] relative"
            aria-label="Messages"
            title="Messages"
          >
            <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-zinc-300" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 min-w-[16px] h-4 rounded-full bg-cyan-500/90 px-1 text-[10px] leading-4 text-black font-semibold text-center">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}
