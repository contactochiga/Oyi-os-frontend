"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiBell } from "react-icons/fi";
import { markNotificationRead } from "@/services/notificationsService";
import { useNotificationStore } from "@/store/useNotificationStore";
import InviteRequestCard from "@/app/components/InviteRequestCard"; // you already have this

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const upsert = useNotificationStore((s) => s.upsert);

  // mount-safe for portal
  useState(() => {
    if (typeof window !== "undefined") setMounted(true);
  });

  const visible = useMemo(() => {
    // show latest first, keep max 30 in UI
    return items.slice(0, 30);
  }, [items]);

  async function handleMarkRead(id: string) {
    const res: any = await markNotificationRead(id);
    if (res?.id) upsert(res);
  }

  const OVERLAY_Z = 2147483646;
  const DRAWER_Z = 2147483647;

  const drawer =
    mounted && open
      ? createPortal(
          <>
            <div
              className="fixed inset-0"
              style={{
                zIndex: OVERLAY_Z,
                backgroundColor: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }}
              onClick={() => setOpen(false)}
              aria-label="Close notifications overlay"
            />

            <aside
              className="fixed inset-y-0 right-0 w-[360px] max-w-[92vw] bg-zinc-950 border-l border-white/10"
              style={{ zIndex: DRAWER_Z }}
            >
              <div className="flex h-[100dvh] flex-col">
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                  <div className="text-white font-semibold">Notifications</div>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {visible.length === 0 ? (
                    <div className="text-sm text-white/60">
                      No notifications yet.
                    </div>
                  ) : (
                    visible.map((n: any) => {
                      const isInvite = n.type === "invite" || n.payload?.inviteId;

                      // ✅ invite notification becomes action card (accept/decline)
                      if (isInvite) {
                        const invite = {
                          id: n.payload?.inviteId || n.payload?.invite_id || n.payload?.id || n.id,
                          estate_id: n.payload?.estate_id || n.payload?.estateId,
                          home_id: n.payload?.home_id || n.payload?.homeId,
                          role: n.payload?.role || "member",
                          status: "pending",
                          invited_email: n.payload?.invited_email,
                        };

                        return (
                          <div key={n.id} className="space-y-2">
                            <InviteRequestCard
                              invite={invite as any}
                              onDone={async () => {
                                // mark notification as read when action done
                                await handleMarkRead(n.id);
                              }}
                            />
                            <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
                              <span>{timeAgo(n.created_at)}</span>
                              {n.status !== "read" ? (
                                <button
                                  onClick={() => handleMarkRead(n.id)}
                                  className="hover:text-white/70"
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

                      // ✅ normal notification card
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                            n.status !== "read"
                              ? "border-white/15 bg-white/7 hover:bg-white/10"
                              : "border-white/10 bg-white/5 hover:bg-white/7"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">
                                {n.title || "Update"}
                              </div>
                              <div className="mt-1 text-xs text-white/70">
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
              </div>
            </aside>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-lg hover:bg-white/10 text-zinc-200"
        aria-label="Open notifications"
      >
        <FiBell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D2E] text-white text-[11px] flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {drawer}
    </>
  );
}
