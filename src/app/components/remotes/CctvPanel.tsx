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

type StreamInfo =
  | { type: "hls"; url: string }
  | { type: "webrtc"; url: string };

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

  // Load available cameras from your registry/devices list
  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const list = await deviceService.getDevices(estateId ?? undefined);
        const cameras = (list || []).filter((d: any) => {
          const c = (d.category || d.type || "").toLowerCase();
          return c.includes("camera") || c.includes("cctv") || c.includes("onvif");
        });
        setCams(cameras);
        if (!activeId && cameras?.[0]?.id) setActiveId(cameras[0].id);
      } catch (e: any) {
        setErr(e?.message || "Failed to load cameras");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  // Fetch stream info whenever active camera changes
  useEffect(() => {
    if (!activeId) return;

    (async () => {
      setLoading(true);
      setErr(null);
      setStream(null);

      try {
        const res = await API.get(`/devices/${encodeURIComponent(activeId)}/stream`);
        const data = res.data;

        // Expect: { type: "webrtc"|"hls", url: "..." }
        if (!data?.type || !data?.url) {
          throw new Error("Stream not available for this camera yet.");
        }

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

  const activeCam = cams.find((c) => c.id === activeId);

  return (
    <RemotePanel title="CCTV" lastUpdated={lastUpdated}>
      {/* CAMERA FEED */}
      <div className="mb-4 rounded-xl overflow-hidden border border-gray-800">
        {loading ? (
          <div className="h-40 bg-black flex items-center justify-center text-xs text-gray-400">
            Loading stream…
          </div>
        ) : stream ? (
          <StreamPlayer stream={stream} />
        ) : (
          <div className="h-40 bg-black flex items-center justify-center text-xs text-gray-400 px-3 text-center">
            {err || "No stream selected."}
          </div>
        )}
      </div>

      {/* CAMERA SELECTOR */}
      <div className="flex gap-2 overflow-x-auto">
        {cams.map((cam) => (
          <button
            key={cam.id}
            onClick={() => {
              setActiveId(cam.id);
              touch();
            }}
            className={`px-3 py-2 rounded-full text-xs whitespace-nowrap
              ${cam.id === activeId ? "bg-[#E11D2E] text-white" : "bg-gray-700 text-gray-300"}`}
          >
            {cam.name || "Camera"}
          </button>
        ))}

        {!cams.length && (
          <div className="text-xs text-gray-500">
            No cameras found in registry yet.
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="mt-3 text-[11px] text-gray-500">
        {activeCam ? (
          <>Active: <span className="text-gray-300">{activeCam.name || activeCam.id}</span></>
        ) : (
          <>Select a camera to load stream.</>
        )}
      </div>
    </RemotePanel>
  );
}
