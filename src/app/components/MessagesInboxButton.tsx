"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import messagesService from "@/services/messagesService";

export default function MessagesInboxButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { ready, token } = useAuth() as any;
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    if (!ready || !token) {
      setUnread(null);
      return;
    }

    let alive = true;
    async function refresh() {
      try {
        const inbox = await messagesService.listInbox();
        if (!alive) return;
        const total = (Array.isArray(inbox) ? inbox : []).reduce(
          (sum, thread: any) => sum + Number(thread?.unread_count || 0),
          0,
        );
        setUnread(total);
      } catch {
        if (alive) setUnread(null);
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [ready, token]);

  return (
    <button
      type="button"
      onClick={() => router.push("/messages")}
      aria-label="Open messages"
      title="Messages"
      className={`relative grid h-full w-full place-items-center rounded-full text-white/74 transition hover:bg-white/[0.055] hover:text-white active:scale-[0.98] ${className}`}
    >
      <Inbox className="h-5 w-5" />
      {typeof unread === "number" && unread > 0 ? (
        <span className="absolute right-2 top-2 min-w-[16px] rounded-full bg-sky-400 px-1 text-center text-[9px] font-semibold leading-4 text-black shadow-[0_0_12px_rgba(56,189,248,0.85)]">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}
