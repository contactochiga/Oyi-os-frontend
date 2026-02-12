// src/app/components/remotes/DeviceDiscoveryPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import { deviceService } from "@/services/deviceService";

type Device = {
  id?: string; // sometimes internal uuid (after assigned)
  externalId?: string;
  external_id?: string;
  device_id?: string;
  dev_id?: string;
  uuid?: string;

  adapter?: string;
  vendor?: string;
  name?: string;
  type?: string;
  category?: string;

  ip?: string;
  protocol?: string;
  status?: string;
  online?: boolean;
  icon?: string;

  metadata?: any;
  [k: string]: any;
};

const ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Other"];

/** ✅ Discovery → real “device id” we must bind by (external_id) */
function pickExternalId(d: Device): string | null {
  const v =
    d.external_id ??
    d.externalId ??
    d.device_id ??
    d.dev_id ??
    d.uuid ??
    null;

  if (!v) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** ✅ Stable UI key for React rendering only (NOT used for backend actions) */
function uiKey(d: Device): string {
  const ext = pickExternalId(d);
  if (ext) return `ext:${ext}`;
  return `tmp:${d.adapter || d.vendor || "device"}:${d.name || d.type || "unknown"}:${d.ip || ""}`;
}

function pickLabel(d: Device) {
  return d.name || d.type || d.category || "Device";
}

function pickMeta(d: Device) {
  return d.protocol || d.ip || d.adapter || d.vendor || "";
}

export default function DeviceDiscoveryPanel({
  devices: initialDevices = [],
  lastUpdated,
  onInteraction,
}: {
  devices?: Device[];
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  /**
   * ✅ Selection must be by external_id, not by UI key.
   * Because backend bind is strictly external_id.
   */
  const [selectedByExternalId, setSelectedByExternalId] = useState<Record<string, boolean>>({});
  const [room, setRoom] = useState("");

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function touch() {
    onInteraction?.();
  }

  function flash(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setNotice(null), 3200);
  }

  const keyedDevices = useMemo(() => {
    return (devices || []).map((d) => ({
      ...d,
      __uiKey: uiKey(d),
      __externalId: pickExternalId(d),
    })) as Array<Device & { __uiKey: string; __externalId: string | null }>;
  }, [devices]);

  const selectedExternalIds = useMemo(
    () => Object.keys(selectedByExternalId).filter((k) => selectedByExternalId[k]),
    [selectedByExternalId]
  );

  async function refreshDevices() {
    setLoading(true);
    setNotice(null);
    try {
      // ✅ ALWAYS discovery endpoint
      const result = await deviceService.discoverDevices();
      setDevices(Array.isArray(result) ? result : []);
      setSelectedByExternalId({});
      touch();
    } catch (e: any) {
      flash("error", e?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialDevices.length) refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRow(d: Device & { __externalId: string | null }) {
    const ext = d.__externalId;
    if (!ext) return;

    setSelectedByExternalId((prev) => ({ ...prev, [ext]: !prev[ext] }));
  }

  function clearSelection() {
    setSelectedByExternalId({});
  }

  async function bindSelected() {
    if (!selectedExternalIds.length || assigning) return;

    // ✅ Bind payload should contain full objects so backend stores metadata/vendor properly
    const selectedDevices = keyedDevices.filter((d) => d.__externalId && selectedByExternalId[d.__externalId]);

    // Guard
    if (!selectedDevices.length) {
      flash("error", "No valid devices selected (missing external_id).");
      return;
    }

    const payload: any = {
      devices: selectedDevices.map((d) => ({
        external_id: d.__externalId!,
        vendor: d.vendor || d.adapter || "tuya",
        adapter: d.adapter || d.vendor || "tuya",
        name: d.name || "Device",
        type: d.type || d.category || "device",
        icon: d.icon,
        ip: d.ip,
        protocol: d.protocol,
        online: typeof d.online === "boolean" ? d.online : undefined,
        metadata: d.metadata ?? d, // keep raw
      })),
      room: room || null,
    };

    setAssigning(true);
    setNotice(null);

    try {
      const res: any = await deviceService.assignDevices(payload);

      const savedCount = Array.isArray(res?.devices) ? res.devices.length : payload.devices.length;

      flash(
        "success",
        `Bound ${savedCount} device${savedCount === 1 ? "" : "s"}${room ? ` to ${room}` : ""}.`
      );

      // ✅ Refresh discovery list (optional)
      const updated = await deviceService.discoverDevices();
      setDevices(Array.isArray(updated) ? updated : []);
      clearSelection();
      setRoom("");
      touch();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to bind devices";
      flash("error", msg);
    } finally {
      setAssigning(false);
    }
  }

  const anySelectable = keyedDevices.some((d) => !!d.__externalId);

  return (
    <RemotePanel title="Discovery" lastUpdated={lastUpdated}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-white/45">
          {loading ? "Syncing…" : keyedDevices.length ? `${keyedDevices.length} found` : "No devices"}
        </div>

        <button
          type="button"
          onClick={refreshDevices}
          disabled={loading || assigning}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 disabled:opacity-50"
        >
          {loading ? "Loading…" : assigning ? "Saving…" : "Refresh"}
        </button>
      </div>

      {notice && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-xs border ${
            notice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
              : "bg-red-500/10 border-red-500/20 text-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      {(loading || assigning) && (
        <div className="mb-3 flex items-center gap-3 text-xs text-white/45">
          <div className="w-4 h-4 border-2 border-white/15 border-t-white/70 rounded-full animate-spin" />
          {loading ? "Syncing devices…" : "Binding…"}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {keyedDevices.map((d) => {
          const ext = d.__externalId;
          const checked = ext ? !!selectedByExternalId[ext] : false;

          return (
            <label
              key={d.__uiKey}
              className={`flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 cursor-pointer ${
                !ext ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRow(d)}
                  disabled={!ext || loading || assigning}
                  className="accent-white"
                />

                <div className="min-w-0">
                  <div className="text-[13px] text-white/90 font-semibold truncate">{pickLabel(d)}</div>

                  <div className="text-[11px] text-white/45 truncate">
                    {pickMeta(d)}
                    {ext ? ` • id:${ext}` : " • id:—"}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/40 shrink-0">
                {d.status
                  ? String(d.status)
                  : typeof d.online === "boolean"
                  ? d.online
                    ? "Online"
                    : "Offline"
                  : ext
                  ? "Available"
                  : "No ID"}
              </div>
            </label>
          );
        })}

        {!loading && keyedDevices.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No devices found.
          </div>
        )}
      </div>

      {/* Bottom bind bar */}
      {selectedExternalIds.length > 0 && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs text-white/60">{selectedExternalIds.length} selected</div>

            <button type="button" onClick={clearSelection} className="text-xs text-white/50 hover:text-white/70">
              Clear
            </button>
          </div>

          <div className="grid gap-2">
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              disabled={assigning}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/85 outline-none disabled:opacity-60"
            >
              <option value="">Bind to room (optional)</option>
              {ROOMS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={bindSelected}
              disabled={assigning}
              className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold border border-white/20 disabled:opacity-60"
            >
              {assigning ? "Binding…" : "Bind selected"}
            </button>

            <div className="text-[11px] text-white/40">
              Binding saves devices into your account/home/room, so AI can control them (switch, switch_1, etc).
            </div>
          </div>
        </div>
      )}

      {!anySelectable && !loading && keyedDevices.length > 0 && (
        <div className="mt-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Tuya discovery returned items without external_id. Check your discover controller mapping (must return externalId/external_id).
        </div>
      )}
    </RemotePanel>
  );
}
