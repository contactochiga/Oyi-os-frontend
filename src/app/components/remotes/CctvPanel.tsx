"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import StreamPlayer from "./StreamPlayer";
import API from "@/services/api";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";

type CameraDevice = {
  id: string;
  name?: string;
  category?: string;
  type?: string;
};

type StreamInfo = { type: "hls" | "webrtc"; url: string };

export default function CctvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();
  const estateId = useMemo(
    () => user?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const [cams, setCams] = useState<CameraDevice[]>([]);
  const [activeId, setActiveId] = useState<string | null>(deviceId ?? null);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function touch() {
    onInteraction?.();
  }

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const list = await deviceService.getDevices(estateId ?? undefined);
        const cameras = (list || []).filter((d: any) => {
          const c = String(d.category || d.type || "").toLowerCase();
          return c.includes("camera") || c.includes("cctv") || c.includes("onvif");
        });

        const normalized = cameras.map((d: any) => ({
          id: String(d.id || d.device_id || d.deviceId),
          name: d.name || d.local_name || "Camera",
          category: d.category,
          type: d.type,
        }));

        setCams(normalized);
        if (!activeId && normalized?.[0]?.id) setActiveId(normalized[0].id);
      } catch (e: any) {
        setErr(e?.message || "Failed to load cameras");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  useEffect(() => {
    if (!activeId) return;

    (async () => {
      setLoading(true);
      setErr(null);
      setStream(null);

      try {
        const res = await API.get(`/devices/${encodeURIComponent(activeId)}/stream`);
        const data = res.data;

        if (!data?.type || !data?.url) throw new Error("Stream not available for this camera yet.");

        setStream({ type: data.type, url: data.url });
        touch();
      } catch (e: any) {
        setErr(e?.response?.data?.error || e?.message || "Stream failed");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return (
    <RemotePanel title="CCTV" lastUpdated={lastUpdated}>
      {/* Top controls */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <select
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value || null)}
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/85 outline-none"
        >
          {!cams.length ? <option value="">No cameras</option> : null}
          {cams.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "Camera"}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => activeId && setActiveId(String(activeId))} // re-trigger by setting same id
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-white/80 border border-white/10"
        >
          Refresh
        </button>
      </div>

      {/* Stream */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30">
        {loading ? (
          <div className="h-44 flex items-center justify-center text-xs text-white/50">Loading stream…</div>
        ) : stream ? (
          <StreamPlayer stream={stream} />
        ) : (
          <div className="h-44 flex items-center justify-center text-xs text-white/50 px-4 text-center">
            {err || "Select a camera to view stream."}
          </div>
        )}
      </div>
    </RemotePanel>
  );
}
