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
  const [scanning, setScanning] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [room, setRoom] = useState<string>("");

  /* --------------------------------
     DISCOVERY (BACKEND WIRED)
     GET /devices/discover
  --------------------------------- */
  async function discover() {
    setScanning(true);
    try {
      const result = await deviceService.getDevices();
      setDevices(result || []);
      setSelected({});
    } catch (err) {
      console.warn("Device discovery failed:", err);
      setDevices([]);
    } finally {
      setScanning(false);
    }
  }

  /* --------------------------------
     INITIAL LOAD (FROM CHAT / AI)
  --------------------------------- */
  useEffect(() => {
    if (initialDevices.length > 0) {
      setDevices(initialDevices);
    }
  }, [initialDevices]);

  /* --------------------------------
     DEVICE ASSIGNMENT (BACKEND WIRED)
     POST /devices/assign
  --------------------------------- */
  async function addDevices(ids: string[]) {
    if (ids.length === 0) return;

    setAssigning(true);

    try {
      await deviceService.assignDevices({
        deviceIds: ids,
        room: room || null,
      });

      // Optimistic UI update
      setDevices((prev) =>
        prev.map((d) =>
          ids.includes(d.id)
            ? { ...d, status: "Assigned" }
            : d
        )
      );

      setSelected({});
      setRoom("");
    } catch (err) {
      console.error("Device assignment failed:", err);
      alert("Failed to assign devices. Please try again.");
    } finally {
      setAssigning(false);
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
            Estate & local network scan
          </p>
        </div>

        <button
          onClick={discover}
          disabled={scanning}
          className={`px-3 py-1.5 rounded-full text-xs font-medium
            ${
              scanning
                ? "bg-gray-700 text-gray-400"
                : "bg-[#E11D2E] text-white"
            }`}
        >
          {scanning ? "Scanning…" : "Search again"}
        </button>
      </div>

      {/* SCANNING STATE */}
      {scanning && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          Discovering devices…
        </div>
      )}

      {/* DEVICE LIST */}
      <div className="space-y-2">
        {devices.map((d) => (
          <label
            key={d.id}
            className="flex items-center justify-between
                       bg-gray-800 border border-gray-700
                       rounded-xl px-3 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!selected[d.id]}
                disabled={d.status === "Assigned"}
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
                  {d.protocol || d.ip || "—"}
                </div>
              </div>
            </div>

            <span
              className={`text-xs ${
                d.status === "Assigned"
                  ? "text-green-400"
                  : "text-gray-400"
              }`}
            >
              {d.status || "Available"}
            </span>
          </label>
        ))}

        {!scanning && devices.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            No devices found. Try scanning again.
          </div>
        )}
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
          <div className="text-xs text-gray-300">
            {selectedIds.length} device(s) selected
          </div>

          {/* ROOM ASSIGNMENT */}
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700
                       rounded-lg px-3 py-2 text-sm text-white"
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
            disabled={assigning}
            className={`w-full py-2 rounded-xl text-sm font-medium
              ${
                assigning
                  ? "bg-gray-700 text-gray-400"
                  : "bg-[#E11D2E] text-white"
              }`}
          >
            {assigning ? "Assigning…" : "Add Selected Devices"}
          </button>
        </div>
      )}
    </div>
  );
}
