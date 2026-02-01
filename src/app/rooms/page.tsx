// src/app/rooms/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const n = Array.isArray(room.devices) ? room.devices.length : 0;
  if (n >= 4) return "active";
  if (n >= 2) return "automated";
  return "idle";
}

export default function RoomsPage() {
  const router = useRouter();
  const { user } = useAuth();

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

    const name = window.prompt("Room name (e.g. Bedroom)");
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
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Rooms</h1>
          <p className="text-sm text-gray-400">All rooms in this home</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadRooms}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-gray-800 text-sm text-white border border-gray-700 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={createRoom}
            disabled={loading || !homeId}
            className="px-3 py-2 rounded-xl bg-[#E11D2E] text-sm text-white disabled:opacity-50"
          >
            + Create
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {!homeId && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-gray-400">
          No home selected yet. Join/choose a home to view rooms.
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          Loading rooms…
        </div>
      )}

      <div className="space-y-3">
        {rooms.map((room) => {
          const devicesCount = Array.isArray(room.devices) ? room.devices.length : 0;
          const status = inferStatus(room);

          return (
            <button
              key={room.id}
              onClick={() => router.push(`/rooms/${room.id}`)}
              className="w-full text-left rounded-2xl bg-gray-900 border border-gray-800 p-4 hover:bg-gray-800/60 transition"
            >
              <div className="flex items-start justify-between">
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

                <span className="text-xs text-gray-400">Open →</span>
              </div>
            </button>
          );
        })}

        {!loading && rooms.length === 0 && homeId && (
          <div className="text-sm text-gray-500 text-center py-10">
            No rooms found for this home yet.
          </div>
        )}
      </div>
    </div>
  );
}
