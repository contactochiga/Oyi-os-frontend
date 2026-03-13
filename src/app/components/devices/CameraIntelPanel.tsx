"use client";

import { useEffect, useState } from "react";
import StreamPlayer from "@/app/components/remotes/StreamPlayer";
import cameraService, { CameraEvent, CameraItem } from "@/services/cameraService";

type StreamInfo = { type: "hls"; url: string };

function confidenceLabel(v?: number | null) {
  if (typeof v !== "number") return "n/a";
  return `${Math.round(v * 100)}%`;
}

export default function CameraIntelPanel({ estateId }: { estateId?: string | null }) {
  const [cams, setCams] = useState<CameraItem[]>([]);
  const [activeCamId, setActiveCamId] = useState<string>("");
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rewind, setRewind] = useState<number>(0);

  async function loadCameras() {
    if (!estateId) return;
    const list = await cameraService.listByEstate(String(estateId));
    setCams(list);
    if (!activeCamId && list.length) setActiveCamId(String(list[0].id));
  }

  async function loadPlayback(cameraId: string, rewindSeconds: number) {
    if (!cameraId) return;
    setLoading(true);
    setErr(null);
    try {
      const s = await cameraService.getPlayback(cameraId, rewindSeconds);
      setStream(s);
    } catch (e: any) {
      setErr(e?.message || "Failed to load stream");
      setStream(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(cameraId: string) {
    if (!cameraId) return;
    setEventsLoading(true);
    try {
      const list = await cameraService.listEvents(cameraId, { limit: 20, sinceMinutes: 24 * 60 });
      setEvents(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load events");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => {
    loadCameras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  useEffect(() => {
    if (!activeCamId) return;
    loadPlayback(activeCamId, rewind);
    loadEvents(activeCamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCamId, rewind]);

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">CCTV Intelligence</div>
          <div className="text-xs text-white/45">Live stream, rewind, detections</div>
        </div>
        <button
          type="button"
          onClick={loadCameras}
          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          value={activeCamId}
          onChange={(e) => setActiveCamId(e.target.value)}
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
        >
          {!cams.length ? <option value="">No cameras linked</option> : null}
          {cams.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || `Camera ${String(c.id).slice(0, 6)}`}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          {[0, 60, 300, 900].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setRewind(sec)}
              className={`rounded-xl border px-2.5 py-2 text-xs transition ${
                rewind === sec
                  ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              }`}
            >
              {sec === 0 ? "Live" : `-${Math.floor(sec / 60)}m`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-xs text-white/50">Loading camera stream…</div>
        ) : stream ? (
          <StreamPlayer stream={stream} />
        ) : (
          <div className="h-48 flex items-center justify-center text-xs text-white/50">
            {err || "Select a camera to start stream"}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-xs text-white/50 mb-2">Detection Timeline (24h)</div>
        <div className="max-h-52 overflow-auto space-y-2 pr-1">
          {eventsLoading ? (
            <div className="text-xs text-white/45">Loading detections…</div>
          ) : events.length === 0 ? (
            <div className="text-xs text-white/45">No detections yet.</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white">{String(ev.event_type || "event").replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-white/45">{confidenceLabel(ev.confidence)}</div>
                </div>
                <div className="mt-1 text-[11px] text-white/60">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString() : "Unknown time"}
                </div>
                {ev.message ? <div className="mt-1 text-[11px] text-white/75">{ev.message}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

