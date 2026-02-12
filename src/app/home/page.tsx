// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import TopBar from "../components/TopBar";

import LayoutWrapper from "../components/LayoutWrapper";
import ChatFooter from "../components/ChatFooter";
import DynamicSuggestionCard from "../components/DynamicSuggestionCard";

import RemotePanelRenderer from "../components/remotes/RemotePanelRenderer";
import DeviceDiscoveryPanel from "../components/remotes/DeviceDiscoveryPanel";

import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

import useAuth from "../../hooks/useAuth";
import { useEventStore } from "../../store/useEventStore";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  panel?: string | null;
  deviceId?: string;
  time: string;
  lastUpdated: number;
  pending?: boolean;
};

type DeviceAction =
  | {
      type: "device.command";
      deviceId: string;
      command: Record<string, any>;
    }
  | {
      type: "open.panel";
      panel: string;
      deviceId?: string;
    };

function nowMeta() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    stamp: now.getTime(),
  };
}

function createId() {
  return Math.random().toString(36).slice(2, 9);
}

function inferPanel(aiPanel?: string | null, userText?: string): string | null {
  const src = `${aiPanel || ""} ${userText || ""}`
    .toLowerCase()
    .replace(/[^\w\s]/g, "");

  if (
    src.includes("home") ||
    src.includes("house") ||
    src.includes("summary") ||
    src.includes("overview") ||
    src.includes("status") ||
    src.includes("whats happening") ||
    src.includes("what's happening")
  )
    return "home";

  if (
    src.includes("room") ||
    src.includes("bedroom") ||
    src.includes("kitchen") ||
    src.includes("living room")
  )
    return "rooms";

  if (
    src.includes("visitor") ||
    src.includes("guest") ||
    src.includes("expecting") ||
    src.includes("delivery") ||
    src.includes("gate pass")
  )
    return "visitor";

  if (
    src.includes("door") ||
    src.includes("lock") ||
    src.includes("unlock") ||
    src.includes("front door")
  )
    return "door";

  if (src.includes("cctv") || src.includes("camera") || src.includes("surveillance"))
    return "cctv";

  if (
    src.includes("sensor") ||
    src.includes("motion") ||
    src.includes("smoke") ||
    src.includes("gas") ||
    src.includes("alert")
  )
    return "sensors";

  if (
    src.includes("maintenance") ||
    src.includes("repair") ||
    src.includes("fix") ||
    src.includes("issue") ||
    src.includes("support")
  )
    return "maintenance";

  if (
    src.includes("wallet") ||
    src.includes("payment") ||
    src.includes("balance") ||
    src.includes("fund")
  )
    return "wallet";

  if (
    src.includes("utility") ||
    src.includes("electric") ||
    src.includes("power") ||
    src.includes("water") ||
    src.includes("internet") ||
    src.includes("rent")
  )
    return "utilities";

  if (
    src.includes("community") ||
    src.includes("announcement") ||
    src.includes("estate news") ||
    src.includes("notice")
  )
    return "community";

  if (src.includes("light")) return "light";
  if (src.includes("ac") || src.includes("air conditioner") || src.includes("air"))
    return "ac";
  if (src.includes("tv") || src.includes("television")) return "tv";

  // ✅ include “discover” to force devices panel intent
  if (
    src.includes("device") ||
    src.includes("appliance") ||
    src.includes("discover") ||
    src.includes("pair") ||
    src.includes("bind") ||
    src.includes("add device") ||
    src.includes("connect device")
  )
    return "devices";

  return null;
}

function getSuggestionTitle(panel: string): string {
  switch (panel) {
    case "home":
      return "View home summary";
    case "rooms":
      return "Manage rooms";
    case "visitor":
      return "Manage visitors";
    case "door":
      return "Door access";
    case "wallet":
      return "Open wallet";
    case "utilities":
      return "View utilities";
    case "maintenance":
      return "Report maintenance issue";
    case "community":
      return "Community updates";
    case "light":
      return "Control lights";
    case "ac":
      return "Adjust air conditioner";
    case "tv":
      return "Control TV";
    case "cctv":
      return "View CCTV";
    case "sensors":
      return "View sensors";
    case "devices":
      return "Devices & Discovery";
    default:
      return "Continue";
  }
}

function shouldOpenPanel(userText: string, panel: string | null) {
  if (!panel) return false;

  const MANAGEMENT = new Set([
    "home",
    "rooms",
    "visitor",
    "wallet",
    "utilities",
    "maintenance",
    "community",
    "devices",
    "cctv",
    "sensors",
  ]);

  const t = (userText || "").toLowerCase();

  // ✅ explicit request words → open panel
  const explicit =
    t.includes("open") ||
    t.includes("show") ||
    t.includes("manage") ||
    t.includes("panel") ||
    t.includes("settings") ||
    t.includes("list") ||
    t.includes("view") ||
    // ✅ onboarding intents
    t.includes("discover") ||
    t.includes("add device") ||
    t.includes("add devices") ||
    t.includes("bind device") ||
    t.includes("bind devices") ||
    t.includes("pair device") ||
    t.includes("pair devices") ||
    t.includes("connect device") ||
    t.includes("connect devices");

  if (explicit && MANAGEMENT.has(panel)) return true;

  // For command-type stuff like “turn on light”, do NOT auto-open panel
  return false;
}

async function executeActions(actions: DeviceAction[] | undefined) {
  if (!actions?.length) return;

  for (const a of actions) {
    try {
      if (a.type === "device.command") {
        await deviceService.commandDevice(a.deviceId, a.command);
      }
    } catch {
      // swallow errors
    }
  }
}

function isSamePanelInstance(m: ChatMessage, panel: string, deviceId?: string) {
  if (!m.panel) return false;
  if (m.panel !== panel) return false;

  // devices panel is global
  if (panel === "devices") return true;

  // other panels can be per-device; if deviceId is missing, treat as same “type”
  if (!deviceId) return true;

  return m.deviceId === deviceId;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");

  // ✅ device panel data: separate discovery vs assigned
  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content: "Hello! I’m Oyi — how can I help?",
      ...nowMeta(),
      lastUpdated: Date.now(),
    },
  ]);

  const estateId = useMemo(() => {
    return (
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null)
    );
  }, [(user as any)?.estate_id]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ✅ Jump to latest message without moving footer
  useEffect(() => {
    const a = requestAnimationFrame(() => {
      const b = requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      });
      return () => cancelAnimationFrame(b);
    });
    return () => cancelAnimationFrame(a);
  }, [messages.length]);

  // ✅ helper: refresh both assigned + discovery
  async function refreshDevicePanelData() {
    try {
      const [assigned, discovered] = await Promise.all([
        // assigned: must be scoped to estate
        estateId ? deviceService.getAssignedDevices(estateId) : Promise.resolve([]),
        // discovery: adapter scan
        deviceService.getDevices(undefined),
      ]);

      setAssignedDevices(Array.isArray(assigned) ? assigned : []);
      setDiscoveryDevices(Array.isArray(discovered) ? discovered : []);
    } catch {
      setAssignedDevices([]);
      setDiscoveryDevices([]);
    }
  }

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

    if (command === "__OPEN_INVITES__") {
      router.push("/invites");
      return;
    }

    setInput("");

    const { time, stamp } = nowMeta();

    const userMsgId = createId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: command, time, lastUpdated: stamp },
    ]);

    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        role: "assistant",
        content: "Thinking…",
        time,
        lastUpdated: stamp,
        pending: true,
      },
    ]);

    try {
      const resp: any = await aiService.chat(command);

      const reply =
        resp?.reply || `Got it. ${command.charAt(0).toUpperCase()}${command.slice(1)}.`;

      const panel = inferPanel(resp?.panel, command);

      const actions: DeviceAction[] | undefined = resp?.actions;
      if (actions?.length) await executeActions(actions);

      const openPanel = shouldOpenPanel(command, panel);
      const deviceId = resp?.deviceId;

      setMessages((prev) => {
        const next = prev.map((m) => {
          // ✅ If we are opening a panel, remove any previous occurrence of that SAME panel instance
          if (openPanel && panel && isSamePanelInstance(m, panel, deviceId) && m.id !== pendingId) {
            return { ...m, panel: null, deviceId: undefined };
          }

          // Update pending message into final assistant reply
          if (m.id === pendingId) {
            if (!openPanel) {
              return {
                ...m,
                pending: false,
                content: reply,
                panel: null,
                deviceId: undefined,
                time,
                lastUpdated: stamp,
              };
            }

            return {
              ...m,
              pending: false,
              content: reply,
              panel: panel || null,
              deviceId,
              time,
              lastUpdated: stamp,
            };
          }

          return m;
        });

        return next;
      });

      // ✅ if user opens devices panel, load both assigned + discovery
      if (openPanel && panel === "devices") {
        await refreshDevicePanelData();
      }

      if (openPanel && panel) {
        pushEvent({
          id: createId(),
          type: "info",
          category: "assistant",
          priority: "medium",
          actionable: true,
          title: getSuggestionTitle(panel),
          message: command,
          timestamp: stamp,
          expiresAt: Date.now() + 60_000,
        } as any);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, content: "Sorry — I couldn’t reach the system." }
            : m
        )
      );
    }
  }

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 min-h-0 isolate">
        {/* wallpaper */}
        <div className="estate-wallpaper" />

        {/* interactive layer */}
        <div className="app-layer">
          <InviteSuggestionBridge />
          <NotificationsBridge />
          <TopBar />

          {/* scroll region */}
          <div
            ref={scrollerRef}
            className="absolute left-0 right-0 overflow-y-auto"
            style={{
              zIndex: 20,
              top: "calc(64px + var(--sat))",
              bottom: "calc(152px + var(--sab) + var(--kb))",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
            }}
          >
            <div className="p-6 relative z-[20]">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%] relative z-[20]">
                      {/* bubble */}
                      <div
                        className="px-4 py-2 rounded-2xl border border-white/10 relative z-[20]"
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

                      {/* panel */}
                      {m.panel && (
                        <div className="mt-3 relative z-[30]">
                          {m.panel === "devices" ? (
                            <div className="space-y-3">
                              {/* ✅ small header hint so user knows what is shown */}
                              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
                                Assigned:{" "}
                                <span className="text-white/85 font-semibold">
                                  {assignedDevices.length}
                                </span>{" "}
                                • Discovery:{" "}
                                <span className="text-white/85 font-semibold">
                                  {discoveryDevices.length}
                                </span>
                              </div>

                              {/* Discovery panel (bind devices) */}
                              <DeviceDiscoveryPanel
                                devices={discoveryDevices}
                                onInteraction={refreshDevicePanelData}
                              />
                            </div>
                          ) : (
                            <RemotePanelRenderer
                              panel={m.panel}
                              deviceId={m.deviceId}
                              lastUpdated={m.lastUpdated}
                              onInteraction={() =>
                                setMessages((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id
                                      ? {
                                          ...x,
                                          time: new Date().toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }),
                                          lastUpdated: Date.now(),
                                        }
                                      : x
                                  )
                                )
                              }
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
          </div>

          {/* suggestions */}
          <div className="fixed left-0 right-0 z-[50] px-4 chat-suggestions">
            <div className="max-w-3xl mx-auto">
              <DynamicSuggestionCard onSend={(t) => handleSend(t)} />
            </div>
          </div>

          {/* footer */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[60] border-t border-white/10 chat-footer"
            style={{
              background: "rgba(10,12,18,0.72)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <div className="max-w-3xl mx-auto px-4 pt-4">
              <ChatFooter input={input} setInput={setInput} onSend={() => handleSend()} />
            </div>
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
