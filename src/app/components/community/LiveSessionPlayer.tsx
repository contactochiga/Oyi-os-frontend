"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Mic, MicOff, RadioTower, Users, Video, VideoOff } from "lucide-react";
import { getSocket } from "@/services/socket";
import { communityService, type LiveRtcConfig } from "@/services/communityService";

type Props = {
  postId: string;
  userId: string | null;
  userName?: string | null;
  isLive: boolean;
  initialViewerCount?: number;
  hasGuest?: boolean;
};

type RemotePublisher = {
  socketId: string;
  role: "host" | "guest";
  stream: MediaStream | null;
};

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function LiveSessionPlayer({
  postId,
  userId,
  userName,
  isLive,
  initialViewerCount = 0,
  hasGuest = false,
}: Props) {
  const socket = useMemo(() => getSocket(), []);
  const rtcConfigRef = useRef<RTCConfiguration>(DEFAULT_RTC_CONFIG);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(initialViewerCount);
  const [error, setError] = useState<string | null>(null);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration>(DEFAULT_RTC_CONFIG);
  const [requestState, setRequestState] = useState<"idle" | "pending" | "approved" | "publishing">("idle");
  const [remotePublishers, setRemotePublishers] = useState<RemotePublisher[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [guestActive, setGuestActive] = useState(hasGuest);
  const localPreviewRef = useRef<HTMLVideoElement | null>(null);

  function cleanupRemotePeer(socketId: string) {
    const pc = pcsRef.current.get(socketId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      pcsRef.current.delete(socketId);
    }
    setRemotePublishers((prev) => prev.filter((publisher) => publisher.socketId !== socketId));
  }

  function cleanupAll() {
    pcsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    pcsRef.current.clear();
    setRemotePublishers([]);
  }

  function cleanupLocal() {
    try {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {}
    localStreamRef.current = null;
    if (localPreviewRef.current) localPreviewRef.current.srcObject = null;
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

  async function acquireGuestStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
    localStreamRef.current = stream;
    if (localPreviewRef.current) localPreviewRef.current.srcObject = stream;
    return stream;
  }

  async function createPublisherOffer(targetSocketId: string) {
    if (!localStreamRef.current || !socket) return;
    const existing = pcsRef.current.get(targetSocketId);
    if (existing) {
      try {
        existing.close();
      } catch {}
      pcsRef.current.delete(targetSocketId);
    }

    const pc = new RTCPeerConnection(rtcConfigRef.current);
    pcsRef.current.set(targetSocketId, pc);
    localStreamRef.current.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      } catch {}
    });
    pc.onicecandidate = (ice) => {
      if (!ice.candidate) return;
      socket.emit("community-live:signal", {
        postId,
        targetSocketId,
        kind: "candidate",
        role: "guest",
        payload: ice.candidate,
      });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("community-live:signal", {
      postId,
      targetSocketId,
      kind: "offer",
      role: "guest",
      payload: offer,
    });
  }

  useEffect(() => {
    setViewerCount(initialViewerCount);
  }, [initialViewerCount]);

  useEffect(() => {
    setGuestActive(hasGuest);
  }, [hasGuest]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  }, [cameraEnabled]);

  useEffect(() => {
    if (!socket || !joined) return;

    const ensureViewerPc = (sourceSocketId: string, role: "host" | "guest") => {
      let pc = pcsRef.current.get(sourceSocketId);
      if (!pc) {
        pc = new RTCPeerConnection(rtcConfigRef.current);
        pcsRef.current.set(sourceSocketId, pc);
        pc.ontrack = (trackEvent) => {
          const [stream] = trackEvent.streams;
          setRemotePublishers((prev) => {
            const next = prev.filter((publisher) => publisher.socketId !== sourceSocketId);
            next.push({ socketId: sourceSocketId, role, stream: stream || null });
            return next;
          });
        };
        pc.onicecandidate = (ice) => {
          if (!ice.candidate) return;
          socket.emit("community-live:signal", {
            postId,
            targetSocketId: sourceSocketId,
            kind: "candidate",
            role: requestState === "publishing" ? "guest" : "viewer",
            payload: ice.candidate,
          });
        };
      }
      return pc;
    };

    const onSignal = async (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      const kind = String(event?.kind || "");
      const sourceSocketId = String(event?.sourceSocketId || "");
      const role = String(event?.role || "host") === "guest" ? "guest" : "host";
      if (!sourceSocketId) return;

      if (kind === "offer" && event?.payload) {
        const pc = ensureViewerPc(sourceSocketId, role);
        await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("community-live:signal", {
          postId,
          targetSocketId: sourceSocketId,
          kind: "answer",
          role: requestState === "publishing" ? "guest" : "viewer",
          payload: answer,
        });
        setJoining(false);
      } else if (kind === "answer" && event?.payload) {
        const pc = pcsRef.current.get(sourceSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
        }
      } else if (kind === "candidate" && event?.payload) {
        const pc = pcsRef.current.get(sourceSocketId);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(event.payload));
          } catch {}
        }
      }
    };

    const onStats = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setViewerCount(Number(event?.live_session?.viewer_count || 0));
      setGuestActive(Boolean(event?.live_session?.has_guest));
    };

    const onEnded = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setError("Live session has ended.");
      setJoined(false);
      setJoining(false);
      setRequestState("idle");
      setGuestActive(false);
      cleanupAll();
      cleanupLocal();
    };

    const onViewerJoined = async (event: any) => {
      if (String(event?.postId || "") !== String(postId || "") || requestState !== "publishing") return;
      const viewerSocketId = String(event?.viewerSocketId || "");
      if (!viewerSocketId) return;
      await createPublisherOffer(viewerSocketId);
    };

    const onAudienceSync = async (event: any) => {
      if (String(event?.postId || "") !== String(postId || "") || requestState !== "publishing") return;
      const audienceSocketIds = Array.isArray(event?.audienceSocketIds) ? event.audienceSocketIds : [];
      for (const targetSocketId of audienceSocketIds) {
        if (String(targetSocketId || "")) {
          await createPublisherOffer(String(targetSocketId));
        }
      }
    };

    const onPublisherLeft = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      const publisherSocketId = String(event?.publisherSocketId || "");
      if (publisherSocketId) cleanupRemotePeer(publisherSocketId);
      setGuestActive(Boolean(event?.live_session?.has_guest));
    };

    const onGuestApproved = async (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setError(null);
      setRequestState("approved");
      try {
        await acquireGuestStream();
        setRequestState("publishing");
        socket.emit("community-live:guest:join", {
          postId,
          userId,
          userName,
        });
        const audienceSocketIds = Array.isArray(event?.audienceSocketIds) ? event.audienceSocketIds : [];
        for (const targetSocketId of audienceSocketIds) {
          if (String(targetSocketId || "")) {
            await createPublisherOffer(String(targetSocketId));
          }
        }
      } catch (e: any) {
        setRequestState("idle");
        setError(e?.message || "Could not start guest camera.");
      }
    };

    const onGuestRequested = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setError(null);
      setRequestState("pending");
    };

    const onGuestRejected = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setRequestState("idle");
      if (event?.reason) setError(String(event.reason));
    };

    const onGuestRemoved = (event: any) => {
      if (String(event?.postId || "") !== String(postId || "")) return;
      setRequestState("idle");
      cleanupLocal();
      if (event?.live_session) {
        setGuestActive(Boolean(event.live_session.has_guest));
      }
    };

    socket.on("community-live:signal", onSignal);
    socket.on("community-live:stats", onStats);
    socket.on("community-live:ended", onEnded);
    socket.on("community-live:viewer-joined", onViewerJoined);
    socket.on("community-live:audience-sync", onAudienceSync);
    socket.on("community-live:publisher-left", onPublisherLeft);
    socket.on("community-live:guest-approved", onGuestApproved);
    socket.on("community-live:guest-requested", onGuestRequested);
    socket.on("community-live:guest-rejected", onGuestRejected);
    socket.on("community-live:guest-removed", onGuestRemoved);

    return () => {
      socket.off("community-live:signal", onSignal);
      socket.off("community-live:stats", onStats);
      socket.off("community-live:ended", onEnded);
      socket.off("community-live:viewer-joined", onViewerJoined);
      socket.off("community-live:audience-sync", onAudienceSync);
      socket.off("community-live:publisher-left", onPublisherLeft);
      socket.off("community-live:guest-approved", onGuestApproved);
      socket.off("community-live:guest-requested", onGuestRequested);
      socket.off("community-live:guest-rejected", onGuestRejected);
      socket.off("community-live:guest-removed", onGuestRemoved);
    };
  }, [socket, joined, postId, rtcConfig, requestState, userId, userName]);

  useEffect(() => {
    return () => {
      if (socket && joined) {
        socket.emit("community-live:leave", { postId });
      }
      cleanupAll();
      cleanupLocal();
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
    socket.emit("community-live:viewer:join", { postId, userId, userName });
  }

  function requestToJoin() {
    if (!socket || requestState !== "idle") return;
    socket.emit("community-live:guest:request", {
      postId,
      userId,
      userName,
    });
    setRequestState("pending");
  }

  function leaveBox() {
    if (!socket) return;
    socket.emit("community-live:leave", { postId });
    setRequestState("idle");
    cleanupLocal();
  }

  const hostPublisher = remotePublishers.find((publisher) => publisher.role === "host");
  const guestPublisher = remotePublishers.find((publisher) => publisher.role === "guest");

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
          <div className="relative aspect-video w-full bg-black">
            {hostPublisher?.stream ? (
              <video
                autoPlay
                playsInline
                controls
                ref={(node) => {
                  if (node && hostPublisher.stream) node.srcObject = hostPublisher.stream;
                }}
                className="h-full w-full bg-black object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-white/60">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Connecting to host…
              </div>
            )}

            {guestPublisher?.stream ? (
              <div className="absolute bottom-3 right-3 h-28 w-20 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-xl">
                <video
                  autoPlay
                  playsInline
                  controls
                  ref={(node) => {
                    if (node && guestPublisher.stream) node.srcObject = guestPublisher.stream;
                  }}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>
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

      {joined ? (
        <div className="mt-3 space-y-3">
          {requestState === "publishing" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">You are in the box</div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <video ref={localPreviewRef} autoPlay muted playsInline className="aspect-video w-full object-cover -scale-x-100" />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMicEnabled((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
                  >
                    {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-300" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraEnabled((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
                  >
                    {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-300" />}
                  </button>
                  <button
                    type="button"
                    onClick={leaveBox}
                    className="rounded-xl border border-red-400/30 px-3 py-2 text-xs text-red-200"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={requestToJoin}
                disabled={requestState !== "idle" || guestActive}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
              >
                {requestState === "pending"
                  ? "Join request sent"
                  : guestActive
                  ? "Guest box occupied"
                  : "Request to join"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {error ? <div className="mt-3 text-xs text-red-300">{error}</div> : null}
    </div>
  );
}
