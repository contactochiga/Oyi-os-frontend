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
  onSend: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative flex items-center bg-gray-800 rounded-full p-2 gap-2">

        {/* Mic Button */}
        <button
          onClick={() => setIsRecording((v) => !v)}
          className={`
            w-10 h-10 rounded-full
            flex items-center justify-center
            transition
            ${isRecording ? "bg-[#E11D2E]" : "bg-gray-700"}
          `}
        >
          <FaMicrophone className="text-white text-sm" />
        </button>

        {/* Input */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Ask Oyi…"
          className="
            flex-1 bg-transparent outline-none px-2
            text-sm text-white placeholder-gray-400
          "
        />

        {/* Send Button */}
        <button
          onClick={onSend}
          className="
            w-10 h-10 rounded-full
            flex items-center justify-center
            bg-[#E11D2E]
            hover:bg-[#C81E2A]
            transition
          "
        >
          <FaPaperPlane className="text-white text-sm ml-[1px]" />
        </button>

      </div>
    </div>
  );
}
