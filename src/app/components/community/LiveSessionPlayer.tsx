"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, RadioTower, Users } from "lucide-react";
import { getSocket } from "@/services/socket";
import { communityService, type LiveRtcConfig } from "@/services/communityService";

type Props = {
  postId: string;
  userId: string | null;
  isLive: boolean;
  initialViewerCount?: number;
};

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function LiveSessionPlayer({
  postId,
  userId,
  isLive,
  initialViewerCount = 0,
}: Props) {
  const socket = useMemo(() => getSocket(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const currentHostSocketRef = useRef<string | null>(null);
  const rtcConfigRef = useRef<RTCConfiguration>(DEFAULT_RTC_CONFIG);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(initialViewerCount);
  const [error, setError] = useState<string | null>(null);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration>(DEFAULT_RTC_CONFIG);

  function cleanup() {
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    currentHostSocketRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function applyRtcConfig(input?: LiveRtcConfig | null) {
    const next = {
      iceServers:
        Array.isArray(input?.iceServers) && input.iceServers.length
          ? input.iceServers
          : DEFAULT_RTC_CONFIG.iceServers,
      iceTransportPolicy: input?.iceTransportPolicy === "relay" ? "relay" : "all",
    };
    rtcConfigRef.current = next;
    setRtcConfig(next);
  }

  useEffect(() => {
    setViewerCount(initialViewerCount);
  }, [initialViewerCount]);

  useEffect(() => {
    if (!socket || !joined) return;

    const onSignal = async (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      const kind = String(event?.kind || "");
      const sourceSocketId = String(event?.sourceSocketId || "");
      if (!sourceSocketId) return;

      if (!pcRef.current) {
        const pc = new RTCPeerConnection(rtcConfigRef.current);
        currentHostSocketRef.current = sourceSocketId;
        pcRef.current = pc;
        pc.ontrack = (trackEvent) => {
          const [stream] = trackEvent.streams;
          if (videoRef.current && stream) videoRef.current.srcObject = stream;
        };
        pc.onicecandidate = (ice) => {
          if (!ice.candidate || !currentHostSocketRef.current) return;
          socket.emit("community-live:signal", {
            postId,
            targetSocketId: currentHostSocketRef.current,
            kind: "candidate",
            payload: ice.candidate,
          });
        };
      }

      const pc = pcRef.current;
      if (!pc) return;

      if (kind === "offer" && event?.payload) {
        currentHostSocketRef.current = sourceSocketId;
        await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("community-live:signal", {
          postId,
          targetSocketId: sourceSocketId,
          kind: "answer",
          payload: answer,
        });
        setJoining(false);
      } else if (kind === "candidate" && event?.payload) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(event.payload));
        } catch {}
      }
    };

    const onStats = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setViewerCount(Number(event?.live_session?.viewer_count || 0));
    };

    const onEnded = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setError("Live session has ended.");
      setJoined(false);
      setJoining(false);
      cleanup();
    };

    socket.on("community-live:signal", onSignal);
    socket.on("community-live:stats", onStats);
    socket.on("community-live:ended", onEnded);

    return () => {
      socket.off("community-live:signal", onSignal);
      socket.off("community-live:stats", onStats);
      socket.off("community-live:ended", onEnded);
    };
  }, [socket, joined, postId, rtcConfig]);

  useEffect(() => {
    return () => {
      if (socket && joined) {
        socket.emit("community-live:leave", { postId });
      }
      cleanup();
    };
  }, [socket, joined, postId]);

  async function join() {
    if (!socket) {
      setError("Realtime connection is unavailable.");
      return;
    }
    setError(null);
    setJoining(true);
    setJoined(true);
    const config: any = await communityService.getLiveRtcConfig();
    if (!config?.error) {
      applyRtcConfig(config?.rtc_config || null);
    }
    socket.emit("community-live:viewer:join", { postId, userId });
  }

  if (!isLive) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
        Live session ended.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-black/25 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm text-red-100">
          <RadioTower className="h-4 w-4 text-red-300" />
          Live now
        </div>
        <div className="inline-flex items-center gap-1 text-xs text-white/60">
          <Users className="h-3.5 w-3.5" />
          {viewerCount}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        {joined ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls
            className="aspect-video w-full bg-black object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => void join()}
            disabled={joining}
            className="flex aspect-video w-full items-center justify-center gap-2 bg-black/60 text-white disabled:opacity-50"
          >
            {joining ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
            {joining ? "Joining live..." : "Watch live"}
          </button>
        )}
      </div>

      {error ? <div className="mt-3 text-xs text-red-300">{error}</div> : null}
    </div>
  );
}
