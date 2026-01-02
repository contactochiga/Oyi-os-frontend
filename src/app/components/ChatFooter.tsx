"use client";

import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "recording" | "processing";
type Intent = "default" | "light" | "ac" | "security" | "tv";

const BAR_COUNT = 32;
const SMOOTHING = 0.85;

const INTENT_COLORS: Record<Intent, string> = {
  default: "#E11D2E",
  light: "#E11D2E",
  ac: "#3B82F6",
  security: "#10B981",
  tv: "#8B5CF6",
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
  const barsRef = useRef<HTMLDivElement[]>([]);
  const smoothValues = useRef<number[]>(Array(BAR_COUNT).fill(0));

  const canSend =
    input.trim().length > 0 && !isSending && voiceState === "idle";

  /* -----------------------------
     HAPTIC FEEDBACK
  ------------------------------ */
  function vibrate(ms: number) {
    navigator.vibrate?.(ms);
  }

  /* -----------------------------
     LIVE INTENT INFERENCE
  ------------------------------ */
  function inferIntent(text: string): Intent {
    const t = text.toLowerCase();
    if (t.includes("light")) return "light";
    if (t.includes("ac") || t.includes("air")) return "ac";
    if (t.includes("door") || t.includes("lock") || t.includes("security"))
      return "security";
    if (t.includes("tv")) return "tv";
    return "default";
  }

  /* -----------------------------
     SPEECH RECOGNITION + WAKE WORD
  ------------------------------ */
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join("");

      // 🔑 Wake word
      if (
        voiceState === "idle" &&
        transcript.toLowerCase().includes("hey oyi")
      ) {
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
    recognition.start();
  }, [voiceState]);

  /* -----------------------------
     AUDIO VISUALIZER
  ------------------------------ */
  async function startAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
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

        const avg =
          slice.reduce((a, b) => a + Math.abs(b - 128), 0) / slice.length;

        const target = Math.min(36, avg * 1.5);
        smoothValues.current[i] =
          smoothValues.current[i] * SMOOTHING +
          target * (1 - SMOOTHING);

        const bar = barsRef.current[i];
        if (bar) bar.style.height = `${smoothValues.current[i]}px`;
      }

      requestAnimationFrame(loop);
    };

    loop();
  }

  /* -----------------------------
     CONTROLS
  ------------------------------ */
  function startRecording() {
    vibrate(20);
    setIntent("default");
    setInput("");
    setVoiceState("recording");
    recognitionRef.current?.start();
    startAudio();
  }

  function stopRecording() {
    vibrate(40);
    setVoiceState("processing");
    recognitionRef.current?.stop();
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
      <div className="relative flex items-center bg-gray-800 rounded-full px-3 py-2 gap-3">

        {/* MIC / STOP */}
        <button
          onClick={
            voiceState === "recording" ? stopRecording : startRecording
          }
          className={`w-10 h-10 rounded-full flex items-center justify-center
            ${voiceState === "recording" ? "bg-red-600" : "bg-gray-700"}
          `}
        >
          {voiceState === "recording" ? (
            <FaStop className="text-white text-[14px]" />
          ) : (
            <FaMicrophone className="text-white text-[14px]" />
          )}
        </button>

        {/* INPUT / VISUALIZER */}
        {voiceState === "recording" ? (
          <div className="flex-1 flex items-end gap-[2px] h-9">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  if (el) barsRef.current[i] = el;
                }}
                className="flex-1 rounded-full transition-[height]"
                style={{
                  height: 6,
                  backgroundColor: INTENT_COLORS[intent],
                }}
              />
            ))}
          </div>
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Oyi…"
            className="flex-1 bg-transparent outline-none px-2 text-sm text-white placeholder-gray-400"
          />
        )}

        {/* SEND */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`w-10 h-10 rounded-full flex items-center justify-center
            ${canSend ? "bg-[#E11D2E]" : "bg-gray-700 opacity-50"}
          `}
        >
          <FaPaperPlane className="text-white text-[13px]" />
        </button>
      </div>
    </div>
  );
}
