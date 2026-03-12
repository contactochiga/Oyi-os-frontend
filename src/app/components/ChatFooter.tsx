// src/app/components/ChatFooter.tsx
"use client";

import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "recording" | "processing";
type Intent = "default" | "light" | "ac" | "security" | "tv";

const BAR_COUNT = 64;
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
  onSend: (text?: string) => Promise<void> | void;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isSending, setIsSending] = useState(false);
  const [intent, setIntent] = useState<Intent>("default");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldSendVoiceRef = useRef(false);
  const finalTranscriptRef = useRef("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const barsRef = useRef<HTMLDivElement[]>([]);
  const smoothValues = useRef<number[]>(Array(BAR_COUNT).fill(0));

  const canSend = input.trim().length > 0 && !isSending && voiceState === "idle";
  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

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
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function startRecording() {
    if (!hasSpeechRecognition) return;
    setVoiceHint(null);
    vibrate(20);
    setIntent("default");
    setInput("");
    finalTranscriptRef.current = "";
    shouldSendVoiceRef.current = false;
    setVoiceState("recording");

    try {
      await startAudio();
    } catch {
      setVoiceState("idle");
      setVoiceHint("Microphone permission is required for voice command.");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      let interim = "";
      let finalText = "";

      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const part = String(e.results[i]?.[0]?.transcript || "").trim();
        if (!part) continue;
        if (e.results[i].isFinal) finalText += ` ${part}`;
        else interim += ` ${part}`;
      }

      const merged = (finalText || interim).trim();
      if (!merged) return;
      if (finalText.trim()) finalTranscriptRef.current = finalText.trim();
      setInput(merged);
      setIntent(inferIntent(merged));
    };

    recognition.onerror = () => {
      shouldSendVoiceRef.current = false;
      setVoiceState("idle");
      stopAudio();
      setVoiceHint("Could not start voice recognition on this device.");
    };

    recognition.onend = () => {
      stopAudio();
      setVoiceState("idle");

      if (!shouldSendVoiceRef.current) return;
      shouldSendVoiceRef.current = false;

      const text = finalTranscriptRef.current.trim() || input.trim();
      if (!text) {
        setVoiceHint("No speech detected. Try again.");
        return;
      }

      setInput(text);
      void handleSend(text);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {}
  }

  function stopRecording() {
    vibrate(40);
    setVoiceState("processing");
    shouldSendVoiceRef.current = true;

    try {
      recognitionRef.current?.stop();
    } catch {}
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    if (!overrideText && voiceState !== "idle") return;
    setIsSending(true);
    try {
      await onSend(text);
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
          onClick={() => {
            if (voiceState === "recording") stopRecording();
            else void startRecording();
          }}
          className={`
            relative z-[1]
            w-10 h-10 rounded-2xl flex items-center justify-center
            border transition active:scale-[0.99]
            ${!hasSpeechRecognition ? "opacity-45 cursor-not-allowed" : ""}
            ${
              voiceState === "recording"
                ? "bg-white text-black border-white/20 animate-pulse"
                : "bg-white/5 text-white border-white/10 hover:bg-white/10"
            }
          `}
          disabled={!hasSpeechRecognition}
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
          <div className="relative z-[1] flex-1 h-10">
            {/* bar bed (glass) */}
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-70" />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-white/55">
              Listening...
            </div>

            {/* bars */}
            <div className="relative h-10 flex items-end justify-end gap-[2px] px-3">
              {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    if (el) barsRef.current[i] = el;
                  }}
                  className="rounded-full transition-[height]"
                  style={{
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
                void handleSend();
              }
            }}
            placeholder="Ask Oyi…"
            className="relative z-[1] flex-1 bg-transparent outline-none px-2 text-[16px] leading-[20px] text-white/90 placeholder-white/35"
          />
        )}

        {/* send */}
        <button
          type="button"
          onClick={() => void handleSend()}
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
      {voiceHint ? (
        <div className="mt-2 text-[11px] text-amber-200/90 px-2">{voiceHint}</div>
      ) : null}
    </div>
  );
}
