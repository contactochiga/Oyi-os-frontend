"use client";

import { useCallback } from "react";
import { useCameraPlayback } from "@/lib/oyi-camera-core/useCameraPlayback";
import cameraService from "@/services/cameraService";

export default function StreamPlayer({ cameraId, rewindSeconds = 0 }: { cameraId: string | null; rewindSeconds?: number }) {
  const createSession = useCallback(
    (id: string, options?: { rewindSeconds?: number }) => cameraService.getPlayback(id, options?.rewindSeconds),
    []
  );
  const { videoRef, status, error } = useCameraPlayback({ cameraId, rewindSeconds, enabled: Boolean(cameraId), createSession });

  return (
    <div className="relative w-full">
      <video ref={videoRef} className="w-full h-40 bg-black" autoPlay playsInline muted controls />
      {status !== "ready" && !error ? <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50 bg-black/40">{status === "refreshing" ? "Refreshing stream…" : "Loading stream…"}</div> : null}
      {error ? <div className="absolute inset-0 flex items-center justify-center text-xs text-red-200 bg-black/60 px-3 text-center">{error}</div> : null}
    </div>
  );
}
