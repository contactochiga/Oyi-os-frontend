"use client";

import RemotePanel from "./RemotePanel";

type Room = {
  id: string;
  name: string;
  devices: number;
};

export default function RoomsPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const rooms: Room[] = [
    { id: "living", name: "Living Room", devices: 4 },
    { id: "bedroom", name: "Bedroom", devices: 3 },
    { id: "kitchen", name: "Kitchen", devices: 2 },
  ];

  const timeLabel =
    lastUpdated &&
    new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  function touch() {
    onInteraction?.();
  }

  function runAction(roomId: string, action: string) {
    console.log(`ROOM ACTION → ${roomId}: ${action}`);
    touch();
  }

  return (
    <RemotePanel title="Rooms" timestamp={timeLabel}>
      <div className="space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="rounded-xl bg-gray-800 border border-gray-700 p-4"
          >
            {/* ROOM HEADER */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-white font-medium">
                  {room.name}
                </div>
                <div className="text-xs text-gray-400">
                  {room.devices} devices
                </div>
              </div>

              <button
                onClick={() => runAction(room.id, "open")}
                className="btn-tv"
              >
                Open
              </button>
            </div>

            {/* QUICK ACTIONS */}
            <div className="flex gap-2">
              <button
                onClick={() => runAction(room.id, "lights_off")}
                className="flex-1 py-2 rounded-xl bg-gray-700 text-xs text-white active:scale-95 transition"
              >
                Lights Off
              </button>

              <button
                onClick={() => runAction(room.id, "power_down")}
                className="flex-1 py-2 rounded-xl bg-gray-700 text-xs text-white active:scale-95 transition"
              >
                Power Down
              </button>

              <button
                onClick={() => runAction(room.id, "comfort")}
                className="flex-1 py-2 rounded-xl bg-gray-700 text-xs text-white active:scale-95 transition"
              >
                Comfort
              </button>
            </div>
          </div>
        ))}
      </div>
    </RemotePanel>
  );
}
