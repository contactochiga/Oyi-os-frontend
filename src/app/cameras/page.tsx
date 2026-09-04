"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, ChevronRight, Image as ImageIcon, RefreshCw } from "lucide-react";
import ConsumerShell from "@/app/components/ConsumerShell";
import CameraLivePlayer from "@/app/components/cameras/CameraLivePlayer";
import useActiveContext from "@/hooks/useActiveContext";
import cameraService, { type CameraEvent, type CameraItem } from "@/services/cameraService";
import type { CameraDetection, CameraMediaReference } from "@/lib/oyi-camera-core/core";

type Activity = { id: string; label: string; at: string };
const health = (camera: CameraItem) => ({ online: ["Online", "Offline", "Stream unavailable", "Unknown"][(["online", "offline", "degraded", "unknown"] as const).indexOf(camera.runtimeState)] || "Unknown", tone: camera.runtimeState });
const friendlyError = (value: unknown) => {
  const text = String((value as Error)?.message || "").toLowerCase();
  if (text.includes("permission") || text.includes("forbidden") || text.includes("authoriz")) return "You do not have permission to view cameras for this home.";
  return "Cameras are unavailable right now. Please try again.";
};
const eventLabel = (event: CameraEvent | CameraDetection) => String(event.type || "Camera activity").replace(/[_-]/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
const activityTime = (item: CameraEvent | CameraDetection) => ("sourceTimestamp" in item ? item.sourceTimestamp : null) || ("observedAt" in item ? item.observedAt : null) || item.createdAt || new Date(0).toISOString();

export default function CamerasPage() {
  return <Suspense fallback={<ConsumerShell title="Cameras" hideStrip wide backHref="/security"><div className="py-10 text-sm text-white/55">Loading cameras…</div></ConsumerShell>}><CamerasContent /></Suspense>;
}

function CamerasContent() {
  const active = useActiveContext();
  const search = useSearchParams();
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [media, setMedia] = useState<CameraMediaReference[]>([]);

  const load = useCallback(async () => {
    if (!active.ready || !active.home_id) { setCameras([]); setSelectedId(null); setLoading(active.loading || active.switching); return; }
    setLoading(true); setError(null);
    try {
      const rows = await cameraService.listByHome(active.home_id);
      setCameras(rows);
      const requested = search.get("cameraId");
      setSelectedId((current) => rows.some((camera) => camera.id === requested) ? requested : rows.some((camera) => camera.id === current) ? current : rows[0]?.id || null);
    } catch (cause) { setCameras([]); setSelectedId(null); setError(friendlyError(cause)); }
    finally { setLoading(false); }
  }, [active.home_id, active.loading, active.ready, active.switching, search]);
  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => cameras.find((camera) => camera.id === selectedId) || null, [cameras, selectedId]);
  const selectedCameraId = selected?.id || null;
  useEffect(() => {
    if (!selectedCameraId) { setActivity([]); setMedia([]); return; }
    let cancelled = false;
    void Promise.all([cameraService.listEvents(selectedCameraId, { limit: 8 }), cameraService.listDetections(selectedCameraId, 8), cameraService.listMedia(selectedCameraId, 6)]).then(([events, detections, items]) => {
      if (cancelled) return;
      const combined = [...events, ...detections].map((item) => ({ id: `${"id" in item ? item.id : "detection"}-${activityTime(item)}`, label: eventLabel(item), at: activityTime(item) })).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8);
      setActivity(combined); setMedia(items);
    });
    return () => { cancelled = true; };
  }, [selectedCameraId]);

  async function openMedia(item: CameraMediaReference) {
    try { const access = item.accessUrl ? item : await cameraService.getMediaAccess(item.id); if (access.accessUrl) window.open(access.accessUrl, "_blank", "noopener,noreferrer"); } catch { /* access remains intentionally silent and resident-safe */ }
  }

  return <ConsumerShell title="Cameras" hideStrip wide backHref="/security">
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <p className="text-sm text-white/55">{loading ? "Loading cameras…" : `${cameras.length} authorized ${cameras.length === 1 ? "camera" : "cameras"}`}</p>
        <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/8" aria-label="Refresh cameras"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
      </div>
      {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-3 text-sm text-rose-50" role="alert">{error}</div> : null}
      {!loading && !error && cameras.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center"><Camera className="mx-auto h-6 w-6 text-white/45" /><h2 className="mt-3 text-base font-medium">No cameras are available for this home.</h2><p className="mt-1 text-sm text-white/50">When a camera is authorised for this home, it will appear here.</p></div> : null}
      {cameras.length ? <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Camera selector">
          {cameras.map((camera) => { const state = health(camera); const current = camera.id === selected?.id; return <button key={camera.id} onClick={() => setSelectedId(camera.id)} aria-pressed={current} className={`min-w-[185px] rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-300/80 lg:block lg:w-full ${current ? "border-sky-300/35 bg-sky-300/10" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.06]"}`}><span className="block truncate text-sm font-medium text-white">{camera.name}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs text-white/48"><span className="truncate">{camera.location || "Home camera"}</span><span className="shrink-0">{state.online}</span></span></button>; })}
        </aside>
        {selected ? <section className="min-w-0">
          <div className="mb-2 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">{selected.name}</h2><p className="mt-0.5 text-sm text-white/52">{selected.location || "Home camera"}</p></div><span className="rounded-full border border-white/12 px-2 py-1 text-xs text-white/72">{health(selected).online}</span></div>
          <CameraLivePlayer cameraId={selected.id} name={selected.name} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section><h3 className="text-sm font-medium text-white">Recent activity</h3>{activity.length ? <ul className="mt-2 divide-y divide-white/8 rounded-lg border border-white/10"><>{activity.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"><span className="min-w-0 truncate">{item.label}</span><time className="shrink-0 text-xs text-white/45" dateTime={item.at}>{new Date(item.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></li>)}</></ul> : <p className="mt-2 text-sm text-white/45">No recent resident-visible activity.</p>}</section>
            <section><h3 className="text-sm font-medium text-white">Recent media</h3>{media.length ? <div className="mt-2 space-y-1">{media.map((item) => <button key={item.id} onClick={() => void openMedia(item)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/[0.06]"><span className="flex min-w-0 items-center gap-2"><ImageIcon className="h-4 w-4 shrink-0 text-white/55" /><span className="truncate">{item.kind}</span></span><ChevronRight className="h-4 w-4 text-white/45" /></button>)}</div> : <p className="mt-2 text-sm text-white/45">No authorised media is available.</p>}</section>
          </div>
        </section> : null}
      </div> : null}
    </div>
  </ConsumerShell>;
}
