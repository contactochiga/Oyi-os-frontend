"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";

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
  // simple heuristic for now (replace later with real signals/telemetry)
  const n = Array.isArray(room.devices) ? room.devices.length : 0;
  if (n >= 4) return "active";
  if (n >= 2) return "automated";
  return "idle";
}

export default function RoomsPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();

  // 🔑 Prefer real user.home_id if available. Fallback to localStorage.
  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
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

  function runAction(roomId: string, action: string) {
    // Placeholder until we create "room.scene.requested" signals
    console.log(`ROOM ACTION → ${roomId}: ${action}`);
    touch();
  }

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
          {/* top controls */}
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
            const devicesCount = Array.isArray(room.devices) ? room.devices.length : 0;
            const status = inferStatus(room);

            return (
              <div
                key={room.id}
                className="rounded-xl bg-gray-800 border border-gray-700 p-4"
              >
                {/* HEADER */}
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
                    onClick={() => runAction(room.id, "manage")}
                    className="btn-tv"
                  >
                    Manage
                  </button>
                </div>

                {/* QUICK SCENES (placeholder for now) */}
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

                <button
                  onClick={() => runAction(room.id, "automations")}
                  className="w-full py-2 rounded-lg bg-gray-900 text-xs text-gray-300 border border-gray-700"
                >
                  View Automations
                </button>
              </div>
            );
          })}

          {!loading && rooms.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-6">
              No rooms found for this home yet.
            </div>
          )}

          {/* FOOT ACTION */}
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
