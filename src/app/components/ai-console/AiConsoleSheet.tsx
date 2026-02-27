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
  return String(
    d?.id ||
      d?.external_id ||
      d?.externalId ||
      d?.device_id ||
      d?.dev_id ||
      d?.uuid ||
      ""
  );
}
function devLabel(d: any) {
  return d?.name || d?.type || d?.category || "Device";
}
function devSub(d: any) {
  const vendor = d?.vendor || d?.adapter || "";
  const room = d?.room_name || d?.room || null;
  const id =
    d?.external_id ||
    d?.externalId ||
    d?.device_id ||
    d?.dev_id ||
    d?.uuid ||
    null;

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
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({
        block: "end",
        behavior: "smooth",
      })
    );
  }, [messages.length, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
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
                style={{
                  background: "rgba(10,12,18,0.86)",
                  backdropFilter: "blur(22px)",
                  WebkitBackdropFilter: "blur(22px)",
                }}
              >
                {/* HEADER */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-white/70" />
                      Oyi Assistant
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">
                      Chat • Panels • Commands
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-2.5 py-2 text-white/70 hover:bg-white/5 border border-white/10 bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* SUGGESTIONS */}
                <div className="px-4 pt-3">
                  <DynamicSuggestionCard onSend={(t) => onSend(t)} />
                </div>

                {/* MESSAGES */}
                <div
                  className="px-4 pt-3 overflow-y-auto"
                  style={{
                    height: "min(54vh, 520px)",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div className="space-y-3 pb-4">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div className="max-w-[86%]">
                          {/* TYPING STATE */}
                          {m.pending ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              <TypingIndicator />
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                              className="px-4 py-2 rounded-2xl border border-white/10"
                              style={
                                m.role === "user"
                                  ? {
                                      background:
                                        "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                                      color: "white",
                                      boxShadow:
                                        "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                                    }
                                  : {
                                      background:
                                        "rgba(255,255,255,0.06)",
                                      color:
                                        "rgba(255,255,255,0.92)",
                                      backdropFilter:
                                        "blur(14px)",
                                      WebkitBackdropFilter:
                                        "blur(14px)",
                                      boxShadow:
                                        "0 10px 26px rgba(0,0,0,0.18)",
                                    }
                              }
                            >
                              {m.content}
                            </motion.div>
                          )}

                          {/* PANEL SLOT */}
                          {!m.pending && m.panel && (
                            <div className="mt-3">
                              {m.panel === "devices" ? (
                                <div className="space-y-3">
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
                                    Assigned:{" "}
                                    <span className="text-white font-semibold">
                                      {assignedDevices.length}
                                    </span>{" "}
                                    • Discovery:{" "}
                                    <span className="text-white font-semibold">
                                      {discoveryDevices.length}
                                    </span>
                                  </div>

                                  {devicesTab === "assigned" ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                                      {assignedDevices.map((d) => (
                                        <div
                                          key={
                                            devKey(d) ||
                                            Math.random()
                                              .toString(36)
                                              .slice(2)
                                          }
                                          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80"
                                        >
                                          <div className="font-semibold">
                                            {devLabel(d)}
                                          </div>
                                          <div className="text-white/45">
                                            {devSub(d) || "—"}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <DeviceDiscoveryPanel
                                      devices={discoveryDevices}
                                      onInteraction={
                                        refreshDevicePanelData
                                      }
                                    />
                                  )}
                                </div>
                              ) : (
                                <RemotePanelRenderer
                                  panel={m.panel}
                                  deviceId={m.deviceId}
                                  lastUpdated={m.lastUpdated}
                                  onInteraction={() => {}}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </div>

                {/* FOOTER */}
                <div className="border-t border-white/10 px-4 py-3">
                  <ChatFooter
                    input={input}
                    setInput={setInput}
                    onSend={() => onSend()}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
