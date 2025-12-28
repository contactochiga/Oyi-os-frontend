"use client";

import { useRef, useState } from "react";

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
  role: "user" | "assistant";
  content: string;
  panel?: string | null;
  panelKey?: string;
  deviceId?: string;
  time: string;
  lastUpdated?: number;
};

/**
 * Enterprise-grade intent inference
 * UI logic is authoritative
 */
function inferPanel(aiPanel?: string | null, userText?: string): string | null {
  const source = `${aiPanel || ""} ${userText || ""}`.toLowerCase();

  if (source.includes("light")) return "light";
  if (source.includes("ac") || source.includes("air")) return "ac";
  if (source.includes("tv")) return "tv";
  if (source.includes("door") || source.includes("lock")) return "door";
  if (source.includes("cctv") || source.includes("camera")) return "cctv";
  if (source.includes("device")) return "devices";

  return null;
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
    },
  ]);

  const chatRef = useRef<HTMLDivElement | null>(null);

  const { user } = useAuth();
  const { pushEvent } = useEventStore();

  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  const createId = () => Math.random().toString(36).slice(2, 9);

  async function handleSend(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setInput("");

    // 🔹 USER MESSAGE (only added if NOT repeating same panel)
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: t, time: now },
    ]);

    try {
      const resp = await aiService.chat(t);

      const reply = resp.reply ?? `Processed: "${t}"`;
      const panel = inferPanel(resp.panel, t);
      const deviceId = resp.deviceId ?? undefined;
      const panelKey = panel ? `${panel}:${deviceId || "default"}` : undefined;
      const stamp = Date.now();

      // 🔹 SINGLE-INSTANCE PANEL RULE
      setMessages((prev) => {
        if (!panelKey) return prev;

        // remove old instance of this panel
        const filtered = prev.filter((m) => m.panelKey !== panelKey);

        return [
          ...filtered,
          {
            id: createId(),
            role: "assistant",
            content: reply,
            panel,
            panelKey,
            deviceId,
            time: now,
            lastUpdated: stamp,
          },
        ];
      });

      // DEVICE DISCOVERY
      if (panel === "devices") {
        const rawId =
          user?.estate_id ?? localStorage.getItem("ochiga_estate");
        const estateId = rawId ?? undefined;
        const devices = await deviceService.getDevices(estateId);
        setDiscoveredDevices(devices || []);
      }

      // SYSTEM EVENT
      pushEvent({
        id: createId(),
        type: "info",
        title: "Oyi",
        message: reply,
        timestamp: stamp,
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: "Sorry, AI unreachable.",
          time: now,
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
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-6 pt-24 pb-48"
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div className="max-w-[80%]">
                  {/* CHAT BUBBLE */}
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      m.role === "user"
                        ? "bg-gray-800 text-white"
                        : "bg-gray-900 text-gray-100"
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* REMOTE PANEL */}
                  {m.panel && (
                    <div className="mt-3">
                      {m.panel === "devices" ? (
                        <DeviceDiscoveryPanel
                          devices={discoveredDevices}
                        />
                      ) : (
                        <RemotePanelRenderer
                          panel={m.panel}
                          deviceId={m.deviceId}
                          lastUpdated={m.lastUpdated}
                          onInteraction={() => {
                            setMessages((prev) =>
                              prev.map((x) =>
                                x.id === m.id
                                  ? {
                                      ...x,
                                      lastUpdated: Date.now(),
                                      time: new Date().toLocaleTimeString(
                                        [],
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      ),
                                    }
                                  : x
                              )
                            );
                          }}
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
            <DynamicSuggestionCard
              suggestions={[
                { id: "1", title: "Turn on living room lights" },
                { id: "2", title: "Schedule visitor" },
                { id: "3", title: "Open CCTV feed" },
              ]}
              onSend={(t) => handleSend(t)}
            />
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
