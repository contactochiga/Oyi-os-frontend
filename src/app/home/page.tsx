// src/app/home/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import InviteSuggestionBridge from "../components/InviteSuggestionBridge";

// ✅ NEW: unified toolbar (Hamburger left, Bell right)
import TopBar from "../components/TopBar";

// COMPONENTS
import LayoutWrapper from "../components/LayoutWrapper";
import ChatFooter from "../components/ChatFooter";
import DynamicSuggestionCard from "../components/DynamicSuggestionCard";

// REMOTE PANELS
import RemotePanelRenderer from "../components/remotes/RemotePanelRenderer";
import DeviceDiscoveryPanel from "../components/remotes/DeviceDiscoveryPanel";

// SERVICES
import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

// HOOKS
import useAuth from "../../hooks/useAuth";

// STORES
import { useEventStore } from "../../store/useEventStore";

type ChatMessage = {
  id: string;
  role: "assistant";
  content: string;
  panel?: string | null;
  panelKey?: string;
  deviceId?: string;
  time: string;
  lastUpdated: number;
};

/**
 * 🔒 Authoritative UI intent inference
 * Human-first, estate-aware, enterprise-grade
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
    src.includes("what's happening")
  ) return "home";

  if (
    src.includes("room") ||
    src.includes("bedroom") ||
    src.includes("kitchen") ||
    src.includes("living room")
  ) return "rooms";

  if (
    src.includes("visitor") ||
    src.includes("guest") ||
    src.includes("expecting") ||
    src.includes("delivery") ||
    src.includes("access code") ||
    src.includes("gate pass")
  ) return "visitor";

  if (
    src.includes("door") ||
    src.includes("lock") ||
    src.includes("unlock") ||
    src.includes("front door")
  ) return "door";

  if (src.includes("cctv") || src.includes("camera") || src.includes("surveillance"))
    return "cctv";

  if (
    src.includes("sensor") ||
    src.includes("motion") ||
    src.includes("smoke") ||
    src.includes("gas") ||
    src.includes("alert")
  ) return "sensors";

  if (
    src.includes("maintenance") ||
    src.includes("repair") ||
    src.includes("fix") ||
    src.includes("issue") ||
    src.includes("problem") ||
    src.includes("support")
  ) return "maintenance";

  if (src.includes("wallet") || src.includes("payment") || src.includes("balance") || src.includes("fund"))
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
  ) return "utilities";

  if (src.includes("community") || src.includes("announcement") || src.includes("estate news") || src.includes("notice"))
    return "community";

  if (src.includes("light")) return "light";
  if (src.includes("ac") || src.includes("air conditioner")) return "ac";
  if (src.includes("tv") || src.includes("television")) return "tv";
  if (src.includes("device") || src.includes("appliance")) return "devices";

  return null;
}

/**
 * Human-safe suggestion titles
 */
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

export default function HomePage() {
  const router = useRouter();

  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content: "Hello! I’m Oyi — how can I help?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      lastUpdated: Date.now(),
    },
  ]);

  const { user } = useAuth();
  const { pushEvent } = useEventStore();
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  const createId = () => Math.random().toString(36).slice(2, 9);

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

    // ✅ invite sentinel: pushes to /invites only when invite pill is tapped
    if (command === "__OPEN_INVITES__") {
      router.push("/invites");
      return;
    }

    setInput("");

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const stamp = now.getTime();

    try {
      const resp = await aiService.chat(command);

      const reply =
        resp.reply || `Got it. ${command.charAt(0).toUpperCase()}${command.slice(1)}.`;

      const panel = inferPanel(resp.panel, command);
      const deviceId = resp.deviceId;
      const panelKey = panel ? `${panel}:${deviceId || "default"}` : null;

      if (panelKey) {
        setMessages((prev) => {
          const existing = prev.find((m) => m.panelKey === panelKey);

          if (existing) {
            return [
              ...prev.filter((m) => m.id !== existing.id),
              { ...existing, content: reply, time, lastUpdated: stamp },
            ];
          }

          return [
            ...prev,
            {
              id: createId(),
              role: "assistant",
              content: reply,
              panel,
              panelKey,
              deviceId,
              time,
              lastUpdated: stamp,
            },
          ];
        });
      }

      if (panel === "devices") {
        const estateId = user?.estate_id ?? localStorage.getItem("ochiga_estate");
        const devices = await deviceService.getDevices(estateId ?? undefined);
        setDiscoveredDevices(devices || []);
      }

      if (panel) {
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
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: "Sorry — I couldn’t reach the system.",
          time,
          lastUpdated: stamp,
        },
      ]);
    }
  }

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 flex flex-col">
        {/* ✅ INVITES → injects “Home invite” pills into your suggestion row */}
        <InviteSuggestionBridge />

        {/* ✅ TOPBAR (Hamburger + Notification Bell) */}
        <div className="fixed top-0 left-0 right-0 z-[80]">
          <div className="max-w-3xl mx-auto px-4">
            <TopBar />
          </div>
        </div>

        {/* CHAT */}
        <div className="flex-1 overflow-y-auto p-6 pt-24 pb-44">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[80%]">
                  <div className="px-4 py-2 rounded-2xl bg-gray-900 text-gray-100">
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
        <div className="fixed bottom-[88px] left-0 right-0 z-[50] px-4">
          <div className="max-w-3xl mx-auto">
            <DynamicSuggestionCard onSend={(t) => handleSend(t)} />
          </div>
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 bg-gray-900 border-t border-gray-700">
          <div className="max-w-3xl mx-auto">
            <ChatFooter input={input} setInput={setInput} onSend={() => handleSend()} />
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
