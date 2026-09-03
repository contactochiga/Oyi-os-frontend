"use client";

import { useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useCameraPlayback } from "@/lib/oyi-camera-core/useCameraPlayback";
import cameraService from "@/services/cameraService";

function messageFor(status: string, error: string | null) {
  if (status === "unavailable") return "Live view is unavailable right now.";
  if (error?.toLowerCase().includes("permission") || error?.toLowerCase().includes("authoriz")) return "You do not have permission to view this camera.";
  if (error) return "Camera unavailable right now.";
  return status === "refreshing" ? "Refreshing live view…" : "Connecting to live view…";
}

export default function CameraLivePlayer({ cameraId, name }: { cameraId: string; name: string }) {
  const createSession = useCallback((id: string) => cameraService.getPlayback(id), []);
  const { videoRef, status, error, refresh } = useCameraPlayback({ cameraId, enabled: Boolean(cameraId), createSession });
  const unavailable = status !== "ready";

  return <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
    <video ref={videoRef} className="h-full w-full bg-black object-contain" aria-label={`${name} live view`} autoPlay playsInline muted controls />
    {unavailable ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-5 text-center" role="status" aria-live="polite">
      <AlertCircle className="h-5 w-5 text-white/70" aria-hidden="true" />
      <p className="text-sm text-white/85">{messageFor(status, error)}</p>
      {(error || status === "unavailable") ? <button onClick={() => void refresh()} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" />Try again</button> : null}
    </div> : null}
  </div>;
}
