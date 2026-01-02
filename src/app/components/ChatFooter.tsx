"use client";

import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "recording" | "processing";

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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);

  const canSend = input.trim().length > 0 && !isSending && voiceState === "idle";

  /* ---------------------------
     INIT SPEECH RECOGNITION
  ---------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

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

  /* ---------------------------
     AUDIO VISUALIZER
  ---------------------------- */
  async function startAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    animateBars();
  }

  function stopAudio() {
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  function animateBars() {
    if (!analyserRef.current) return;

    const buffer = new Uint8Array(analyserRef.current.frequencyBinCount);

    const loop = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(buffer);
      buffer.slice(0, barsRef.current.length).forEach((v, i) => {
        const h = Math.max(6, v / 2);
        barsRef.current[i].style.height = `${h}px`;
      });

      requestAnimationFrame(loop);
    };

    loop();
  }

  /* ---------------------------
     MIC CONTROLS
  ---------------------------- */
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

  /* ---------------------------
     SEND
  ---------------------------- */
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
      <div className="relative flex items-center bg-gray-800 rounded-full p-2 gap-2">

        {/* MIC / STOP */}
        <button
          onClick={
            voiceState === "recording" ? stopRecording : startRecording
          }
          className={`
            w-10 h-10 rounded-full flex items-center justify-center transition
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

        {/* INPUT OR VISUALIZER */}
        {voiceState === "recording" ? (
          <div className="flex-1 flex items-center gap-1 px-3 h-8">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  if (el) barsRef.current[i] = el;
                }}
                className="w-[3px] bg-[#E11D2E] rounded-full transition-all"
                style={{ height: 8 }}
              />
            ))}
          </div>
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Oyi…"
            className="
              flex-1 bg-transparent outline-none px-2
              text-sm text-white placeholder-gray-400
            "
          />
        )}

        {/* SEND */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center transition
            ${
              canSend
                ? "bg-[#E11D2E] hover:bg-[#C81E2A]"
                : "bg-gray-700 cursor-not-allowed opacity-60"
            }
          `}
        >
          <FaPaperPlane className="text-white text-[13px]" />
        </button>
      </div>
    </div>
  );
}
