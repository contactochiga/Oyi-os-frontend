"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import ConsumerShell from "@/app/components/ConsumerShell";

type RoomStatus = "active" | "idle" | "automated";

function inferStatus(room: RoomDTO): RoomStatus {
  const n = Array.isArray(room.devices) ? room.devices.length : 0;
  if (n >= 4) return "active";
  if (n >= 2) return "automated";
  return "idle";
}

function statusBadge(status: RoomStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/15";
    case "automated":
      return "bg-sky-500/10 text-sky-300 border-sky-500/15";
    default:
      return "bg-zinc-500/10 text-zinc-300 border-white/10";
  }
}

export default function RoomsClient() {
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
    <ConsumerShell title="Rooms" subtitle="All rooms in this home">
      {/* Actions row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRooms}
            disabled={loading}
            className="
              rounded-xl px-3 py-2 text-sm
              border border-white/10
              bg-white/5 hover:bg-white/8
              text-white/90
              active:scale-[0.99] transition
              disabled:opacity-50
            "
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={createRoom}
            disabled={loading || !homeId}
            className="
              rounded-xl px-3 py-2 text-sm font-medium
              bg-white text-black
              hover:bg-white/90
              active:scale-[0.99] transition
              disabled:opacity-50
            "
          >
            + Create
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* Missing home */}
      {!homeId && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          No home selected yet. Join/choose a home to view rooms.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading rooms…
        </div>
      )}

      {/* Rooms list */}
      <div className="mt-4 space-y-2">
        {rooms.map((room) => {
          const devicesCount = Array.isArray(room.devices) ? room.devices.length : 0;
          const status = inferStatus(room);

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => router.push(`/room?roomId=${room.id}`)}
              className="
                w-full text-left rounded-2xl
                border border-white/10
                bg-white/5 hover:bg-white/8
                px-4 py-4
                transition
              "
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] text-white font-medium truncate">
                    {room.name || "Unnamed Room"}
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-white/55">
                    <span>{devicesCount} devices</span>
                    <span className="text-white/25">•</span>

                    <span
                      className={`
                        inline-flex items-center
                        rounded-full px-2 py-0.5
                        border
                        ${statusBadge(status)}
                      `}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                <span className="text-xs text-white/45 whitespace-nowrap">
                  Open →
                </span>
              </div>
            </button>
          );
        })}

        {!loading && rooms.length === 0 && homeId && (
          <div className="text-sm text-white/45 text-center py-10">
            No rooms found for this home yet.
          </div>
        )}
      </div>
    </ConsumerShell>
  );
}
