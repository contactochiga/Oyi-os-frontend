"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

export default function LightPanel({
  deviceId,
}: {
  deviceId?: string;
}) {
  const [on, setOn] = useState(true);
  const [brightness, setBrightness] = useState(80);

  return (
    <RemotePanel title="Living Room Light">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white text-sm">
          Status: {on ? "On" : "Off"}
        </span>

        <button
          onClick={() => setOn(!on)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition
            ${on ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {on ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">
          Brightness
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full accent-[#E11D2E]"
        />
      </div>
    </RemotePanel>
  );
}
