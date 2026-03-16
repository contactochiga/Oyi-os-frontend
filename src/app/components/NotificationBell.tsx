"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiBell } from "react-icons/fi";
import { markNotificationRead } from "@/services/notificationsService";
import { useNotificationStore } from "@/store/useNotificationStore";
import InviteRequestCard from "@/app/components/InviteRequestCard";

function timeAgo(ts?: string) {
  if (!ts) return "";
  const t = new Date(ts).getTime();
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 10) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const upsert = useNotificationStore((s) => s.upsert);

  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const visible = useMemo(() => items.slice(0, 30), [items]);

  async function handleMarkRead(id: string) {
    const res: any = await markNotificationRead(id);
    if (res?.id) upsert(res);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative p-2 rounded-xl hover:bg-white/10 text-white/80"
        aria-label="Open notifications"
      >
        <FiBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-black text-[11px] flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open ? (
        <aside
          className="absolute right-0 top-[calc(100%+10px)] z-[220] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[28px] border border-white/10 bg-[#06080e]/97 shadow-[0_28px_80px_rgba(0,0,0,0.45)]"
          onTouchStart={(e) => {
            dragStartX.current = e.touches[0]?.clientX ?? null;
            dragDelta.current = 0;
          }}
          onTouchMove={(e) => {
            if (dragStartX.current === null) return;
            const x = e.touches[0]?.clientX ?? 0;
            dragDelta.current = x - dragStartX.current;
          }}
          onTouchEnd={() => {
            if (dragDelta.current > 55) setOpen(false);
            dragStartX.current = null;
            dragDelta.current = 0;
          }}
        >
          <div className="flex flex-col max-h-[min(72vh,640px)]">
                <div className="px-4 pt-4 pb-3 border-b border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-white truncate">
                        Notifications
                      </div>
                      <div className="text-[11px] text-white/45 truncate">
                        Updates • invites • estate activity
                      </div>
                    </div>

                    <button
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-3 py-2 text-[13px] text-white/70 hover:bg-white/10"
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {visible.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                      No notifications yet.
                    </div>
                  ) : (
                    visible.map((n: any) => {
                      const isInvite = n.type === "invite" || n.payload?.inviteId;

                      if (isInvite) {
                        const inviteStatus =
                          String(
                            n.payload?.status ||
                            n.payload?.home_membership_status ||
                            (n.status === "read" ? "accepted" : "pending")
                          ).toLowerCase();
                        const invite = {
                          id:
                            n.payload?.inviteId ||
                            n.payload?.invite_id ||
                            n.payload?.id ||
                            n.id,
                          estate_id: n.payload?.estate_id || n.payload?.estateId,
                          home_id: n.payload?.home_id || n.payload?.homeId,
                          role: n.payload?.role || "member",
                          status: inviteStatus,
                          invited_email: n.payload?.invited_email,
                        };

                        return (
                          <div key={n.id} className="space-y-2">
                            <InviteRequestCard
                              invite={invite as any}
                              readOnly={inviteStatus !== "pending"}
                              onDone={async () => {
                                await handleMarkRead(n.id);
                              }}
                            />
                            <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
                              <span>{timeAgo(n.created_at)}</span>
                              {n.status !== "read" ? (
                                <button
                                  onClick={() => handleMarkRead(n.id)}
                                  className="hover:text-white/70"
                                  type="button"
                                >
                                  Mark read
                                </button>
                              ) : (
                                <span>Read</span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const unread = n.status !== "read";

                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className={`w-full text-left rounded-2xl border px-4 py-3 transition
                            ${
                              unread
                                ? "border-white/15 bg-white/10 hover:bg-white/12"
                                : "border-white/10 bg-white/5 hover:bg-white/7"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-white truncate">
                                {n.title || "Update"}
                              </div>
                              <div className="mt-1 text-[12px] text-white/70">
                                {n.message || ""}
                              </div>
                            </div>
                            <div className="text-[11px] text-white/40 whitespace-nowrap">
                              {timeAgo(n.created_at)}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="px-4 py-3 border-t border-white/10 bg-white/[0.03] rounded-b-[28px]">
                  <div className="text-[11px] text-white/40">
                    Tip: tap a card to mark it read.
                  </div>
                </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
