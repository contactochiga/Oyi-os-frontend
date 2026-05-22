"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiBell, FiBox, FiCheckCircle, FiHome, FiShield, FiTool, FiZap } from "react-icons/fi";
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

function notificationTone(item: any) {
  const value = `${item?.type || ""} ${item?.title || ""} ${item?.message || ""} ${item?.payload?.kind || ""}`.toLowerCase();
  if (value.includes("visitor") || value.includes("gate") || value.includes("access")) return { Icon: FiShield, label: "Access", cls: "text-sky-100 bg-sky-300/10 border-sky-300/15" };
  if (value.includes("maintenance") || value.includes("repair") || value.includes("service")) return { Icon: FiTool, label: "Service", cls: "text-amber-100 bg-amber-300/10 border-amber-300/15" };
  if (value.includes("ai") || value.includes("command") || value.includes("automation")) return { Icon: FiZap, label: "Oyi", cls: "text-blue-100 bg-blue-300/10 border-blue-300/15" };
  if (value.includes("package") || value.includes("delivery")) return { Icon: FiBox, label: "Delivery", cls: "text-violet-100 bg-violet-300/10 border-violet-300/15" };
  if (value.includes("security") || value.includes("motion") || value.includes("alert")) return { Icon: FiShield, label: "Security", cls: "text-rose-100 bg-rose-300/10 border-rose-300/15" };
  if (value.includes("done") || value.includes("success") || value.includes("restored")) return { Icon: FiCheckCircle, label: "Resolved", cls: "text-emerald-100 bg-emerald-300/10 border-emerald-300/15" };
  return { Icon: FiHome, label: "Home", cls: "text-white/75 bg-white/[0.06] border-white/10" };
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const upsert = useNotificationStore((s) => s.upsert);

  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef<number>(0);

  useEffect(() => setMounted(true), []);

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

  const visible = useMemo(() => {
    const seenInviteKeys = new Set<string>();
    const deduped: any[] = [];
    for (const item of items) {
      const inviteKey =
        item?.payload?.inviteId ||
        item?.payload?.invite_id ||
        item?.payload?.id ||
        null;
      if ((item?.type === "invite" || inviteKey) && inviteKey) {
        const key = String(inviteKey);
        if (seenInviteKeys.has(key)) continue;
        seenInviteKeys.add(key);
      }
      deduped.push(item);
      if (deduped.length >= 18) break;
    }
    return deduped;
  }, [items]);

  async function handleMarkRead(id: string) {
    const res: any = await markNotificationRead(id);
    if (res?.id) upsert(res);
  }

  const dropdown =
    mounted && open
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[219] bg-black/18 backdrop-blur-[7px]"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            />
            <div className="fixed inset-x-0 z-[220] px-3" style={{ top: "calc(58px + var(--sat))" }}>
              <div ref={rootRef} className="mx-auto flex max-w-5xl justify-end">
                <aside
                  className="oyi-notification-panel w-[min(360px,calc(100vw-20px))] overflow-hidden rounded-[28px] border border-white/10 bg-[#050a12]/88 shadow-[0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-2xl"
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
                  <div className="flex max-h-[min(68vh,560px)] flex-col">
                    <div className="border-b border-white/10 px-4 pb-3 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/50">Environment</div>
                          <div className="mt-1 truncate text-[15px] font-semibold text-white">Activity around you</div>
                          <div className="mt-0.5 truncate text-[11px] text-white/42">Access · service · Oyi · home signals</div>
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

                    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                      {visible.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm text-white/55">
                          Home is quiet. New visitor, service, Oyi and environmental signals will appear here.
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
                              <div key={n.id} className="space-y-1.5">
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
                          const tone = notificationTone(n);
                          const Icon = tone.Icon;

                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => handleMarkRead(n.id)}
                              className={`w-full rounded-[20px] border px-3 py-3 text-left transition ${
                                unread
                                  ? "border-white/14 bg-white/[0.075] hover:bg-white/[0.1]"
                                  : "border-white/10 bg-white/[0.038] hover:bg-white/[0.065]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${tone.cls}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/32">{tone.label}</span>
                                    {unread ? <span className="h-1.5 w-1.5 rounded-full bg-sky-200 shadow-[0_0_10px_rgba(125,211,252,0.8)]" /> : null}
                                  </div>
                                  <div className="mt-1 truncate text-[13px] font-semibold text-white/92">
                                    {n.title || "Home update"}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-[12px] leading-4 text-white/54">
                                    {n.message || ""}
                                  </div>
                                </div>
                                <div className="whitespace-nowrap text-[11px] text-white/34">
                                  {timeAgo(n.created_at)}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="rounded-b-[28px] border-t border-white/10 bg-white/[0.025] px-4 py-3">
                      <div className="text-[11px] text-white/38">Tap a signal to acknowledge it. Your current screen stays active.</div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative">
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
      {dropdown}
    </div>
  );
}
