"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import API from "@/services/api";
import { io as socketIo, type Socket } from "socket.io-client";
import useAuth from "@/hooks/useAuth";

type SensorStatus = "normal" | "warning" | "critical";

type Sensor = {
  id: string;
  name: string;
  value: string;
  status: SensorStatus;
};

type DeviceStatePayload = {
  deviceId: string;
  state: any;
  topic?: string;
};

function toStatus(v: any): SensorStatus {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("critical") || s.includes("alarm") || s.includes("danger")) return "critical";
  if (s.includes("warn") || s.includes("leak") || s.includes("detected")) return "warning";
  return "normal";
}

/**
 * Map your backend device "state" shape into UI sensors list.
 * Adjust this based on your real payload from MQTT / Tuya / LAN adapters.
 */
function mapStateToSensors(state: any): Sensor[] {
  if (!state) return [];

  // Example shapes supported:
  // 1) { sensors: [{ id,name,value,status }] }
  if (Array.isArray(state?.sensors)) {
    return state.sensors.map((x: any) => ({
      id: String(x.id ?? x.name ?? Math.random()),
      name: String(x.name ?? x.id ?? "Sensor"),
      value: String(x.value ?? ""),
      status: (x.status as SensorStatus) ?? toStatus(x.value),
    }));
  }

  // 2) Flat values (common from IoT):
  // { motion: "No movement", smoke: "Clear", gas: "Leak detected", water: "Dry" }
  const keys = ["motion", "smoke", "gas", "water", "door", "temp", "humidity"];
  const present = keys.filter((k) => state[k] !== undefined);

  if (present.length) {
    return present.map((k) => ({
      id: k,
      name:
        k === "temp"
          ? "Temperature"
          : k === "humidity"
          ? "Humidity"
          : k === "door"
          ? "Door Sensor"
          : k === "water"
          ? "Water Leak"
          : k === "gas"
          ? "Gas Sensor"
          : k === "smoke"
          ? "Smoke Detector"
          : "Motion Sensor",
      value: String(state[k]),
      status: toStatus(state[k]),
    }));
  }

  // 3) Unknown payload: show raw json
  return [
    {
      id: "raw",
      name: "Sensor State",
      value: typeof state === "string" ? state : JSON.stringify(state),
      status: "normal",
    },
  ];
}

export default function SensorsPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();

  const estateId = useMemo(() => {
    if (user?.estate_id) return user.estate_id;
    if (typeof window !== "undefined") return localStorage.getItem("ochiga_estate");
    return null;
  }, [user?.estate_id]);

  const [sensors, setSensors] = useState<Sensor[]>([
    // fallback placeholders
    { id: "motion", name: "Motion Sensor", value: "No movement", status: "normal" },
    { id: "smoke", name: "Smoke Detector", value: "Clear", status: "normal" },
    { id: "gas", name: "Gas Sensor", value: "Unknown", status: "warning" },
    { id: "water", name: "Water Leak", value: "Dry", status: "normal" },
  ]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function color(status: SensorStatus) {
    switch (status) {
      case "critical":
        return "text-red-400";
      case "warning":
        return "text-yellow-300";
      default:
        return "text-green-300";
    }
  }

  async function fetchState(id: string) {
    setLoading(true);
    setErr(null);
    try {
      // ✅ You implement this backend route:
      // GET /devices/:deviceId/state -> { state: {...} }  OR direct state object
      const res = await API.get(`/devices/${encodeURIComponent(id)}/state`);
      const data = res.data?.state ?? res.data;

      const mapped = mapStateToSensors(data);
      if (mapped.length) setSensors(mapped);

      onInteraction?.();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load sensors");
    } finally {
      setLoading(false);
    }
  }

  // initial fetch
  useEffect(() => {
    if (!deviceId) return;
    fetchState(deviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // realtime socket updates
  useEffect(() => {
    if (!deviceId) return;
    if (!estateId) return;

    let socket: Socket | null = null;

    try {
      const base =
        process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
        "http://localhost:5000";

      socket = socketIo(base, {
        transports: ["websocket"],
        withCredentials: true,
      });

      socket.on("connect", () => {
        socket?.emit("subscribe:estate", estateId);
      });

      socket.on("device:update", (payload: DeviceStatePayload) => {
        if (!payload?.deviceId) return;
        if (payload.deviceId !== deviceId) return;

        const mapped = mapStateToSensors(payload.state);
        if (mapped.length) setSensors(mapped);

        onInteraction?.();
      });

      socket.on("connect_error", () => {
        // don’t spam UI; only show if you want
      });
    } catch {
      // ignore
    }

    return () => {
      try {
        socket?.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, estateId]);

  return (
    <RemotePanel title="Sensors" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">
          {loading ? "Syncing…" : "Live status"}
        </div>

        <button
          onClick={() => deviceId && fetchState(deviceId)}
          disabled={!deviceId || loading}
          className={`px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50
            ${loading ? "bg-gray-700 text-gray-300" : "bg-[#E11D2E] text-white"}`}
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {sensors.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700"
          >
            <div>
              <div className="text-sm text-white">{s.name}</div>
              <div className="text-xs text-gray-400">{s.value}</div>
            </div>

            <div className={`text-xs font-medium ${color(s.status)}`}>
              {s.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No sensor device bound yet. Bind a sensor hub/device to enable live state.
        </div>
      )}
    </RemotePanel>
  );
}
