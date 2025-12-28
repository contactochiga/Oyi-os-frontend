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
import { useEstateContext } from "../../hooks/useEstateContext";

// STORES
import { useEventStore } from "../../store/useEventStore";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  panel?: string | null;
  panelTag?: string | null;
  deviceId?: string;
  time: string;
};

/**
 * Normalize AI panel names → canonical UI panel IDs
 * This keeps AI flexible and UI stable (enterprise-grade)
 */
function normalizePanel(panel?: string | null): string | null {
  if (!panel) return null;

  const p = panel.toLowerCase();

  if (
    p.includes("light")
  ) return "light";

  if (
    p.includes("ac") ||
    p.includes("air") ||
    p.includes("condition")
  ) return "ac";

  if (
    p.includes("tv")
  ) return "tv";

  if (
    p.includes("door") ||
    p.includes("lock")
  ) return "door";

  if (
    p.includes("cctv") ||
    p.includes("camera")
  ) return "cctv";

  if (
    p.includes("device")
  ) return "devices";

  return null;
}

export default function HomePage() {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content: "Hello! I’m Oyi — how can I help?",
      panel: null,
      panelTag: null,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);

  const chatRef = useRef<HTMLDivElement | null>(null);

  // Context & stores
  const { user } = useAuth();
  const { estateName, unitName } = useEstateContext();
  const { pushEvent } = useEventStore();

  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  const createId = () => Math.random().toString(36).slice(2, 9);

  const isAtBottom = () => {
    if (!chatRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    return scrollTop + clientHeight >= scrollHeight - 100;
  };

  async function handleSend(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setInput("");

    // USER MESSAGE
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: t, time: now },
    ]);

    try {
      const resp = await aiService.chat(t);

      const reply = resp.reply ?? `Processed: "${t}"`;
      const normalizedPanel = normalizePanel(resp.panel);
      const deviceId = resp.deviceId ?? undefined;

      // ASSISTANT MESSAGE
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: reply,
          panel: normalizedPanel,
          panelTag: normalizedPanel,
          deviceId,
          time: now,
        },
      ]);

      // DEVICE DISCOVERY FLOW
      if (normalizedPanel === "devices") {
        const rawId = user?.estate_id ?? localStorage.getItem("ochiga_estate");
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
        timestamp: Date.now(),
      });

      // AUTO-SCROLL
      setTimeout(() => {
        if (isAtBottom()) {
          chatRef.current?.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 80);
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

  // ---------- UI ----------
  return (
    <LayoutWrapper>
      <main className="fixed inset-0 flex flex-col">

        {/* TOPBAR */}
        <div className="fixed top-0 left-0 right-0 z-50 h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800">
          <div className="max-w-3xl mx-auto h-full flex items-center px-4">
            <HamburgerMenu />
          </div>
        </div>

        {/* CHAT WINDOW */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-6 pt-24 pb-48"
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="max-w-[80%]">
                  {/* CHAT BUBBLE */}
                  {m.content && (
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        m.role === "user"
                          ? "bg-gray-800 text-white"
                          : "bg-gray-900 text-gray-100"
                      }`}
                    >
                      {m.content}
                    </div>
                  )}

                  {/* LIVE REMOTE PANEL */}
                  {m.panel && (
                    <div className="mt-2">
                      {m.panel === "devices" ? (
                        <DeviceDiscoveryPanel devices={discoveredDevices} />
                      ) : (
                        <RemotePanelRenderer
                          panel={m.panel}
                          deviceId={m.deviceId}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DYNAMIC SUGGESTION / EVENT BAR */}
        <div className="fixed bottom-[88px] left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto">
            <DynamicSuggestionCard
              suggestions={[
                { id: "1", title: "Turn on living room lights" },
                { id: "2", title: "Schedule visitor" },
                { id: "3", title: "Open CCTV feed" },
              ]}
              onSend={(t?: string) => handleSend(t)}
            />
          </div>
        </div>

        {/* CHAT FOOTER */}
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
