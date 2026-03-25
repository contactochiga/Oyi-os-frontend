"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, LoaderCircle, Mic, MicOff, RadioTower, RefreshCcw, Square, Users } from "lucide-react";
import { getSocket } from "@/services/socket";
import { communityService, type CommunityPost, type LiveRtcConfig } from "@/services/communityService";

type Props = {
  open: boolean;
  estateId: string | null;
  draft: string;
  onClose: () => void;
  onStarted: (post: CommunityPost) => void;
  onStopped?: (post: CommunityPost | null) => void;
};

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type GuestRequest = {
  socketId: string;
  userId?: string;
  userName?: string;
};

export default function LiveBroadcastComposer({
  open,
  estateId,
  draft,
  onClose,
  onStarted,
  onStopped,
}: Props) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const guestPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const activePostIdRef = useRef<string | null>(null);
  const rtcConfigRef = useRef<RTCConfiguration>(DEFAULT_RTC_CONFIG);
  const [status, setStatus] = useState<"idle" | "preparing" | "starting" | "live" | "stopping">("idle");
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration>(DEFAULT_RTC_CONFIG);
  const [pendingRequests, setPendingRequests] = useState<GuestRequest[]>([]);
  const [guestDisplayName, setGuestDisplayName] = useState<string | null>(null);
  const [guestConnected, setGuestConnected] = useState(false);
  const [hostNotice, setHostNotice] = useState<string | null>(null);

  const socket = useMemo(() => getSocket(), []);

  function cleanupPeers() {
    peersRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peersRef.current.clear();
  }

  function cleanupStream() {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {}
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  }

  function clearGuestPreview() {
    if (guestPreviewRef.current) guestPreviewRef.current.srcObject = null;
    setGuestConnected(false);
  }

  function applyRtcConfig(input?: LiveRtcConfig | null) {
    const next = !input
      ? DEFAULT_RTC_CONFIG
      : {
      iceServers: Array.isArray(input.iceServers) && input.iceServers.length
        ? input.iceServers
        : DEFAULT_RTC_CONFIG.iceServers,
      iceTransportPolicy: input.iceTransportPolicy === "relay" ? "relay" : "all",
    };
    rtcConfigRef.current = next;
    setRtcConfig(next);
  }

  async function replaceVideoTrack(nextTrack: MediaStreamTrack) {
    const tasks: Array<Promise<void>> = [];
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((item) => item.track?.kind === "video");
      if (!sender) return;
      tasks.push(
        sender.replaceTrack(nextTrack).then(() => undefined).catch(() => undefined)
      );
    });
    await Promise.all(tasks);
  }

  async function acquireStream(nextFacingMode: "user" | "environment") {
    const media = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: nextFacingMode },
      audio: true,
    });
    media.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
    media.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
    return media;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        setStatus("preparing");
        const liveConfig: any = await communityService.getLiveRtcConfig();
        if (!cancelled && !liveConfig?.error) {
          applyRtcConfig(liveConfig?.rtc_config || null);
        }
        const media = await acquireStream(facingMode);
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = media;
        if (previewRef.current) {
          previewRef.current.srcObject = media;
        }
        setStatus("idle");
      } catch (e: any) {
        setError(e?.message || "Could not start camera preview");
        setStatus("idle");
      }
    })();

    return () => {
      cancelled = true;
      cleanupPeers();
      cleanupStream();
      clearGuestPreview();
      activePostIdRef.current = null;
      setViewerCount(0);
      setStatus("idle");
      setError(null);
    };
  }, [open]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  }, [cameraEnabled]);

  useEffect(() => {
    if (!socket) return;

    const onViewerJoined = async (event: any) => {
      const postId = String(event?.postId || "");
      const viewerSocketId = String(event?.viewerSocketId || "");
      if (!postId || !viewerSocketId || postId !== activePostIdRef.current || !streamRef.current) return;

      const pc = new RTCPeerConnection(rtcConfigRef.current);
      peersRef.current.set(viewerSocketId, pc);

      streamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, streamRef.current as MediaStream);
        } catch {}
      });

      pc.onicecandidate = (ice) => {
        if (!ice.candidate || !activePostIdRef.current) return;
        socket.emit("community-live:signal", {
          postId: activePostIdRef.current,
          targetSocketId: viewerSocketId,
          kind: "candidate",
          role: "host",
          payload: ice.candidate,
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("community-live:signal", {
        postId,
        targetSocketId: viewerSocketId,
        kind: "offer",
        role: "host",
        payload: offer,
      });

      setViewerCount(Number(event?.live_session?.viewer_count || 0));
      setGuestDisplayName(String(event?.live_session?.guest_display_name || "") || null);
    };

    const onSignal = async (event: any) => {
      const postId = String(event?.postId || "");
      const sourceSocketId = String(event?.sourceSocketId || "");
      const kind = String(event?.kind || "");
      if (!postId || postId !== activePostIdRef.current || !sourceSocketId) return;

      let pc = peersRef.current.get(sourceSocketId);
      if (kind === "offer" && event?.payload && event?.role === "guest") {
        if (pc) {
          try {
            pc.close();
          } catch {}
        }
        pc = new RTCPeerConnection(rtcConfigRef.current);
        peersRef.current.set(sourceSocketId, pc);
        pc.ontrack = (trackEvent) => {
          const [stream] = trackEvent.streams;
          if (guestPreviewRef.current && stream) {
            guestPreviewRef.current.srcObject = stream;
            setGuestConnected(true);
          }
        };
        pc.onicecandidate = (ice) => {
          if (!ice.candidate || !activePostIdRef.current) return;
          socket.emit("community-live:signal", {
            postId: activePostIdRef.current,
            targetSocketId: sourceSocketId,
            kind: "candidate",
            role: "host",
            payload: ice.candidate,
          });
        };
        await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("community-live:signal", {
          postId,
          targetSocketId: sourceSocketId,
          kind: "answer",
          role: "host",
          payload: answer,
        });
        return;
      }

      if (!pc) return;

      if (kind === "answer" && event?.payload) {
        await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
      } else if (kind === "candidate" && event?.payload) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(event.payload));
        } catch {}
      }
    };

    const onViewerLeft = (event: any) => {
      const viewerSocketId = String(event?.viewerSocketId || "");
      if (!viewerSocketId) return;
      const pc = peersRef.current.get(viewerSocketId);
      if (pc) {
        try {
          pc.close();
        } catch {}
        peersRef.current.delete(viewerSocketId);
      }
      setViewerCount(Number(event?.live_session?.viewer_count || 0));
      setGuestDisplayName(String(event?.live_session?.guest_display_name || "") || null);
    };

    const onGuestRequests = (event: any) => {
      if (String(event?.postId || "") !== String(activePostIdRef.current || "")) return;
      setPendingRequests(Array.isArray(event?.requests) ? event.requests : []);
      setGuestDisplayName(String(event?.live_session?.guest_display_name || "") || null);
      const requestCount = Array.isArray(event?.requests) ? event.requests.length : 0;
      setHostNotice(requestCount ? `${requestCount} guest request${requestCount > 1 ? "s" : ""} waiting` : null);
    };

    const onGuestActive = (event: any) => {
      if (String(event?.postId || "") !== String(activePostIdRef.current || "")) return;
      setGuestDisplayName(String(event?.live_session?.guest_display_name || "") || "Guest");
      setHostNotice(null);
    };

    const onPublisherLeft = (event: any) => {
      if (String(event?.postId || "") !== String(activePostIdRef.current || "")) return;
      if (String(event?.role || "") === "guest") {
        clearGuestPreview();
        setGuestDisplayName(String(event?.live_session?.guest_display_name || "") || null);
      }
    };

    const onGuestRequestForHost = (event: any) => {
      if (String(event?.postId || "") !== String(activePostIdRef.current || "")) return;
      const requests = Array.isArray(event?.requests) ? event.requests : [];
      setPendingRequests(requests);
      setHostNotice(requests.length ? `${requests[0]?.userName || "Resident"} wants to join` : "New guest request");
    };

    socket.on("community-live:viewer-joined", onViewerJoined);
    socket.on("community-live:signal", onSignal);
    socket.on("community-live:viewer-left", onViewerLeft);
    socket.on("community-live:guest-requests", onGuestRequests);
    socket.on("community-live:guest-active", onGuestActive);
    socket.on("community-live:publisher-left", onPublisherLeft);
    socket.on("community-live:guest-requested-for-host", onGuestRequestForHost);
    socket.on("community-live:stats", (event: any) => {
      const postId = String(event?.postId || "");
      if (postId && postId === activePostIdRef.current) {
        setViewerCount(Number(event?.live_session?.viewer_count || 0));
        setGuestDisplayName(String(event?.live_session?.guest_display_name || "") || null);
      }
    });

    return () => {
      socket.off("community-live:viewer-joined", onViewerJoined);
      socket.off("community-live:signal", onSignal);
      socket.off("community-live:viewer-left", onViewerLeft);
      socket.off("community-live:guest-requests", onGuestRequests);
      socket.off("community-live:guest-active", onGuestActive);
      socket.off("community-live:publisher-left", onPublisherLeft);
      socket.off("community-live:guest-requested-for-host", onGuestRequestForHost);
      socket.off("community-live:stats");
    };
  }, [socket, rtcConfig]);

  async function start() {
    if (!estateId) {
      setError("No estate linked.");
      return;
    }
    if (!streamRef.current) {
      setError("Camera preview is not ready.");
      return;
    }

    setError(null);
    setStatus("starting");
    const res: any = await communityService.startLiveSession({
      title: draft?.trim() ? `${draft.trim().slice(0, 64)}` : "Live now",
      content: draft?.trim() || "",
      estateId,
    });

    if (res?.error || !res?.id) {
      setStatus("idle");
      setError(String(res?.error || "Failed to start live"));
      return;
    }

    applyRtcConfig((res as any)?.rtc_config || null);

    activePostIdRef.current = String(res.id);
    socket?.emit("community-live:host:join", { postId: String(res.id) });
    setStatus("live");
    setViewerCount(0);
    setPendingRequests([]);
    setGuestDisplayName(null);
    setHostNotice(null);
    onStarted(res as CommunityPost);
  }

  async function stop() {
    if (!activePostIdRef.current) {
      onClose();
      return;
    }
    setStatus("stopping");
    const res: any = await communityService.stopLiveSession(activePostIdRef.current);
    socket?.emit("community-live:host:stop", { postId: activePostIdRef.current });
    socket?.emit("community-live:leave", { postId: activePostIdRef.current });
    cleanupPeers();
    clearGuestPreview();
    activePostIdRef.current = null;
    setViewerCount(0);
    setPendingRequests([]);
    setGuestDisplayName(null);
    setHostNotice(null);
    setStatus("idle");
    onStopped?.(res?.error ? null : (res as CommunityPost));
    onClose();
  }

  function approveGuest(viewerSocketId: string) {
    if (!activePostIdRef.current || !socket) return;
    socket.emit("community-live:guest:approve", {
      postId: activePostIdRef.current,
      viewerSocketId,
    });
  }

  function rejectGuest(viewerSocketId: string) {
    if (!activePostIdRef.current || !socket) return;
    socket.emit("community-live:guest:reject", {
      postId: activePostIdRef.current,
      viewerSocketId,
    });
  }

  function removeGuest() {
    if (!activePostIdRef.current || !socket) return;
    socket.emit("community-live:guest:remove", {
      postId: activePostIdRef.current,
    });
  }

  async function flipCamera() {
    if (status === "starting" || status === "stopping") return;
    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    setError(null);
    try {
      const nextStream = await acquireStream(nextFacingMode);
      const nextVideoTrack = nextStream.getVideoTracks()[0];
      if (!nextVideoTrack) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error("No video track available.");
      }

      if (status === "live") {
        await replaceVideoTrack(nextVideoTrack);
      }

      cleanupStream();
      streamRef.current = nextStream;
      if (previewRef.current) {
        previewRef.current.srcObject = nextStream;
      }
      setFacingMode(nextFacingMode);
    } catch (e: any) {
      setError(e?.message || "Could not switch camera.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md px-4 py-8">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[rgba(9,14,26,0.96)] p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Go live</div>
            <div className="text-xs text-white/45">Camera preview and estate broadcast</div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (status === "live" || status === "stopping") return;
              onClose();
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70"
          >
            Close
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="relative">
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              className={`aspect-[3/4] w-full bg-black object-cover ${
                facingMode === "user" ? "-scale-x-100" : ""
              }`}
            />
            {guestDisplayName ? (
              <div className="absolute bottom-3 right-3 h-32 w-24 overflow-hidden rounded-2xl border border-white/20 bg-black/80 shadow-xl">
                {guestConnected ? (
                  <video ref={guestPreviewRef} autoPlay playsInline className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] text-white/75">
                    {guestDisplayName} joining…
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void flipCamera()}
            disabled={status === "preparing" || status === "starting" || status === "stopping"}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Flip
          </button>
          <button
            type="button"
            onClick={() => setMicEnabled((prev) => !prev)}
            disabled={status === "preparing" || status === "starting" || status === "stopping"}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 disabled:opacity-50"
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-300" />}
            {micEnabled ? "Mic on" : "Mic off"}
          </button>
          <button
            type="button"
            onClick={() => setCameraEnabled((prev) => !prev)}
            disabled={status === "preparing" || status === "starting" || status === "stopping"}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 disabled:opacity-50"
          >
            {cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4 text-red-300" />}
            {cameraEnabled ? "Camera on" : "Camera off"}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <RadioTower className={`h-4 w-4 ${status === "live" ? "text-red-300" : "text-white/60"}`} />
            <span>{status === "live" ? "Live now" : status === "starting" ? "Starting live..." : status === "preparing" ? "Preparing camera..." : "Ready to go live"}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Users className="h-3.5 w-3.5" />
            {viewerCount}
          </div>
        </div>

        {status === "live" ? (
          <div className="mt-3 space-y-2">
            {hostNotice ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {hostNotice}
              </div>
            ) : null}
            {guestDisplayName ? (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="text-white/85">Guest in box: {guestDisplayName}</span>
                <button
                  type="button"
                  onClick={removeGuest}
                  className="rounded-xl border border-red-400/30 px-3 py-1.5 text-xs text-red-200"
                >
                  Remove guest
                </button>
              </div>
            ) : null}
            {pendingRequests.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                  Guest requests
                </div>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.socketId} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                      <div className="text-sm text-white/85">{request.userName || "Resident"}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => rejectGuest(request.socketId)}
                          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/65"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => approveGuest(request.socketId)}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-black"
                        >
                          Bring in
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}

        <div className="mt-4 flex gap-3">
          {status === "live" ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white"
            >
              <Square className="h-4 w-4" />
              Stop live
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={status === "preparing" || status === "starting"}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50"
            >
              {status === "preparing" || status === "starting" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Start live
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
