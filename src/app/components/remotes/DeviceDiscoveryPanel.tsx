// src/app/components/remotes/DeviceDiscoveryPanel.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { deviceService } from "@/services/deviceService";

type Device = {
  // Discovery payloads may NOT have id
  id?: string;

  // Common fields from Tuya discovery / your backend
  externalId?: string;
  external_id?: string;
  adapter?: string;
  vendor?: string;

  name?: string;
  type?: string;
  ip?: string;
  protocol?: string;
  status?: string;

  // allow extra fields without TS complaints
  [k: string]: any;
};

const ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Other"];

/**
 * ✅ Stable unique key for UI selection.
 * Tuya discovery often returns externalId/external_id, not id.
 */
function deviceKey(d: Device): string {
  const stable =
    d.id ||
    d.externalId ||
    d.external_id ||
    d.dev_id ||
    d.device_id ||
    d.uuid ||
    null;

  if (stable) return String(stable);

  // last fallback: still guarantee uniqueness across list
  return `${d.adapter || d.vendor || "device"}:${d.name || d.type || "unknown"}:${d.ip || ""}`;
}

export default function DeviceDiscoveryPanel({
  devices: initialDevices = [],
}: {
  devices?: Device[];
}) {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // selected map uses the stable key, not d.id
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [room, setRoom] = useState("");

  // ✅ user feedback
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  function flash(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setNotice(null), 3500);
  }

  // normalize devices with __key for rendering and selection
  const keyedDevices = useMemo(() => {
    return (devices || []).map((d) => ({
      ...d,
      __key: deviceKey(d),
    })) as Array<Device & { __key: string }>;
  }, [devices]);

  /* -----------------------------
     INITIAL LOAD / REFRESH
  ------------------------------ */
  async function refreshDevices() {
    setLoading(true);
    setNotice(null);
    try {
      const result = await deviceService.getDevices();
      setDevices(result || []);
      setSelected({});
    } catch (e: any) {
      flash("error", e?.message || "Failed to load devices");
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
  async function addDevices(keys: string[]) {
    if (keys.length === 0) return;
    if (assigning) return;

    setAssigning(true);
    setNotice(null);

    try {
      // ✅ Send stable keys (external ids) so backend can map correctly
      const res: any = await deviceService.assignDevices({
        deviceIds: keys,
        room: room || null,
      });

      // ✅ success signal
      const savedCount =
        Array.isArray(res?.devices) ? res.devices.length : keys.length;

      flash(
        "success",
        `✅ Added ${savedCount} device${savedCount === 1 ? "" : "s"}${
          room ? ` to ${room}` : ""
        }.`
      );

      // Re-fetch devices after assignment
      const updated = await deviceService.getDevices();
      setDevices(updated || []);
      setSelected({});
      setRoom("");
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to add devices";
      flash("error", `❌ ${msg}`);
    } finally {
      setAssigning(false);
    }
  }

  const selectedKeys = Object.keys(selected).filter((k) => selected[k]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Device Discovery</h3>
          <p className="text-xs text-gray-400">Estate & account devices</p>
        </div>

        <button
          onClick={refreshDevices}
          disabled={loading || assigning}
          className={`px-3 py-1.5 rounded-full text-xs font-medium
            ${
              loading || assigning
                ? "bg-gray-700 text-gray-400"
                : "bg-[#E11D2E] text-white"
            }`}
        >
          {loading ? "Loading…" : assigning ? "Saving…" : "Refresh"}
        </button>
      </div>

      {/* NOTICE */}
      {notice && (
        <div
          className={`rounded-xl px-3 py-2 text-xs border ${
            notice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
              : "bg-red-500/10 border-red-500/20 text-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* LOADING */}
      {(loading || assigning) && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          {loading ? "Syncing devices…" : "Assigning devices…"}
        </div>
      )}

      {/* DEVICE LIST */}
      <div className="space-y-2">
        {keyedDevices.map((d) => (
          <label
            key={d.__key}
            className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!selected[d.__key]}
                onChange={() =>
                  setSelected((s) => ({
                    ...s,
                    [d.__key]: !s[d.__key],
                  }))
                }
                disabled={loading || assigning}
              />

              <div>
                <div className="text-sm text-white">
                  {d.name || d.type || "Unknown Device"}
                </div>
                <div className="text-xs text-gray-400">
                  {d.protocol || d.ip || d.adapter || d.vendor || ""}
                </div>
              </div>
            </div>

            <span className="text-xs text-gray-400">
              {d.status || "Available"}
            </span>
          </label>
        ))}

        {!loading && keyedDevices.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            No devices found.
          </div>
        )}
      </div>

      {/* BULK ACTION */}
      {selectedKeys.length > 0 && (
        <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
          <div className="text-xs text-gray-300">
            {selectedKeys.length} device(s) selected
          </div>

          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            disabled={assigning}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            <option value="">Assign to room (optional)</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={() => addDevices(selectedKeys)}
            disabled={assigning}
            className="w-full py-2 rounded-xl bg-[#E11D2E] text-white text-sm font-medium active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {assigning ? "Adding…" : "Add Selected Devices"}
          </button>
        </div>
      )}
    </div>
  );
}
