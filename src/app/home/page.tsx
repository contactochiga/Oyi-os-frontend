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

// ✅ SUMMARY ROUTER (STEP 1)
import { summaryRouter } from "@/lib/summaryRouter";

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
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const stamp = now.getTime();

    try {
      const resp = await aiService.chat(command);
      const reply = resp.reply ?? `Processed: "${command}"`;

      // ✅ AUTHORITATIVE INTENT RESOLUTION
      const intent = summaryRouter(resp.panel, command);
      const deviceId = resp.deviceId;
      const panelKey = intent ? `${intent}:${deviceId || "default"}` : null;

      // ---- CHAT + PANEL STATE (SINGLE INSTANCE RULE) ----
      setMessages((prev) => {
        if (!panelKey) return prev;

        const existing = prev.find((m) => m.panelKey === panelKey);

        // 🔁 PANEL EXISTS → UPDATE & MOVE TO LATEST
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

        // 🆕 NEW PANEL
        return [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: reply,
            panel: intent,
            panelKey,
            deviceId,
            time,
            lastUpdated: stamp,
          },
        ];
      });

      // ---- DEVICE DISCOVERY ----
      if (intent === "devices") {
        const estateId =
          user?.estate_id ?? localStorage.getItem("ochiga_estate");
        const devices = await deviceService.getDevices(
          estateId ?? undefined
        );
        setDiscoveredDevices(devices || []);
      }

      // ---- EVENT → DYNAMIC SUGGESTION CARD ----
      if (intent) {
        pushEvent({
          id: createId(),
          type: "info",
          category: "assistant",
          priority: "medium",
          actionable: true,

          // Button text
          title: reply
            .replace(/^okay[, ]*/i, "")
            .replace(/[".]/g, "")
            .trim(),

          // Re-executed command
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

        {/* DYNAMIC SUGGESTIONS */}
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
