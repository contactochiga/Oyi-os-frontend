"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import { deviceService } from "@/services/deviceService";

type RoomStatus = "active" | "idle" | "automated";

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

function inferStatus(room: RoomDTO): RoomStatus {
  const n = Array.isArray(room.devices) ? room.devices.length : 0;
  if (n >= 4) return "active";
  if (n >= 2) return "automated";
  return "idle";
}

// 🔑 choose a stable device identifier for commands
function commandDeviceId(d: any): string | null {
  // your devices table has: id(uuid) and external_id(text)
  // For command routing, we prefer external_id (Tuya devId), but fallback to uuid id.
  return (
    d?.external_id ||
    d?.externalId ||
    d?.device_id ||
    d?.dev_id ||
    d?.id ||
    null
  )?.toString() ?? null;
}

export default function RoomsPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user]
  );

  const homeId = useMemo(
    () =>
      (user as any)?.home_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null),
    [user]
  );

  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ NEW: which room is expanded for manage
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  // ✅ NEW: simple local toggle loading map
  const [cmdBusy, setCmdBusy] = useState<Record<string, boolean>>({});

  function touch() {
    onInteraction?.();
  }

  async function loadRooms() {
    if (!homeId) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await roomsService.getRooms(homeId);
      setRooms(list || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!homeId) return;
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  async function createRoom() {
    if (!estateId) return setErr("No estateId found for this user.");
    if (!homeId) return setErr("No homeId found for this user.");

    const name = window.prompt("Room name (e.g. Living Room)");
    if (!name) return;

    setLoading(true);
    setErr(null);
    try {
      await roomsService.createRoom({
        estate_id: estateId,
        home_id: homeId,
        name,
        type: null,
        ai_profile: null,
      });
      await loadRooms();
      touch();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  // ✅ NEW: basic command helpers (MVP)
  async function toggleDevice(d: any) {
    const did = commandDeviceId(d);
    if (!did) {
      setErr("This device has no command id (external_id / id missing).");
      return;
    }

    // We don’t know the exact Tuya datapoint codes for every device yet.
    // MVP: try common switch codes.
    const key = `toggle:${did}`;

    setCmdBusy((s) => ({ ...s, [key]: true }));
    setErr(null);

    try {
      // naive: toggle based on a cached online/status
      // You can improve later by calling getDeviceState first.
      await deviceService.sendCommand(did, { switch_1: true });
      touch();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to send command");
    } finally {
      setCmdBusy((s) => ({ ...s, [key]: false }));
    }
  }

  return (
    <RemotePanel title="Rooms" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {!homeId && (
        <div className="text-sm text-gray-400">
          No home selected yet. Join/choose a home to view rooms.
        </div>
      )}

      {homeId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {loading ? "Loading…" : `${rooms.length} room(s)`}
            </div>

            <button
              onClick={loadRooms}
              disabled={loading}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-700 text-white disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
              Syncing rooms…
            </div>
          )}

          {rooms.map((room) => {
            const devices = Array.isArray(room.devices) ? room.devices : [];
            const devicesCount = devices.length;
            const status = inferStatus(room);
            const isOpen = openRoomId === room.id;

            return (
              <div
                key={room.id}
                className="rounded-xl bg-gray-800 border border-gray-700 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm text-white font-medium">
                      {room.name || "Unnamed Room"}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span>{devicesCount} devices</span>
                      <span>•</span>
                      <span className={statusColor(status)}>{status}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setOpenRoomId((prev) => (prev === room.id ? null : room.id));
                      touch();
                    }}
                    className="btn-tv"
                  >
                    {isOpen ? "Close" : "Manage"}
                  </button>
                </div>

                {/* ✅ NEW: room-scoped devices */}
                {isOpen && (
                  <div className="space-y-2">
                    {devices.length === 0 ? (
                      <div className="text-xs text-gray-400">
                        No devices assigned to this room yet.
                      </div>
                    ) : (
                      devices.map((d: any) => {
                        const did = commandDeviceId(d) || "unknown";
                        const busy = !!cmdBusy[`toggle:${did}`];

                        return (
                          <div
                            key={d.id || d.external_id || did}
                            className="flex items-center justify-between rounded-xl bg-gray-900 border border-gray-700 px-3 py-2"
                          >
                            <div>
                              <div className="text-sm text-white">
                                {d.name || d.type || "Device"}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {d.type || "device"} • {d.status || "—"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleDevice(d)}
                              disabled={busy}
                              className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                            >
                              {busy ? "Sending…" : "Toggle"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* keep your placeholder scenes but they still do nothing for now */}
              </div>
            );
          })}

          {!loading && rooms.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-6">
              No rooms found for this home yet.
            </div>
          )}

          <button
            onClick={createRoom}
            disabled={loading || !homeId}
            className="w-full py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-medium active:scale-95 transition disabled:opacity-50"
          >
            + Create New Room
          </button>
        </div>
      )}
    </RemotePanel>
  );
}
