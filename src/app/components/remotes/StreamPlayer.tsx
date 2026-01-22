"use client";

import { useEffect, useRef, useState } from "react";

type StreamInfo =
  | { type: "hls"; url: string }
  | { type: "webrtc"; url: string }; // WHEP endpoint recommended

export default function StreamPlayer({ stream }: { stream: StreamInfo | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);

    // cleanup previous WebRTC session
    const cleanup = () => {
      try {
        pcRef.current?.close();
      } catch {}
      pcRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    cleanup();

    if (!stream) return;

    if (stream.type === "hls") {
      // Simple browser playback. Works if URL is HLS and CORS is allowed.
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = stream.url;
      }
      return;
    }

    // WebRTC (expects WHEP endpoint)
    (async () => {
      try {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (ev) => {
          const [ms] = ev.streams;
          if (videoRef.current && ms) {
            videoRef.current.srcObject = ms;
          }
        };

        pc.addTransceiver("video", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // WHEP: POST offer SDP, get answer SDP
        const resp = await fetch(stream.url, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp || "",
        });

        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          throw new Error(`Stream server error (${resp.status}): ${t || "failed"}`);
        }

        const answerSdp = await resp.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (e: any) {
        setErr(e?.message || "Failed to start stream");
      }
    })();

    return () => cleanup();
  }, [stream?.type, stream?.url]);

  return (
    <div className="relative w-full">
      <video
        ref={videoRef}
        className="w-full h-40 bg-black"
        autoPlay
        playsInline
        muted
        controls
      />
      {err && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-red-200 bg-black/60 px-3 text-center">
          {err}
        </div>
      )}
    </div>
  );
}
