// src/app/home/page.tsx
"use client";

import { useMemo, useState } from "react";
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
  panelKey?: string;
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

/**
 * 🔒 Panel inference (management panels + device panels)
 * We still infer, but we DO NOT automatically open device panels anymore.
 */
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
    src.includes("access code") ||
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
    src.includes("problem") ||
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
    src.includes("gas") ||
    src.includes("service charge") ||
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
  if (src.includes("ac") || src.includes("air conditioner")) return "ac";
  if (src.includes("tv") || src.includes("television")) return "tv";
  if (src.includes("device") || src.includes("appliance") || src.includes("discover"))
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
      return "View devices";
    default:
      return "Continue";
  }
}

/**
 * ✅ Decide if we should open a panel
 * - management panels => yes
 * - device panels => only if user explicitly asked to open/manage/show the UI
 */
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

  if (MANAGEMENT.has(panel)) return true;

  const t = (userText || "").toLowerCase();
  const wantsUi =
    t.includes("open") ||
    t.includes("show") ||
    t.includes("manage") ||
    t.includes("control panel") ||
    t.includes("remote") ||
    t.includes("panel") ||
    t.includes("settings");

  return wantsUi;
}

/**
 * ✅ Execute actions returned by AI (device command etc.)
 */
async function executeActions(actions: DeviceAction[] | undefined) {
  if (!actions?.length) return;

  for (const a of actions) {
    if (a.type === "device.command") {
      await deviceService.commandDevice(a.deviceId, a.command);
    }
  }
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

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
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null)
    );
  }, [user?.estate_id]);

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

    if (command === "__OPEN_INVITES__") {
      router.push("/invites");
      return;
    }

    setInput("");

    const { time, stamp } = nowMeta();

    // 1) Add USER bubble
    const userMsgId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: command,
        time,
        lastUpdated: stamp,
      },
    ]);

    // 2) Add ASSISTANT placeholder bubble
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
        resp?.reply ||
        `Got it. ${command.charAt(0).toUpperCase()}${command.slice(1)}.`;

      const panel = inferPanel(resp?.panel, command);

      const actions: DeviceAction[] | undefined = resp?.actions;
      if (actions?.length) await executeActions(actions);

      const openPanel = shouldOpenPanel(command, panel);

      const deviceId = resp?.deviceId;
      const panelKey = openPanel && panel ? `${panel}:${deviceId || "default"}` : null;

      // 3) Replace pending bubble
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== pendingId) return m;

          if (!openPanel) {
            return {
              ...m,
              pending: false,
              content: reply,
              panel: null,
              panelKey: undefined,
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
            panelKey: panelKey || undefined,
            deviceId,
            time,
            lastUpdated: stamp,
          };
        })
      );

      // 4) Fetch devices list when opening devices panel
      if (openPanel && panel === "devices") {
        const devices = await deviceService.getDevices(estateId ?? undefined);
        setDiscoveredDevices(devices || []);
      }

      // 5) Suggestion event
      if (
        panel &&
        (openPanel ||
          ["rooms", "visitor", "wallet", "utilities", "maintenance", "community", "devices"].includes(
            panel
          ))
      ) {
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
      {/* ✅ app-shell stabilizes iOS sizing (from globals.css) */}
      <main className="app-shell fixed inset-0 flex flex-col">
        <InviteSuggestionBridge />
        <NotificationsBridge />

        {/* ✅ TopBar is already fixed */}
        <TopBar />

        {/* CHAT */}
        <div
          className="flex-1 overflow-y-auto px-6"
          style={{
            // ✅ below notch + below TopBar (64px) + breathing space
            paddingTop: "calc(env(safe-area-inset-top) + 64px + 16px)",
            // ✅ above footer area + above home bar
            paddingBottom: "calc(env(safe-area-inset-bottom) + 88px + 64px)",
          }}
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[80%]">
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      m.role === "user"
                        ? "bg-[#E11D2E] text-white"
                        : "bg-gray-900 text-gray-100"
                    }`}
                  >
                    {m.content}
                  </div>

                  {m.panel && (
                    <div className="mt-3">
                      {m.panel === "devices" ? (
                        <DeviceDiscoveryPanel devices={discoveredDevices} />
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
          </div>
        </div>

        {/* SUGGESTIONS */}
        <div
          className="chat-suggestions fixed left-0 right-0 z-[50] px-4"
          style={{
            // ✅ sit above footer + home bar
            bottom: "calc(env(safe-area-inset-bottom) + 88px + 12px)",
          }}
        >
          <div className="max-w-3xl mx-auto">
            <DynamicSuggestionCard onSend={(t) => handleSend(t)} />
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="chat-footer fixed left-0 right-0 z-[60] bg-gray-900 border-t border-gray-700"
          style={{
            // ✅ push footer above home indicator
            paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
            paddingTop: 14,
            paddingLeft: 14,
            paddingRight: 14,
          }}
        >
          <div className="max-w-3xl mx-auto">
            <ChatFooter input={input} setInput={setInput} onSend={() => handleSend()} />
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
