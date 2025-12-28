"use client";

import { useRef, useState } from "react";

// COMPONENTS
import LayoutWrapper from "../components/LayoutWrapper";
import ChatFooter from "../components/ChatFooter";
import DynamicSuggestionCard from "../components/DynamicSuggestionCard";

// SERVICES
import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

// HOOKS
import useAuth from "../../hooks/useAuth";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  panel?: string | null;
  panelTag?: string | null;
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
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const { user } = useAuth();

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

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: t, time: now },
    ]);

    try {
      const resp = await aiService.chat(t);
      const reply = resp.reply ?? `Processed: "${t}"`;
      const panel = resp.panel ?? null;

      // Add assistant reply
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: reply,
          panel,
          panelTag: panel,
          time: now,
        },
      ]);

      // Fetch devices if needed
      if (panel === "devices") {
        const rawId = user?.estate_id ?? localStorage.getItem("ochiga_estate");
        const estateId = rawId ?? undefined;

        const devices = await deviceService.getDevices(estateId);
        setDiscoveredDevices(devices || []);
      }

      // Auto-scroll if user is already near bottom
      setTimeout(() => {
        if (isAtBottom()) {
          chatRef.current?.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 80);
    } catch (err) {
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
                  {/* Chat bubble */}
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

                  {/* Placeholder for future panels/remotes */}
                  {m.panel && <div className="mt-2">{/* Panel */}</div>}
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
