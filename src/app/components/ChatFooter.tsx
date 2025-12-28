"use client";

import { FaMicrophone, FaPaperPlane } from "react-icons/fa";
import { useState } from "react";

export default function ChatFooter({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (s: string) => void;
  onSend: () => Promise<void> | void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const canSend = input.trim().length > 0 && !isSending;

  async function handleSend() {
    if (!canSend) return;
    setIsSending(true);
    try {
      await onSend();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative flex items-center bg-gray-800 rounded-full p-2 gap-2">

        {/* MIC BUTTON */}
        <button
          onClick={() => setIsRecording((v) => !v)}
          className={`
            w-10 h-10 rounded-full
            flex items-center justify-center
            transition
            ${
              isRecording
                ? "bg-[#E11D2E] animate-pulse"
                : "bg-gray-700 hover:bg-gray-600"
            }
          `}
        >
          <FaMicrophone className="text-white text-[14px]" />
        </button>

        {/* INPUT */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask Oyi…"
          className="
            flex-1 bg-transparent outline-none px-2
            text-sm text-white placeholder-gray-400
          "
        />

        {/* SEND BUTTON */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            w-10 h-10 rounded-full
            flex items-center justify-center
            transition
            ${
              canSend
                ? "bg-[#E11D2E] hover:bg-[#C81E2A]"
                : "bg-gray-700 cursor-not-allowed opacity-60"
            }
          `}
        >
          {/* ICON WRAPPER ENSURES TRUE CENTERING */}
          <span className="relative flex items-center justify-center w-full h-full">
            <FaPaperPlane
              className={`
                text-white
                text-[13px]
                relative
                left-[0.5px] top-[0.5px]
                ${isSending ? "opacity-50" : ""}
              `}
            />
          </span>
        </button>

      </div>
    </div>
  );
}
