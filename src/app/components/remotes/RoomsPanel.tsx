"use client";

import RemotePanel from "./RemotePanel";

type RoomStatus = "active" | "idle" | "automated";

type Room = {
  id: string;
  name: string;
  devices: number;
  status: RoomStatus;
};

export default function RoomsPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const rooms: Room[] = [
    { id: "living", name: "Living Room", devices: 4, status: "active" },
    { id: "bedroom", name: "Bedroom", devices: 3, status: "idle" },
    { id: "kitchen", name: "Kitchen", devices: 2, status: "automated" },
  ];

  function touch() {
    onInteraction?.();
  }

  function runAction(roomId: string, action: string) {
    console.log(`ROOM ACTION → ${roomId}: ${action}`);
    touch();
  }

  function statusColor(status: RoomStatus) {
    switch (status) {
      case "active":
        return "text-green-400";
      case "automated":
        return "text-blue-400";
      default:
        return "text-gray-400";
    }
  }

  return (
    <RemotePanel title="Rooms" lastUpdated={lastUpdated}>
      <div className="space-y-4">

        {rooms.map((room) => (
          <div
            key={room.id}
            className="rounded-xl bg-gray-800 border border-gray-700 p-4"
          >
            {/* HEADER */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm text-white font-medium">
                  {room.name}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <span>{room.devices} devices</span>
                  <span>•</span>
                  <span className={statusColor(room.status)}>
                    {room.status}
                  </span>
                </div>
              </div>

              <button
                onClick={() => runAction(room.id, "manage")}
                className="btn-tv"
              >
                Manage
              </button>
            </div>

            {/* QUICK SCENES */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => runAction(room.id, "lights_off")}
                className="rounded-xl bg-gray-700 py-2 text-xs text-white active:scale-95 transition"
              >
                Lights Off
              </button>

              <button
                onClick={() => runAction(room.id, "comfort")}
                className="rounded-xl bg-gray-700 py-2 text-xs text-white active:scale-95 transition"
              >
                Comfort
              </button>

              <button
                onClick={() => runAction(room.id, "power_down")}
                className="rounded-xl bg-gray-700 py-2 text-xs text-white active:scale-95 transition"
              >
                Power Down
              </button>
            </div>

            {/* ADVANCED */}
            <button
              onClick={() => runAction(room.id, "automations")}
              className="w-full py-2 rounded-lg bg-gray-900 text-xs text-gray-300 border border-gray-700"
            >
              View Automations
            </button>
          </div>
        ))}

        {/* FOOT ACTION */}
        <button
          onClick={() => runAction("rooms", "create")}
          className="w-full py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-medium active:scale-95 transition"
        >
          + Create New Room
        </button>
      </div>
    </RemotePanel>
  );
}
