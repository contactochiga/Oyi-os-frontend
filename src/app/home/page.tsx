"use client";

import { useState } from "react";

// COMPONENTS
import LayoutWrapper from "../components/LayoutWrapper";
import ChatFooter from "../components/ChatFooter";
import DynamicSuggestionCard from "../components/DynamicSuggestionCard";
import HamburgerMenu from "../components/HamburgerMenu";

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
 * Authoritative UI intent inference
 * (UI decides, AI assists)
 */
function inferPanel(aiPanel?: string | null, userText?: string): string | null {
  const src = `${aiPanel || ""} ${userText || ""}`.toLowerCase();

  if (src.includes("summary") || src.includes("status")) return "home_summary";
  if (src.includes("room")) return "room_summary";
  if (src.includes("wallet") || src.includes("payment")) return "wallet";
  if (src.includes("community") || src.includes("announcement")) return "community";
  if (src.includes("visitor") || src.includes("guest")) return "visitor";

  if (src.includes("light")) return "light";
  if (src.includes("ac") || src.includes("air")) return "ac";
  if (src.includes("tv")) return "tv";
  if (src.includes("door") || src.includes("lock")) return "door";
  if (src.includes("cctv") || src.includes("camera")) return "cctv";
  if (src.includes("device")) return "devices";

  return null;
}

/**
 * Human, enterprise-grade suggestion titles
 */
function getSuggestionTitle(intent: string | null): string {
  switch (intent) {
    case "ac":
      return "Adjust air conditioner";
    case "light":
      return "Control lights";
    case "tv":
      return "Control TV";
    case "door":
      return "Manage door access";
    case "visitor":
      return "Manage visitors";
    case "cctv":
      return "View CCTV feed";
    case "devices":
      return "View all devices";
    case "home_summary":
      return "View home summary";
    case "room_summary":
      return "View room status";
    case "wallet":
      return "Open wallet";
    case "community":
      return "View community updates";
    default:
      return "Continue";
  }
}

export default function HomePage() {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content: "Hello! I’m Oyi — how can I help?",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
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

    setInput("");

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const stamp = now.getTime();

    try {
      const resp = await aiService.chat(command);
      const reply = resp.reply ?? `Processed: "${command}"`;

      const panel = inferPanel(resp.panel, command);
      const deviceId = resp.deviceId;
      const panelKey = panel ? `${panel}:${deviceId || "default"}` : null;

      // ---------- CHAT + PANEL STATE ----------
      setMessages((prev) => {
        if (!panelKey) return prev;

        const existing = prev.find((m) => m.panelKey === panelKey);

        // Update & move panel
        if (existing) {
          return [
            ...prev.filter((m) => m.id !== existing.id),
            {
              ...existing,
              content: reply,
              time,
              lastUpdated: stamp,
            },
          ];
        }

        // Create new panel
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

      // ---------- DEVICE DISCOVERY ----------
      if (panel === "devices") {
        const estateId = user?.estate_id ?? localStorage.getItem("ochiga_estate");
        const devices = await deviceService.getDevices(estateId ?? undefined);
        setDiscoveredDevices(devices || []);
      }

      // ---------- 🔥 CLEAN EVENT PUSH ----------
      if (panel) {
        pushEvent({
          id: createId(),
          type: "info",
          category: "assistant",
          priority: "medium",
          actionable: true,

          // HUMAN SUGGESTION (NOT AI TEXT)
          title: getSuggestionTitle(panel),

          // Replayed when tapped
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

        {/* TOPBAR */}
        <div className="fixed top-0 left-0 right-0 z-50 h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800">
          <div className="max-w-3xl mx-auto h-full flex items-center px-4">
            <HamburgerMenu />
          </div>
        </div>

        {/* CHAT */}
        <div className="flex-1 overflow-y-auto p-6 pt-24 pb-48">
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
        <div className="fixed bottom-[88px] left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto">
            <DynamicSuggestionCard onSend={(t) => handleSend(t)} />
          </div>
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-700 z-50">
          <ChatFooter
            input={input}
            setInput={setInput}
            onSend={() => handleSend()}
          />
        </div>

      </main>
    </LayoutWrapper>
  );
}
