"use client";

import { ReactNode } from "react";

export default function OyiComposerRow({
  value,
  onChange,
  onSend,
  onKeyDown,
  onMicClick,
  placeholder = "Ask Oyi…",
  disabled = false,
  micDisabled = false,
  micActive = false,
  micIcon,
  sendIcon,
  rows = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMicClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  micDisabled?: boolean;
  micActive?: boolean;
  micIcon?: ReactNode;
  sendIcon?: ReactNode;
  rows?: number;
}) {
  const canSend = value.trim().length > 0 && !disabled;
  return (
    <div className="flex items-end gap-2 rounded-[22px] border border-white/10 bg-white/[0.035] px-2.5 py-2 backdrop-blur-xl">
      {onMicClick ? (
        <button
          type="button"
          onClick={onMicClick}
          disabled={micDisabled}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-[0.97] ${
            micActive ? "bg-white text-black" : "bg-white/[0.05] text-white/72 hover:bg-white/10"
          } ${micDisabled ? "opacity-40" : ""}`}
          aria-label={micActive ? "Stop recording" : "Record voice command"}
        >
          {micIcon}
        </button>
      ) : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className="min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[14px] leading-5 text-white/90 outline-none placeholder:text-white/35"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-[0.97] ${
          canSend ? "bg-white text-black" : "bg-white/[0.05] text-white/35"
        }`}
        aria-label="Send"
      >
        {sendIcon}
      </button>
    </div>
  );
}
