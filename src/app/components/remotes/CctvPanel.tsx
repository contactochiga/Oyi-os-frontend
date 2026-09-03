"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import StreamPlayer from "./StreamPlayer";
import useActiveContext from "@/hooks/useActiveContext";
import cameraService from "@/services/cameraService";
import { useRouter } from "next/navigation";

type CameraDevice = {
  id: string;
  name?: string;
  category?: string;
  type?: string;
};

export default function CctvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const router = useRouter();
  const activeContext = useActiveContext();
  const homeId = useMemo(() => activeContext.home_id || null, [activeContext.home_id]);

  const [cams, setCams] = useState<CameraDevice[]>([]);
  const [activeId, setActiveId] = useState<string | null>(deviceId ?? null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const list = homeId ? await cameraService.listByHome(homeId) : [];

        const normalized = (list || []).map((d: any) => ({
          id: String(d.id),
          name: d.name || "Camera",
          category: d.scope || "camera",
          type: d.streamStatus || "hls",
        }));

        setCams(normalized);
        if (!activeId && normalized?.[0]?.id) setActiveId(normalized[0].id);
      } catch (e: any) {
        setErr(e?.message || "Failed to load cameras");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  return (
    <RemotePanel title="CCTV" lastUpdated={lastUpdated}>
      {/* Top controls */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <select
          value={activeId ?? ""}
          onChange={(e) => { setActiveId(e.target.value || null); onInteraction?.(); }}
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
          onClick={() => activeId && setRefreshKey((value) => value + 1)}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-white/80 border border-white/10"
        >
          Refresh
        </button>
      </div>

      {/* Stream */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30">
        {activeId ? (
          <StreamPlayer key={`${activeId}:${refreshKey}`} cameraId={activeId} />
        ) : (
          <div className="h-44 flex items-center justify-center text-xs text-white/50 px-4 text-center">
            {err || "Select a camera to view stream."}
          </div>
        )}
      </div>
      <button type="button" onClick={() => router.push(activeId ? `/cameras?cameraId=${encodeURIComponent(activeId)}` : "/cameras")} className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]">
        Open Cameras
      </button>
    </RemotePanel>
  );
}
