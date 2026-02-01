// src/app/rooms/[roomId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import API from "@/services/api";

type CommandPayload = Record<string, any>;

async function sendCommand(deviceId: string, command: CommandPayload) {
  // Your backend route should exist: POST /devices/:deviceId/command
  return API.post(`/devices/${encodeURIComponent(deviceId)}/command`, { command });
}

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = String(params?.roomId || "");

  const { user } = useAuth();

  const homeId = useMemo(
    () =>
      (user as any)?.home_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null),
    [user]
  );

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!homeId || !roomId) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await roomsService.getRooms(homeId);
      const found = (list || []).find((r) => r.id === roomId) || null;
      setRoom(found);
      if (!found) setErr("Room not found for this home.");
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load room");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, roomId]);

  const devices = Array.isArray(room?.devices) ? room!.devices! : [];

  async function toggleSwitch(device: any, on: boolean) {
    // Tuya commonly uses command: { switch: true/false } or { switch_1: true } etc.
    // We'll attempt best-effort based on metadata if present.
    const deviceId = device.external_id || device.externalId || device.id;
    if (!deviceId) return;

    setBusyId(String(deviceId));
    setErr(null);

    try {
      // Pick a likely switch code
      const meta = device.metadata || device.meta || {};
      const raw = meta?.raw || meta || {};

      // If you stored Tuya "functions" later, you'd pick from that.
      // For now, try common ones.
      const code =
        raw?.switch_code ||
        raw?.switch ||
        "switch";

      await sendCommand(String(deviceId), { [code]: on });

      // Optional: optimistic UI (update local status)
      // Later you’ll replace this with real state polling/websocket updates.
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/rooms")}
          className="px-3 py-2 rounded-xl bg-gray-800 text-sm text-white border border-gray-700"
        >
          ← Back
        </button>

        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-gray-800 text-sm text-white border border-gray-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
        <div className="text-lg font-semibold text-white">
          {room?.name || "Room"}
        </div>
        <div className="text-sm text-gray-400">
          {devices.length} device(s)
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          Loading…
        </div>
      )}

      <div className="space-y-3">
        {devices.map((d: any) => {
          const deviceId = d.external_id || d.externalId || d.id;
          const label = d.name || d.type || "Device";

          return (
            <div
              key={String(deviceId || label)}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">
                    {label}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {d.type || "device"} • {d.vendor || d.adapter || "vendor"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={busyId === String(deviceId)}
                    onClick={() => toggleSwitch(d, true)}
                    className="px-3 py-2 rounded-xl bg-[#E11D2E] text-sm text-white disabled:opacity-50"
                  >
                    On
                  </button>
                  <button
                    disabled={busyId === String(deviceId)}
                    onClick={() => toggleSwitch(d, false)}
                    className="px-3 py-2 rounded-xl bg-gray-800 text-sm text-white border border-gray-700 disabled:opacity-50"
                  >
                    Off
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && devices.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-10">
            No devices assigned to this room yet.
          </div>
        )}
      </div>
    </div>
  );
}
