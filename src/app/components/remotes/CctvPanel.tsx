"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

type Camera = {
  id: string;
  name: string;
};

export default function CctvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const cameras: Camera[] = [
    { id: "cam-1", name: "Front Gate" },
    { id: "cam-2", name: "Parking Lot" },
    { id: "cam-3", name: "Lobby" },
  ];

  const [activeCam, setActiveCam] = useState(cameras[0]);

  const timeLabel =
    lastUpdated &&
    new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  function touch() {
    onInteraction?.();
  }

  return (
    <RemotePanel title="CCTV" timestamp={timeLabel}>
      {/* CAMERA FEED */}
      <div className="mb-4 rounded-xl overflow-hidden border border-gray-800">
        <div className="h-40 bg-black flex items-center justify-center text-xs text-gray-400">
          Live feed — {activeCam.name}
        </div>
      </div>

      {/* CAMERA SELECTOR */}
      <div className="flex gap-2 overflow-x-auto">
        {cameras.map((cam) => (
          <button
            key={cam.id}
            onClick={() => {
              setActiveCam(cam);
              touch();
            }}
            className={`px-3 py-2 rounded-full text-xs whitespace-nowrap
              ${
                cam.id === activeCam.id
                  ? "bg-[#E11D2E] text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
          >
            {cam.name}
          </button>
        ))}
      </div>
    </RemotePanel>
  );
}
