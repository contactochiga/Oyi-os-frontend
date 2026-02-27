"use client";

import TypingIndicator from "./TypingIndicator";
import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";

import DynamicSuggestionCard from "@/app/components/DynamicSuggestionCard";
import ChatFooter from "@/app/components/ChatFooter";
import RemotePanelRenderer from "@/app/components/remotes/RemotePanelRenderer";
import DeviceDiscoveryPanel from "@/app/components/remotes/DeviceDiscoveryPanel";

import type { ChatMessage } from "./types";

function devKey(d: any) {
  return String(d?.id || d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.uuid || "");
}
function devLabel(d: any) {
  return d?.name || d?.type || d?.category || "Device";
}
function devSub(d: any) {
  const vendor = d?.vendor || d?.adapter || "";
  const room = d?.room_name || d?.room || null;
  const id = d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.uuid || null;

  return [vendor ? String(vendor) : null, room ? `room:${room}` : null, id ? `id:${id}` : null]
    .filter(Boolean)
    .join(" • ");
}

export default function AiConsoleSheet(props: {
  open: boolean;
  onClose: () => void;

  input: string;
  setInput: (v: string) => void;

  messages: ChatMessage[];
  onSend: (text?: string) => void;

  assignedDevices: any[];
  discoveryDevices: any[];
  devicesTab: "assigned" | "discovery";
  setDevicesTab: (v: "assigned" | "discovery") => void;
  devicesBusy: boolean;
  devicesErr: string | null;
  refreshDevicePanelData: () => Promise<void>;
}) {
  const {
    open,
    onClose,
    input,
    setInput,
    messages,
    onSend,
    assignedDevices,
    discoveryDevices,
    devicesTab,
    setDevicesTab,
    devicesBusy,
    devicesErr,
    refreshDevicePanelData,
  } = props;

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
  }, [messages.length, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[120]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="absolute left-0 right-0 bottom-0"
            style={{ paddingBottom: "calc(10px + var(--sab))" }}
          >
            <div className="max-w-3xl mx-auto px-4">
              <div
                className="rounded-t-3xl border border-white/10 overflow-hidden"
                style={{ background: "rgba(10,12,18,0.86)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}
              >
                {/* header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-white/70" />
                      Oyi Assistant
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">Chat • Panels • Commands</div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-2.5 py-2 text-white/70 hover:bg-white/5 border border-white/10 bg-white/5"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* suggestions */}
                <div className="px-4 pt-3">
                  <DynamicSuggestionCard onSend={(t) => onSend(t)} />
                </div>

                {/* messages */}
                <div className="px-4 pt-3 overflow-y-auto" style={{ height: "min(54vh, 520px)", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
                  <div className="space-y-3 pb-4">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[86%]">
                          <div
                            className="px-4 py-2 rounded-2xl border border-white/10"
                            style={
                              m.role === "user"
                                ? {
                                    background:
                                      "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                                    color: "white",
                                    boxShadow: "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                                  }
                                : {
                                    background: "rgba(255,255,255,0.06)",
                                    color: "rgba(255,255,255,0.92)",
                                    backdropFilter: "blur(14px)",
                                    WebkitBackdropFilter: "blur(14px)",
                                    boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
                                  }
                            }
                          >
                            {m.content}
                          </div>

                          {/* panel slot */}
                          {m.panel ? (
                            <div className="mt-3">
                              {m.panel === "devices" ? (
                                <div className="space-y-3">
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-xs text-white/60">
                                        Assigned: <span className="text-white/85 font-semibold">{assignedDevices.length}</span> • Discovery:{" "}
                                        <span className="text-white/85 font-semibold">{discoveryDevices.length}</span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={refreshDevicePanelData}
                                        disabled={devicesBusy}
                                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] text-white/80 border border-white/10 disabled:opacity-50"
                                      >
                                        {devicesBusy ? "Refreshing…" : "Refresh"}
                                      </button>
                                    </div>

                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setDevicesTab("assigned")}
                                        className={`py-2 rounded-xl text-xs border transition ${
                                          devicesTab === "assigned"
                                            ? "bg-white text-black border-white/20"
                                            : "bg-white/5 text-white/75 border-white/10 hover:bg-white/10"
                                        }`}
                                      >
                                        Assigned
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDevicesTab("discovery")}
                                        className={`py-2 rounded-xl text-xs border transition ${
                                          devicesTab === "discovery"
                                            ? "bg-white text-black border-white/20"
                                            : "bg-white/5 text-white/75 border-white/10 hover:bg-white/10"
                                        }`}
                                      >
                                        Discovery
                                      </button>
                                    </div>

                                    {devicesErr ? (
                                      <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                        {devicesErr}
                                      </div>
                                    ) : null}
                                  </div>

                                  {devicesTab === "assigned" ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs text-white/70 font-semibold">Devices in your home</div>
                                        <div className="text-[11px] text-white/45">(saved to DB)</div>
                                      </div>

                                      <div className="mt-3 space-y-2">
                                        {assignedDevices.map((d) => {
                                          const k = devKey(d) || Math.random().toString(36).slice(2);
                                          return (
                                            <div key={k} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                                              <div className="min-w-0">
                                                <div className="text-[13px] text-white/90 font-semibold truncate">{devLabel(d)}</div>
                                                <div className="text-[11px] text-white/45 truncate">{devSub(d) || "—"}</div>
                                              </div>

                                              <div className="text-[11px] text-white/45 shrink-0">
                                                {d?.status ? String(d.status) : typeof d?.online === "boolean" ? (d.online ? "Online" : "Offline") : ""}
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {!devicesBusy && assignedDevices.length === 0 ? (
                                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                                            No assigned devices yet. Go to <span className="text-white/80 font-semibold">Discovery</span> to bind devices.
                                          </div>
                                        ) : null}

                                        {devicesBusy ? (
                                          <div className="flex items-center gap-3 text-xs text-white/50">
                                            <div className="w-4 h-4 border-2 border-white/15 border-t-white/70 rounded-full animate-spin" />
                                            Loading assigned devices…
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <DeviceDiscoveryPanel devices={discoveryDevices} onInteraction={refreshDevicePanelData} />
                                  )}
                                </div>
                              ) : (
                                <RemotePanelRenderer panel={m.panel} deviceId={m.deviceId} lastUpdated={m.lastUpdated} onInteraction={() => {}} />
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </div>

                {/* footer */}
                <div className="border-t border-white/10 px-4 py-3">
                  <ChatFooter input={input} setInput={setInput} onSend={() => onSend()} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
