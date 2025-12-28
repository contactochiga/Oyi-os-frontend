"use client";

import { useRef, useState } from "react";

// COMPONENTS
import LayoutWrapper from "../components/LayoutWrapper";
import ChatFooter from "../components/ChatFooter";
import DynamicSuggestionCard from "../components/DynamicSuggestionCard";
import HamburgerMenu from "../components/HamburgerMenu";

// SERVICES
import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

// HOOKS
import useAuth from "../../hooks/useAuth";
import { useEstateContext } from "../../hooks/useEstateContext";

// STORES (prepared, not yet rendered)
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

  // Context & stores (now available to page)
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
      const panel = resp.panel ?? null;
      const deviceId = resp.deviceId ?? undefined;

      // ASSISTANT MESSAGE
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: reply,
          panel,
          panelTag: panel,
          deviceId,
          time: now,
        },
      ]);

      // PREP: Device discovery (existing behavior preserved)
      if (panel === "devices") {
        const rawId = user?.estate_id ?? localStorage.getItem("ochiga_estate");
        const estateId = rawId ?? undefined;
        const devices = await deviceService.getDevices(estateId);
        setDiscoveredDevices(devices || []);
      }

      // PREP: Push system event (not yet rendered)
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

                  {/* LIVE PANEL SLOT (next phase) */}
                  {m.panel && (
                    <div className="mt-2">
                      {/* Remote panel will mount here */}
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
