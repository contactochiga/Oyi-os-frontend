import type { OyiVoiceAdapter, OyiVoiceSnapshot } from "oyi-interaction";

// Browser host implementation of the existing shared contract. No uploads,
// automatic submission, native-plugin claim, or invented final transcript.
export function createConsumerVoiceAdapter(host: any = globalThis): OyiVoiceAdapter {
  const Recognition = host.SpeechRecognition || host.webkitSpeechRecognition;
  const available = Boolean(Recognition && !host.Capacitor?.isNativePlatform?.());
  let snapshot: OyiVoiceSnapshot = { available, permissionState: available ? "unknown" : "unsupported", status: "idle", interimTranscript: "", finalTranscript: "", audioLevel: null, error: null };
  const listeners = new Set<(snapshot: OyiVoiceSnapshot) => void>();
  let recognition: any = null;
  let epoch = 0;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  const emit = (next: Partial<OyiVoiceSnapshot>) => { snapshot = { ...snapshot, ...next }; listeners.forEach(fn => fn(snapshot)); };
  const detach = () => {
    epoch += 1;
    if (deadline) clearTimeout(deadline);
    deadline = null;
    const old = recognition;
    recognition = null;
    if (old) { old.onstart = null; old.onresult = null; old.onerror = null; old.onend = null; try { old.abort(); } catch {} }
  };
  // Failed/unfinished words may be recovered into an editable draft, never sent.
  const fail = (message: string, permissionState = snapshot.permissionState) => { detach(); emit({ status: "error", error: message, permissionState }); };
  return {
    kind: available ? "web_speech" : "unavailable",
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    startListening() {
      if (recognition) return;
      if (!available) { fail("Browser transcription is unavailable here. Native voice is not implemented; please type your message.", "unsupported"); return; }
      detach();
      const session = epoch;
      // Reset the prior session even if constructing the browser API throws.
      emit({ status: "idle", permissionState: "prompt", error: null, finalTranscript: "", interimTranscript: "" });
      try {
        const current = new Recognition(); recognition = current;
        current.lang = "en-US"; current.interimResults = true; current.continuous = true;
        current.onstart = () => { if (session !== epoch) return; if (deadline) clearTimeout(deadline); deadline = null; emit({ status: "listening", permissionState: "granted" }); };
        current.onresult = (event: any) => {
          if (session !== epoch) return;
          const rows = Array.from(event.results || []) as any[];
          emit({ interimTranscript: rows.filter(r => !r.isFinal).map(r => String(r[0]?.transcript || "")).join(" ").trim(), finalTranscript: rows.filter(r => r.isFinal).map(r => String(r[0]?.transcript || "")).join(" ").trim() });
        };
        current.onerror = (event: any) => {
          if (session !== epoch) return;
          const denied = ["not-allowed", "service-not-allowed"].includes(event.error);
          fail(denied ? "Microphone or speech permission was denied. Allow access in browser settings or type your message." : event.error === "network" ? "Speech transcription service is unavailable. Your typed text is unchanged; please try again or type." : "No reliable transcription was received. Your typed text is unchanged; please try again.", denied ? "denied" : snapshot.permissionState);
        };
        current.onend = () => {
          if (session !== epoch) return;
          const finalTranscript = snapshot.finalTranscript;
          detach();
          if (!finalTranscript || snapshot.interimTranscript) emit({ status: "error", error: "Transcription was incomplete. Nothing was sent; review the available draft or try again." });
          else emit({ status: "idle", interimTranscript: "", finalTranscript });
        };
        deadline = setTimeout(() => { if (session === epoch) fail("Microphone start was not confirmed. Please retry or type your message."); }, 10000);
        current.start();
      } catch { fail("Voice capture could not start. Please type your message."); }
    },
    stopListening() {
      if (!recognition || snapshot.status !== "listening") return;
      emit({ status: "transcribing" });
      if (deadline) clearTimeout(deadline);
      const session = epoch;
      deadline = setTimeout(() => { if (session === epoch) fail("Transcription did not finish. Your typed text is unchanged; please retry."); }, 5000);
      try { recognition.stop(); } catch { fail("Recording could not finalize. Your typed text is unchanged."); }
    },
    cancelListening() { detach(); emit({ status: "idle", permissionState: snapshot.permissionState === "prompt" ? "unknown" : snapshot.permissionState, interimTranscript: "", finalTranscript: "", error: null }); },
  };
}
