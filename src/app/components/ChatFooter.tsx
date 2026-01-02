"use client";

import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "recording" | "processing";

const BAR_COUNT = 32;
const SMOOTHING = 0.85;

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

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const smoothValues = useRef<number[]>(Array(BAR_COUNT).fill(0));

  const canSend =
    input.trim().length > 0 &&
    !isSending &&
    voiceState === "idle";

  /* -----------------------------
     SPEECH RECOGNITION
  ------------------------------ */
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onend = () => {
      stopAudio();
      setVoiceState("idle");
    };

    recognitionRef.current = recognition;
  }, [setInput]);

  /* -----------------------------
     AUDIO VISUALIZER (SMOOTH)
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
          slice.reduce((a, b) => a + Math.abs(b - 128), 0) /
          slice.length;

        const target = Math.min(32, avg * 1.4);
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
    if (!recognitionRef.current) return;
    setInput("");
    setVoiceState("recording");
    recognitionRef.current.start();
    startAudio();
  }

  function stopRecording() {
    setVoiceState("processing");
    recognitionRef.current?.stop();
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
            voiceState === "recording"
              ? stopRecording
              : startRecording
          }
          className={`w-10 h-10 rounded-full flex items-center justify-center transition
            ${
              voiceState === "recording"
                ? "bg-[#E11D2E]"
                : "bg-gray-700 hover:bg-gray-600"
            }
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
          <div className="flex-1 flex items-end gap-[2px] h-8">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  if (el) barsRef.current[i] = el;
                }}
                className="flex-1 bg-[#E11D2E] rounded-full transition-[height] duration-75"
                style={{ height: 6 }}
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
          className={`w-10 h-10 rounded-full flex items-center justify-center transition
            ${
              canSend
                ? "bg-[#E11D2E] hover:bg-[#C81E2A]"
                : "bg-gray-700 opacity-50 cursor-not-allowed"
            }
          `}
        >
          <FaPaperPlane className="text-white text-[13px]" />
        </button>
      </div>
    </div>
  );
}
