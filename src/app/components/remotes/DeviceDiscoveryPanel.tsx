"use client";

import { useEffect, useState } from "react";
import { deviceService } from "@/services/deviceService";

type Device = {
  id: string;
  name?: string;
  type?: string;
  ip?: string;
  protocol?: string;
  status?: string;
};

const ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Other"];

export default function DeviceDiscoveryPanel({
  devices: initialDevices = [],
}: {
  devices?: Device[];
}) {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [room, setRoom] = useState("");

  /* -----------------------------
     INITIAL LOAD / REFRESH
  ------------------------------ */
  async function refreshDevices() {
    setLoading(true);
    try {
      const result = await deviceService.getDevices();
      setDevices(result || []);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialDevices.length === 0) {
      refreshDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------
     ASSIGN SELECTED DEVICES
  ------------------------------ */
  async function addDevices(ids: string[]) {
    if (ids.length === 0) return;

    setLoading(true);
    try {
      await deviceService.assignDevices({
        deviceIds: ids,
        room: room || null,
      });

      // Re-fetch devices after assignment
      const updated = await deviceService.getDevices();
      setDevices(updated || []);
      setSelected({});
      setRoom("");
    } finally {
      setLoading(false);
    }
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Device Discovery
          </h3>
          <p className="text-xs text-gray-400">
            Estate & account devices
          </p>
        </div>

        <button
          onClick={refreshDevices}
          disabled={loading}
          className={`px-3 py-1.5 rounded-full text-xs font-medium
            ${
              loading
                ? "bg-gray-700 text-gray-400"
                : "bg-[#E11D2E] text-white"
            }`}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          Syncing devices…
        </div>
      )}

      {/* DEVICE LIST */}
      <div className="space-y-2">
        {devices.map((d) => (
          <label
            key={d.id}
            className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!selected[d.id]}
                onChange={() =>
                  setSelected((s) => ({
                    ...s,
                    [d.id]: !s[d.id],
                  }))
                }
              />

              <div>
                <div className="text-sm text-white">
                  {d.name || d.type || "Unknown Device"}
                </div>
                <div className="text-xs text-gray-400">
                  {d.protocol || d.ip}
                </div>
              </div>
            </div>

            <span className="text-xs text-gray-400">
              {d.status || "Available"}
            </span>
          </label>
        ))}

        {!loading && devices.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            No devices found.
          </div>
        )}
      </div>

      {/* BULK ACTION */}
      {selectedIds.length > 0 && (
        <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
          <div className="text-xs text-gray-300">
            {selectedIds.length} device(s) selected
          </div>

          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Assign to room (optional)</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={() => addDevices(selectedIds)}
            className="w-full py-2 rounded-xl bg-[#E11D2E] text-white text-sm font-medium active:scale-95 transition"
          >
            Add Selected Devices
          </button>
        </div>
      )}
    </div>
  );
}
