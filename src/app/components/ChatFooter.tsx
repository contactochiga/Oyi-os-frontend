// src/app/components/ChatFooter.tsx
"use client";

import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "recording" | "processing";
type Intent = "default" | "light" | "ac" | "security" | "tv";

const BAR_COUNT = 32;
const SMOOTHING = 0.85;

const INTENT_COLORS: Record<Intent, string> = {
  default: "#FFFFFF",
  light: "#FFFFFF",
  ac: "#60A5FA",
  security: "#34D399",
  tv: "#A78BFA",
};

export default function ChatFooter({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (s: string) => void;
  onSend: () => Promise<void> | void;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isSending, setIsSending] = useState(false);
  const [intent, setIntent] = useState<Intent>("default");

  const recognitionRef = useRef<any>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const barsRef = useRef<HTMLDivElement[]>([]);
  const smoothValues = useRef<number[]>(Array(BAR_COUNT).fill(0));

  const canSend = input.trim().length > 0 && !isSending && voiceState === "idle";

  function vibrate(ms: number) {
    navigator.vibrate?.(ms);
  }

  function inferIntent(text: string): Intent {
    const t = text.toLowerCase();
    if (t.includes("light")) return "light";
    if (t.includes("ac") || t.includes("air")) return "ac";
    if (t.includes("door") || t.includes("lock") || t.includes("security"))
      return "security";
    if (t.includes("tv")) return "tv";
    return "default";
  }

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join("");

      if (voiceState === "idle" && transcript.toLowerCase().includes("hey oyi")) {
        vibrate(30);
        startRecording();
        return;
      }

      if (voiceState === "recording") {
        setInput(transcript);
        setIntent(inferIntent(transcript));
      }
    };

    recognition.onend = () => {
      if (voiceState === "recording") stopRecording();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {}

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  async function startAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    animate();
  }

  function stopAudio() {
    try {
      audioCtxRef.current?.close();
    } catch {}

    audioCtxRef.current = null;
    analyserRef.current = null;

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  }

  function animate() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.fftSize);

    const loop = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);

      for (let i = 0; i < BAR_COUNT; i++) {
        const slice = data.slice(
          (i * data.length) / BAR_COUNT,
          ((i + 1) * data.length) / BAR_COUNT
        );

        const avg = slice.reduce((a, b) => a + Math.abs(b - 128), 0) / slice.length;
        const target = Math.min(34, avg * 1.5);

        smoothValues.current[i] =
          smoothValues.current[i] * SMOOTHING + target * (1 - SMOOTHING);

        const bar = barsRef.current[i];
        if (bar) bar.style.height = `${smoothValues.current[i]}px`;
      }

      requestAnimationFrame(loop);
    };

    loop();
  }

  function startRecording() {
    vibrate(20);
    setIntent("default");
    setInput("");
    setVoiceState("recording");

    try {
      recognitionRef.current?.start();
    } catch {}

    startAudio().catch(() => {});
  }

  function stopRecording() {
    vibrate(40);
    setVoiceState("processing");

    try {
      recognitionRef.current?.stop();
    } catch {}

    stopAudio();
    setVoiceState("idle");
  }

  async function handleSend() {
    if (!canSend) return;
    setIsSending(true);
    try {
      await onSend();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div
        className="
          relative flex items-center gap-3
          rounded-3xl px-3 py-2
          border border-white/10 bg-white/5
          backdrop-blur-xl
          overflow-hidden
        "
      >
        {/* glass sheen */}
        <div
          className="
            pointer-events-none absolute inset-0
            bg-gradient-to-b from-white/10 via-white/5 to-transparent
          "
        />
        {/* subtle inner highlight */}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/5 rounded-3xl" />

        {/* mic */}
        <button
          type="button"
          onClick={voiceState === "recording" ? stopRecording : startRecording}
          className={`
            relative z-[1]
            w-10 h-10 rounded-2xl flex items-center justify-center
            border transition active:scale-[0.99]
            ${
              voiceState === "recording"
                ? "bg-white text-black border-white/20"
                : "bg-white/5 text-white border-white/10 hover:bg-white/10"
            }
          `}
          aria-label={voiceState === "recording" ? "Stop recording" : "Start recording"}
        >
          {voiceState === "recording" ? (
            <FaStop className="text-[14px]" />
          ) : (
            <FaMicrophone className="text-[14px]" />
          )}
        </button>

        {/* middle */}
        {voiceState === "recording" ? (
          <div className="relative z-[1] flex-1 h-9">
            {/* bar bed (glass) */}
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-70" />

            {/* bars */}
            <div className="relative h-9 flex items-end gap-[3px] px-3">
              {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    if (el) barsRef.current[i] = el;
                  }}
                  className="rounded-full transition-[height]"
                  style={{
                    // ✅ thinner bars, same rhythm
                    width: 2,
                    height: 6,
                    backgroundColor: INTENT_COLORS[intent],
                    opacity: intent === "default" ? 0.55 : 0.85,
                    boxShadow: "0 0 10px rgba(255,255,255,0.10)",
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <input
            value={input}
            onChange={(e) => {
              const v = e.target.value;
              setInput(v);
              setIntent(inferIntent(v));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Oyi…"
            className="relative z-[1] flex-1 bg-transparent outline-none px-2 text-[16px] leading-[20px] text-white/90 placeholder-white/35"
          />
        )}

        {/* send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`
            relative z-[1]
            w-10 h-10 rounded-2xl flex items-center justify-center
            border transition active:scale-[0.99]
            ${
              canSend
                ? "bg-white text-black border-white/20"
                : "bg-white/5 text-white/40 border-white/10 opacity-60"
            }
          `}
          aria-label="Send"
        >
          <FaPaperPlane className="text-[13px]" />
        </button>
      </div>
    </div>
  );
}
