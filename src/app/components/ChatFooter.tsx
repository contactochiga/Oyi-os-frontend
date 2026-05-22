// src/app/components/ChatFooter.tsx
"use client";

import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

type VoiceState = "idle" | "recording" | "processing" | "review";
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
  const [hasNativeSpeech, setHasNativeSpeech] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const voiceActionRef = useRef<"review" | "send">("review");
  const finalTranscriptRef = useRef("");
  const activeEngineRef = useRef<"web" | "native" | null>(null);
  const finalizingRef = useRef(false);
  const nativeListenerHandlesRef = useRef<Array<{ remove: () => Promise<void> }>>([]);
  const nativeSpeechRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const barsRef = useRef<HTMLDivElement[]>([]);
  const smoothValues = useRef<number[]>(Array(BAR_COUNT).fill(0));

  const canSend =
    input.trim().length > 0 &&
    !isSending &&
    voiceState !== "recording" &&
    voiceState !== "processing";
  const isNativePlatform = Capacitor.isNativePlatform();
  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const shouldPreferNativeSpeech = isNativePlatform && hasNativeSpeech;
  const hasVoiceEngine = shouldPreferNativeSpeech || hasSpeechRecognition || hasNativeSpeech;

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

  async function getNativeSpeechRecognition() {
    if (!Capacitor.isNativePlatform()) return null;
    if (nativeSpeechRef.current) return nativeSpeechRef.current;
    try {
      const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
      const mod = await dynamicImport("@capacitor-community/speech-recognition");
      nativeSpeechRef.current = mod.SpeechRecognition;
      return nativeSpeechRef.current;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const NativeSpeech = await getNativeSpeechRecognition();
      if (!NativeSpeech) return;
      try {
        const availability = await NativeSpeech.available();
        if (!cancelled) setHasNativeSpeech(!!availability?.available);
      } catch {
        if (!cancelled) setHasNativeSpeech(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function cleanupNativeListeners() {
    const handles = nativeListenerHandlesRef.current.splice(0);
    for (const h of handles) {
      try {
        await h.remove();
      } catch {}
    }
    try {
      await nativeSpeechRef.current?.removeAllListeners?.();
    } catch {}
  }

  function finalizeVoiceReview() {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    stopAudio();
    const text = finalTranscriptRef.current.trim();
    activeEngineRef.current = null;
    voiceActionRef.current = "review";
    setLiveTranscript("");

    if (!text) {
      setVoiceState("idle");
      setVoiceHint("No speech detected. Try again.");
      finalizingRef.current = false;
      return;
    }
    setInput(text);
    setVoiceState("review");
    finalizingRef.current = false;
  }

  function finalizeVoiceAndSend() {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    stopAudio();
    setVoiceState("idle");

    const text = finalTranscriptRef.current.trim();
    activeEngineRef.current = null;
    voiceActionRef.current = "review";
    setLiveTranscript("");

    if (!text) {
      setVoiceHint("No speech detected. Try again.");
      finalizingRef.current = false;
      return;
    }
    setInput("");
    finalTranscriptRef.current = "";
    void handleSend(text, { clearComposer: true }).finally(() => {
      finalizingRef.current = false;
    });
  }

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      void cleanupNativeListeners();
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startAudio() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Audio capture is not supported on this device.");
    }
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

  function startWebRecognition() {
    const BrowserSpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!BrowserSpeechRecognition) {
      setVoiceState("idle");
      stopAudio();
      setVoiceHint("Could not start voice recognition on this device.");
      return;
    }

    const recognition = new BrowserSpeechRecognition();
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
      finalTranscriptRef.current = merged;
      setLiveTranscript(merged);
      setIntent(inferIntent(merged));
    };

    recognition.onerror = (e: any) => {
      voiceActionRef.current = "review";
      setVoiceState("idle");
      stopAudio();
      activeEngineRef.current = null;
      const code = String(e?.error || "");
      if (code === "not-allowed" || code === "service-not-allowed") {
        setVoiceHint("Speech recognition is blocked. Allow Speech Recognition in iPhone Settings.");
      } else {
        setVoiceHint("Could not start voice recognition on this device.");
      }
    };

    recognition.onend = () => {
      if (voiceActionRef.current === "send") finalizeVoiceAndSend();
      else finalizeVoiceReview();
    };

    activeEngineRef.current = "web";
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setVoiceState("idle");
      stopAudio();
      setVoiceHint("Could not start voice recognition on this device.");
    }
  }

  async function startRecording() {
    if (!hasVoiceEngine) {
      setVoiceHint("Voice command is not available on this device.");
      return;
    }
    setVoiceHint(null);
    vibrate(20);
    setIntent("default");
    setInput("");
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    finalizingRef.current = false;
    voiceActionRef.current = "review";
    setVoiceState("recording");

    try {
      await startAudio();
    } catch (e: any) {
      if (!shouldPreferNativeSpeech) {
        setVoiceState("idle");
        const name = String(e?.name || "");
        if (name === "NotAllowedError" || name === "SecurityError") {
          setVoiceHint("Microphone blocked. Enable microphone for Oyi in iPhone Settings and reopen the app.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setVoiceHint("No microphone device found.");
        } else {
          setVoiceHint("Microphone permission is required for voice command.");
        }
        return;
      }
    }

    if (shouldPreferNativeSpeech) {
      try {
        await cleanupNativeListeners();
        const NativeSpeech = await getNativeSpeechRecognition();
        if (!NativeSpeech) throw new Error("native_speech_unavailable");
        const permissions = await NativeSpeech.checkPermissions();
        const granted =
          permissions?.speechRecognition === "granted" ||
          (await NativeSpeech.requestPermissions()).speechRecognition === "granted";
        if (!granted) {
          setVoiceState("idle");
          stopAudio();
          setVoiceHint("Enable microphone and speech permissions for Oyi in iPhone Settings.");
          return;
        }

        const p1 = await NativeSpeech.addListener("partialResults", (data: any) => {
          const transcript = String(data?.matches?.[0] || "").trim();
          if (!transcript) return;
          finalTranscriptRef.current = transcript;
          setLiveTranscript(transcript);
          setIntent(inferIntent(transcript));
        });
        const p2 = await NativeSpeech.addListener("listeningState", (state: any) => {
          if (state?.status === "stopped") {
            if (voiceActionRef.current === "send") finalizeVoiceAndSend();
            else finalizeVoiceReview();
          }
        });
        nativeListenerHandlesRef.current = [p1, p2];

        activeEngineRef.current = "native";
        const started = await NativeSpeech.start({
          language: "en-US",
          maxResults: 1,
          partialResults: true,
          popup: false,
        });
        const immediate = String(started?.matches?.[0] || "").trim();
        if (immediate) {
          finalTranscriptRef.current = immediate;
          setLiveTranscript(immediate);
          setIntent(inferIntent(immediate));
        }
      } catch {
        if (hasSpeechRecognition) {
          startWebRecognition();
          return;
        }
        setVoiceState("idle");
        stopAudio();
        setVoiceHint("Could not start native voice recognition.");
      }
      return;
    }
    startWebRecognition();
  }

  function stopRecording(mode: "review" | "send" = "review") {
    vibrate(40);
    setVoiceState("processing");
    voiceActionRef.current = mode;

    try {
      if (activeEngineRef.current === "native") {
        void nativeSpeechRef.current?.stop?.().catch(() => {
          if (mode === "send") finalizeVoiceAndSend();
          else finalizeVoiceReview();
        });
        window.setTimeout(() => {
          if (mode === "send") finalizeVoiceAndSend();
          else finalizeVoiceReview();
        }, 1200);
      } else {
        recognitionRef.current?.stop();
      }
    } catch {}
  }

  async function handleSend(overrideText?: string, options?: { clearComposer?: boolean }) {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    if (!overrideText && (voiceState === "recording" || voiceState === "processing")) return;
    setIsSending(true);
    try {
      await onSend(text);
      if (options?.clearComposer || overrideText) {
        setInput("");
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div
        className="
          relative rounded-[28px]
          border border-white/10 bg-white/5
          backdrop-blur-xl overflow-hidden
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

        {voiceState === "recording" ? (
          <div className="relative z-[1] space-y-2 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => stopRecording("review")}
                className="h-10 w-10 shrink-0 rounded-2xl border border-white/20 bg-white text-black flex items-center justify-center transition active:scale-[0.99]"
                aria-label="Stop recording"
              >
                <FaStop className="text-[14px]" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Recording
                </div>
                <div className="mt-0.5 truncate text-sm text-white/80">
                  {liveTranscript || "Speak naturally. Oyi is listening."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => stopRecording("send")}
                className="h-10 rounded-2xl border border-white/20 bg-white px-4 text-sm font-semibold text-black transition active:scale-[0.99]"
                aria-label="Send voice command"
              >
                Send
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
              <div className="flex h-8 items-end gap-[3px]">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      if (el) barsRef.current[i] = el;
                    }}
                    className="flex-1 rounded-full transition-[height] duration-75"
                    style={{
                      height: 6,
                      minWidth: 3,
                      backgroundColor: INTENT_COLORS[intent],
                      opacity: intent === "default" ? 0.6 : 0.92,
                      boxShadow: "0 0 8px rgba(255,255,255,0.08)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-[1] flex items-end gap-3 px-3 py-2">
            <button
              type="button"
              onClick={() => void startRecording()}
              className={`
                w-10 h-10 rounded-2xl flex items-center justify-center
                border transition active:scale-[0.99]
                ${!hasVoiceEngine ? "opacity-45 cursor-not-allowed" : "bg-white/5 text-white border-white/10 hover:bg-white/10"}
              `}
              disabled={!hasVoiceEngine}
              aria-label="Start recording"
            >
              <FaMicrophone className="text-[14px]" />
            </button>

            <textarea
              value={input}
              onChange={(e) => {
                const v = e.target.value;
                setInput(v);
                setIntent(inferIntent(v));
                e.currentTarget.style.height = "0px";
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 112)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder={voiceState === "review" ? "Review voice command before sending" : "Ask Oyi…"}
              className="max-h-24 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[15px] leading-[20px] text-white/90 outline-none placeholder-white/35"
            />

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className={`
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
        )}
      </div>
      {voiceHint ? (
        <div className="mt-2 text-[11px] text-amber-200/90 px-2">{voiceHint}</div>
      ) : null}
    </div>
  );
}
