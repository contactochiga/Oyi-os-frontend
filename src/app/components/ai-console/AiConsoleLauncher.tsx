"use client";

import React from "react";
import { MessageCircle } from "lucide-react";

export default function AiConsoleLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="fixed left-0 right-0 bottom-0 z-[60] px-4 pb-[calc(14px+var(--sab))]">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={onOpen}
          className="w-full rounded-3xl border border-white/10 px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition"
          style={{
            background: "rgba(10,12,18,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white/85" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm text-white/90 font-medium">I&apos;m Oyi, how can I help?</div>
            <div className="text-[11px] text-white/45">Tap to open assistant</div>
          </div>
          <div className="text-xs text-white/45">Open</div>
        </button>
      </div>
    </div>
  );
}
