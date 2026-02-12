"use client";

import React, { useMemo } from "react";

type Props = {
  gangCount: 1 | 2 | 3;
  online: boolean | null;
  values: Array<boolean | null>; // length >= gangCount (on/off/unknown per gang)
  busy?: boolean;
  onToggleGang?: (gangIndex: number, next: boolean) => void;
  size?: number; // px
};

function ringClass({
  online,
  value,
  busy,
}: {
  online: boolean | null;
  value: boolean | null;
  busy?: boolean;
}) {
  // offline/unknown
  if (online === false) return "ring-off";
  if (online === null) return "ring-off";

  // online
  if (value === true) return busy ? "ring-on ring-busy" : "ring-on";
  if (value === false) return busy ? "ring-ready ring-busy" : "ring-ready";

  // unknown but online
  return busy ? "ring-unknown ring-busy" : "ring-unknown";
}

export default function GangRingSwitch({
  gangCount,
  online,
  values,
  busy,
  onToggleGang,
  size = 56,
}: Props) {
  const gangs = useMemo(() => {
    const arr = [0, 1, 2].slice(0, gangCount);
    return arr;
  }, [gangCount]);

  return (
    <div className="flex items-center gap-3">
      {gangs.map((i) => {
        const v = values?.[i] ?? null;
        const cls = ringClass({ online, value: v, busy });
        const disabled = busy || online === false || typeof onToggleGang !== "function";

        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onToggleGang?.(i, !(v === true))}
            className={`relative rounded-full border border-white/10 bg-black/20 hover:bg-white/5 transition disabled:opacity-50 ${cls}`}
            style={{ width: size, height: size }}
            aria-label={`Gang ${i + 1} ${v === true ? "On" : "Off"}`}
          >
            {/* inner glass */}
            <span className="absolute inset-[10px] rounded-full bg-black/40" />

            {/* ring */}
            <span className="absolute inset-[6px] rounded-full ring-2 ring-inset" />
          </button>
        );
      })}

      {/* Tailwind helpers */}
      <style jsx global>{`
        .ring-off span.ring-2 {
          --tw-ring-color: rgba(255, 255, 255, 0.08);
        }
        .ring-unknown span.ring-2 {
          --tw-ring-color: rgba(255, 255, 255, 0.18);
        }
        /* Connected but OFF = RED */
        .ring-ready span.ring-2 {
          --tw-ring-color: rgba(255, 70, 70, 0.75);
        }
        /* Connected and ON = BLUE */
        .ring-on span.ring-2 {
          --tw-ring-color: rgba(80, 170, 255, 0.85);
        }
        .ring-busy {
          animation: ringPulse 0.9s ease-in-out infinite;
        }
        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.98);
            opacity: 0.75;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
