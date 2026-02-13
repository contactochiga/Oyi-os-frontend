"use client";

import React, { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";

type Device = {
  id?: string; // internal uuid
  external_id?: string;
  externalId?: string;
  dev_id?: string;
  device_id?: string;
  uuid?: string;

  estate_id?: string;
  home_id?: string;
  room_id?: string | null;

  name?: string;
  type?: string;
  category?: string;
  vendor?: string;
  adapter?: string;

  status?: string;
  online?: boolean;
  icon?: string;

  metadata?: any;
  [k: string]: any;
};

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function pickExternalId(d: Device): string {
  return (
    cleanStr(d.external_id) ||
    cleanStr(d.externalId) ||
    cleanStr(d.device_id) ||
    cleanStr(d.dev_id) ||
    cleanStr(d.uuid) ||
    ""
  );
}

function pickStableId(d: Device): string {
  // Prefer internal uuid for state lookups / commands if your backend uses it.
  // But if your backend expects external_id, we’ll use that when needed.
  return cleanStr(d.id) || pickExternalId(d) || `tmp_${Math.random().toString(36).slice(2, 9)}`;
}

function pickLabel(d: Device) {
  return cleanStr(d.name) || cleanStr(d.type) || cleanStr(d.category) || "Device";
}

function pickMeta(d: Device) {
  const v = cleanStr(d.vendor || d.adapter || "tuya");
  const ext = pickExternalId(d);
  const st = cleanStr(d.status) || (typeof d.online === "boolean" ? (d.online ? "online" : "offline") : "");
  return `${v}${ext ? ` • id:${ext}` : ""}${st ? ` • ${st}` : ""}`;
}

function roomNameFromMetadata(d: Device): string {
  // If you stored room name into metadata at some point, show it.
  // Otherwise shows “Unassigned”.
  const m = d.metadata || {};
  return cleanStr(m.room_name || m.roomName || "");
}

function uniqRooms(devices: Device[]) {
  const set = new Set<string>();
  for (const d of devices) {
    const rn = roomNameFromMetadata(d);
    if (rn) set.add(rn);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// --- Premium demo data (for screenshots)
const DEMO_DEVICES: Device[] = [
  { id: "demo-1", name: "Living Room Lights", type: "light", vendor: "tuya", status: "online", metadata: { room_name: "Living Room" } },
  { id: "demo-2", name: "Bedroom Lights", type: "light", vendor: "tuya", status: "online", metadata: { room_name: "Bedroom" } },
  { id: "demo-3", name: "Room AC Switch", type: "switch", vendor: "tuya", status: "online", metadata: { room_name: "Bedroom" } },
  { id: "demo-4", name: "Smart TV", type: "tv", vendor: "tuya", status: "online", metadata: { room_name: "Living Room" } },
  { id: "demo-5", name: "Door Lock", type: "lock", vendor: "tuya", status: "online", metadata: { room_name: "Entrance" } },
];

type UiState = {
  power?: boolean; // our UI “power” state (for screenshots)
  busy?: boolean;
  last?: string; // last action label
  error?: string | null;
};

export default function DevicesClient() {
  const { user } = useAuth();

  const estateId = useMemo(() => {
    return (
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null)
    );
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [ui, setUi] = useState<Record<string, UiState>>({});

  // Screenshot helpers
  const [demoMode, setDemoMode] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [roomFilter, setRoomFilter] = useState("");

  async function loadAssigned() {
    setLoading(true);
    setErr(null);
    try {
      if (!estateId) {
        setDevices([]);
        return;
      }

      // Your service currently uses:
      // estateId => /devices/estate/:estateId
      // which is OK for now (even if it's still discovery-ish)
      const list = await deviceService.getDevices(estateId);
      const arr = Array.isArray(list) ? list : [];
      setDevices(arr);

      // If empty, keep your page useful for screenshots
      if (!arr.length) setDemoMode(true);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load devices");
      setDevices([]);
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  const visibleDevices = useMemo(() => {
    const src = demoMode ? DEMO_DEVICES : devices;

    const qq = q.trim().toLowerCase();
    return src.filter((d) => {
      const label = pickLabel(d).toLowerCase();
      const meta = pickMeta(d).toLowerCase();
      const rn = roomNameFromMetadata(d).toLowerCase();

      const matchQ = !qq || label.includes(qq) || meta.includes(qq) || rn.includes(qq);
      const matchRoom = !roomFilter || rn === roomFilter.toLowerCase();
      return matchQ && matchRoom;
    });
  }, [devices, demoMode, q, roomFilter]);

  const rooms = useMemo(() => uniqRooms(demoMode ? DEMO_DEVICES : devices), [devices, demoMode]);

  function setBusy(id: string, busy: boolean, patch?: Partial<UiState>) {
    setUi((s) => ({ ...s, [id]: { ...(s[id] || {}), busy, ...(patch || {}) } }));
  }

  function setPower(id: string, power: boolean, patch?: Partial<UiState>) {
    setUi((s) => ({ ...s, [id]: { ...(s[id] || {}), power, ...(patch || {}) } }));
  }

  async function sendPower(d: Device, on: boolean) {
    const stableId = pickStableId(d);
    const externalId = pickExternalId(d);

    // optimistic UI for screenshots
    setBusy(stableId, true, { error: null, last: on ? "Turning on…" : "Turning off…" });
    setPower(stableId, on);

    // If you want perfect screenshots: demoMode makes it always succeed visually
    if (demoMode) {
      window.setTimeout(() => {
        setBusy(stableId, false, { last: on ? "On" : "Off" });
      }, 450);
      return;
    }

    try {
      // IMPORTANT: Your backend command route likely expects the “assigned device id”
      // If your backend expects external_id instead, switch deviceId below to externalId.
      const deviceIdForCommand = cleanStr(d.id) || externalId || stableId;

      // Generic Tuya-ish switch payload (your backend/adapter can map later)
      // Works for screenshot flows, even if adapter ignores for now.
      const command = { power: on, switch: on, switch_1: on };

      await deviceService.commandDevice(deviceIdForCommand, command);

      setBusy(stableId, false, { last: on ? "On" : "Off" });
    } catch (e: any) {
      // keep power state visually (for screenshots), but show error if not in screenshot mode
      const msg = e?.response?.data?.error || e?.message || "Command failed";
      setBusy(stableId, false, { error: msg, last: "Failed" });

      if (screenshotMode) {
        // hide failures during screenshot session
        setUi((s) => ({ ...s, [stableId]: { ...(s[stableId] || {}), error: null } }));
      }
    }
  }

  return (
    <ConsumerShell title="Devices" subtitle="Device Command Center">
      {/* Top controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={loadAssigned}
            disabled={loading}
            className="rounded-xl px-3 py-2 text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScreenshotMode((v) => !v)}
              className="rounded-xl px-3 py-2 text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
            >
              {screenshotMode ? "Screenshot Mode: ON" : "Screenshot Mode: OFF"}
            </button>

            <button
              type="button"
              onClick={() => setDemoMode((v) => !v)}
              className="rounded-xl px-3 py-2 text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
              title="Use clean demo data (for App Store screenshots)"
            >
              {demoMode ? "Demo Mode: ON" : "Demo Mode: OFF"}
            </button>
          </div>
        </div>

        {!screenshotMode && err && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Search + room filter */}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search devices (light, TV, switch…) "
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/85 outline-none"
          />

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/85 outline-none"
          >
            <option value="">All rooms</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Tiny status line */}
        <div className="text-xs text-white/45">
          Showing <span className="text-white/80 font-semibold">{visibleDevices.length}</span>{" "}
          device{visibleDevices.length === 1 ? "" : "s"}
          {demoMode ? <span className="ml-2 text-white/35">(demo)</span> : null}
        </div>
      </div>

      {/* Device grid */}
      <div className="mt-4 grid gap-3">
        {visibleDevices.map((d) => {
          const stableId = pickStableId(d);
          const state = ui[stableId] || {};
          const rn = roomNameFromMetadata(d);
          const power = typeof state.power === "boolean" ? state.power : undefined;

          return (
            <div
              key={stableId}
              className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 transition p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] text-white font-semibold truncate">
                    {pickLabel(d)}
                  </div>

                  <div className="mt-1 text-[11px] text-white/45 truncate">
                    {rn ? `${rn} • ` : ""}
                    {pickMeta(d)}
                  </div>

                  {!screenshotMode && state.error ? (
                    <div className="mt-2 text-[12px] text-red-200">
                      {state.error}
                    </div>
                  ) : null}
                </div>

                {/* power pill */}
                <div
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] border ${
                    power === true
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                      : power === false
                      ? "bg-zinc-500/10 border-white/10 text-white/55"
                      : "bg-sky-500/10 border-sky-500/20 text-sky-200"
                  }`}
                  title="UI state (for screenshots)"
                >
                  {power === true ? "On" : power === false ? "Off" : "Ready"}
                </div>
              </div>

              {/* actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!!state.busy}
                  onClick={() => sendPower(d, true)}
                  className="rounded-xl py-2 text-sm font-semibold border border-white/10 bg-white text-black hover:bg-white/90 disabled:opacity-60"
                >
                  {state.busy && state.last?.includes("on") ? "Turning on…" : "Turn On"}
                </button>

                <button
                  type="button"
                  disabled={!!state.busy}
                  onClick={() => sendPower(d, false)}
                  className="rounded-xl py-2 text-sm font-semibold border border-white/10 bg-white/10 text-white/85 hover:bg-white/15 disabled:opacity-60"
                >
                  {state.busy && state.last?.includes("off") ? "Turning off…" : "Turn Off"}
                </button>
              </div>

              {/* small footer */}
              <div className="mt-2 text-[11px] text-white/35">
                {state.last ? `Last: ${state.last}` : "Commands update instantly (optimistic UI)."}
              </div>
            </div>
          );
        })}

        {visibleDevices.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 text-center">
            No devices to show. Turn on <span className="text-white/85 font-semibold">Demo Mode</span> to take screenshots.
          </div>
        )}
      </div>
    </ConsumerShell>
  );
}
