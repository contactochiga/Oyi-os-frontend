"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import { deviceService } from "@/services/deviceService";

type RoomStatus = "active" | "idle" | "automated";

function statusBadge(status: RoomStatus) {
  if (status === "active") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (status === "automated") return "border-blue-500/20 bg-blue-500/10 text-blue-200";
  return "border-white/10 bg-black/20 text-white/60";
}

function inferStatus(room: RoomDTO): RoomStatus {
  const n = Array.isArray(room.devices) ? room.devices.length : 0;
  if (n >= 4) return "active";
  if (n >= 2) return "automated";
  return "idle";
}

function commandDeviceId(d: any): string | null {
  return (d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.id || null)?.toString() ?? null;
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
    () => (user as any)?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user]
  );

  const homeId = useMemo(
    () => (user as any)?.home_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null),
    [user]
  );

  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
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
      setRooms(Array.isArray(list) ? list : []);
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

  useEffect(() => {
    if (!lastUpdated) return;
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  async function createRoom() {
    if (!estateId) return setErr("No estate linked.");
    if (!homeId) return setErr("No home linked.");

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

  async function toggleDevice(d: any) {
    const did = commandDeviceId(d);
    if (!did) return setErr("Device id missing (external_id / id).");

    const key = `toggle:${did}`;
    setCmdBusy((s) => ({ ...s, [key]: true }));
    setErr(null);

    try {
      // NOTE: your API differs: earlier you used commandDevice(id, payload)
      // Use whichever exists in your deviceService. Keeping your current call:
      await (deviceService as any).sendCommand?.(did, { switch_1: true });
      touch();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to send command");
    } finally {
      setCmdBusy((s) => ({ ...s, [key]: false }));
    }
  }

  return (
    <RemotePanel
      title="Rooms"
      lastUpdated={lastUpdated}
      right={
        <button
          onClick={loadRooms}
          disabled={loading || !homeId}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 disabled:opacity-50"
          type="button"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      }
    >
      {err && (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {!homeId ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No home linked yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => {
            const devices = Array.isArray(room.devices) ? room.devices : [];
            const status = inferStatus(room);
            const isOpen = openRoomId === room.id;

            return (
              <div key={room.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white/90 truncate">
                      {room.name || "Room"}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-white/45">{devices.length} devices</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusBadge(status)}`}>
                        {status}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenRoomId((prev) => (prev === room.id ? null : room.id));
                      touch();
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10"
                  >
                    {isOpen ? "Close" : "Manage"}
                  </button>
                </div>

                {isOpen ? (
                  <div className="mt-3 space-y-2">
                    {devices.length === 0 ? (
                      <div className="text-sm text-white/50">No devices assigned.</div>
                    ) : (
                      devices.map((d: any) => {
                        const did = commandDeviceId(d) || "unknown";
                        const busy = !!cmdBusy[`toggle:${did}`];

                        return (
                          <div key={d.id || d.external_id || did} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-[13px] text-white/85 truncate">
                                {d.name || d.type || "Device"}
                              </div>
                              <div className="text-[11px] text-white/40 truncate">
                                {d.type || "device"}{d.status ? ` • ${d.status}` : ""}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleDevice(d)}
                              disabled={busy}
                              className="px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold border border-white/20 disabled:opacity-60"
                            >
                              {busy ? "Sending…" : "Toggle"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {!loading && rooms.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              No rooms yet.
            </div>
          ) : null}

          <button
            onClick={createRoom}
            disabled={loading || !homeId}
            className="w-full py-3 rounded-2xl bg-white text-black text-sm font-semibold border border-white/20 disabled:opacity-60"
            type="button"
          >
            Create room
          </button>
        </div>
      )}
    </RemotePanel>
  );
}
