"use client";

import TypingIndicator from "./TypingIndicator";
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";

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

function MiniStructuredCards({ cards, displayMode }: { cards?: Array<Record<string, any>>; displayMode?: string }) {
  if (!["list", "detail", "audit", "report", "awareness"].includes(String(displayMode || "conversation"))) return null;
  const visibleCards = (cards || []).filter((card) => !["capability", "capability_registry"].includes(String(card?.type || "")));
  if (!visibleCards.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {visibleCards.slice(0, 3).map((card, index) => {
        const items = Array.isArray(card.items) ? card.items : [];
        return (
          <div key={`${card.type || card.title || "card"}-${index}`} className="rounded-2xl border border-white/10 bg-black/18 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/45">{card.type ? String(card.type).replace(/_/g, " ") : "Summary"}</div>
            <div className="mt-1 text-xs font-semibold text-white/88">{card.title || "Home update"}</div>
            {card.summary ? <div className="mt-1 text-[11px] leading-4 text-white/52">{String(card.summary)}</div> : null}
            {items.length ? (
              <div className="mt-2 grid gap-1">
                {items.slice(0, 4).map((item: any, itemIndex: number) => (
                  <div key={itemIndex} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.035] px-2 py-1.5 text-[11px]">
                    <span className="min-w-0 break-words text-white/56">{item.title || item.label || "Item"}</span>
                    <span className="max-w-[48%] shrink-0 break-words text-right text-white/80">{item.value !== undefined ? String(item.value) : item.status || item.subtitle || ""}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MiniOperatingStatus({ execution }: { intent?: string; understood?: string; execution?: Record<string, any> }) {
  const results = Array.isArray(execution?.results) ? execution.results : [];
  const first = results[0] || {};
  const rawStatus = String(first.status || "").replace(/_/g, " ");
  if (!rawStatus) return null;
  const status = /denied/.test(rawStatus) ? "Action not available" : /failed|error/.test(rawStatus) ? "Action could not be completed" : /confirmation|pending/.test(rawStatus) ? "Confirmation needed" : /executed|success/.test(rawStatus) ? "Action completed" : "Action update";
  const tone =
    /denied|failed|error/.test(status)
      ? "border-rose-300/15 bg-rose-400/[0.055] text-rose-50/78"
      : /confirmation|pending/.test(status)
        ? "border-amber-300/15 bg-amber-400/[0.055] text-amber-50/80"
        : "border-cyan-300/14 bg-cyan-400/[0.055] text-cyan-50/80";
  return (
    <div className={`mt-2 rounded-2xl border p-2.5 ${tone}`}>
      <div className="text-[9px] font-medium uppercase tracking-[0.16em] opacity-75">{status}</div>
      {first.summary || first.error ? <div className="mt-1 text-[11px] leading-4 opacity-90">{String(first.summary || first.error)}</div> : null}
    </div>
  );
}

function MiniSources({ sources }: { sources?: Array<Record<string, any>> }) {
  const visibleSources = (sources || []).filter((source) => !/ai_tool|execution_ledger|capability registry/i.test(String(source?.label || source?.table || "")));
  if (!visibleSources.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visibleSources.slice(0, 3).map((source, index) => (
        <span key={`${source.label || "source"}-${index}`} className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-white/38">
          {source.label || "Source"}
        </span>
      ))}
    </div>
  );
}

function MiniSuggestedActions({ actions, onOpen }: { actions?: Array<Record<string, any>>; onOpen: (route: string) => void }) {
  const rows = (actions || []).filter((action) => action?.route && action?.label);
  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.slice(0, 4).map((action, index) => (
        <button key={`${action.route}-${index}`} type="button" onClick={() => onOpen(String(action.route))} className="rounded-full border border-cyan-200/15 bg-cyan-400/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-cyan-100/84 transition active:scale-95">
          {action.label}
        </button>
      ))}
    </div>
  );
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
  const router = useRouter();
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const spokenRef = useRef<Set<string>>(new Set());
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({
        block: "end",
        behavior: "smooth",
      })
    );
  }, [messages.length, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const keepLatestVisible = () => {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
    };
    window.visualViewport?.addEventListener("resize", keepLatestVisible);
    window.visualViewport?.addEventListener("scroll", keepLatestVisible);
    return () => {
      window.visualViewport?.removeEventListener("resize", keepLatestVisible);
      window.visualViewport?.removeEventListener("scroll", keepLatestVisible);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      return;
    }

    if (!voiceReplyEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const latestAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && !m.pending && String(m.content || "").trim().length > 0);

    if (!latestAssistant) return;
    if (spokenRef.current.has(latestAssistant.id)) return;

    spokenRef.current.add(latestAssistant.id);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(String(latestAssistant.content));
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, [messages, open, voiceReplyEnabled]);

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
            style={{ bottom: "var(--kb)", paddingBottom: "calc(10px + var(--sab))" }}
          >
            <div className="max-w-3xl mx-auto px-4">
              <div
                className="rounded-t-3xl border border-white/10 overflow-hidden flex flex-col"
                style={{
                  background: "rgba(10,12,18,0.86)",
                  backdropFilter: "blur(22px)",
                  WebkitBackdropFilter: "blur(22px)",
                  maxHeight: "min(82vh, calc(100dvh - 24px - var(--sat) - var(--kb)))",
                }}
              >
                {/* HEADER */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/80">
                    <div className="h-7 w-7 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-cyan-200" />
                    </div>
                    <div className="text-xs text-white/55">I&apos;m Oyi, how can I help?</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVoiceReplyEnabled((v) => !v)}
                      className="rounded-xl px-2.5 py-2 text-white/70 hover:bg-white/5 border border-white/10 bg-white/5"
                      aria-label={voiceReplyEnabled ? "Disable assistant voice" : "Enable assistant voice"}
                      title={voiceReplyEnabled ? "Assistant voice on" : "Assistant voice off"}
                    >
                      {voiceReplyEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl px-2.5 py-2 text-white/70 hover:bg-white/5 border border-white/10 bg-white/5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* SUGGESTIONS */}
                <div className="px-4 pt-3">
                  <DynamicSuggestionCard onSend={(t) => onSend(t)} />
                </div>

                {/* MESSAGES */}
                <div
                  ref={scrollRef}
                  className="px-4 pt-3 overflow-y-auto flex-1"
                  style={{
                    minHeight: 0,
                    WebkitOverflowScrolling: "touch",
                    paddingBottom: "calc(92px + var(--sab))",
                    scrollPaddingBottom: "calc(156px + var(--sab) + var(--kb))",
                  }}
                >
                  <div className="space-y-3 pb-12">
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
                              {m.role === "assistant" ? (
                                <>
                                  <MiniStructuredCards cards={m.cards} displayMode={m.display_mode} />
                                  <MiniOperatingStatus execution={m.execution} />
                                  <MiniSources sources={m.sources} />
                                  <MiniSuggestedActions actions={m.suggested_actions} onOpen={(route) => router.push(route)} />
                                </>
                              ) : null}
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
                <div className="shrink-0 border-t border-white/10 bg-[rgba(8,12,20,0.96)] px-4 py-3" style={{ paddingBottom: "calc(12px + var(--sab))" }}>
                  <ChatFooter
                    input={input}
                    setInput={setInput}
                    onSend={onSend}
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
