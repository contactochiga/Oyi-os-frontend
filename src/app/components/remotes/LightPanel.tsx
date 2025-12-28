"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

export default function LightPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [on, setOn] = useState(false);
  const [brightness, setBrightness] = useState(70);

  function touch() {
    onInteraction?.();
  }

  return (
    <RemotePanel title="Living Room Light" lastUpdated={lastUpdated}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-300">
          Status: <span className="text-white">{on ? "On" : "Off"}</span>
        </span>

        <button
          onClick={() => {
            setOn(!on);
            touch();
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition
            ${on ? "bg-[#E11D2E]" : "bg-gray-700 hover:bg-gray-600"}`}
        >
          {on ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className={`${!on ? "opacity-40 pointer-events-none" : ""}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Brightness
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={brightness}
          onChange={(e) => {
            setBrightness(Number(e.target.value));
            touch();
          }}
          className="w-full accent-[#E11D2E]"
        />
      </div>
    </RemotePanel>
  );
}
