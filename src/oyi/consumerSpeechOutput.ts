import type { OyiSpeechOutput } from "oyi-interaction";

/** Browser-only output. A queued utterance is not evidence of audible speech. */
export function createConsumerSpeechOutput(host: any = globalThis): OyiSpeechOutput {
  const available = Boolean(host.speechSynthesis && host.SpeechSynthesisUtterance && !host.Capacitor?.isNativePlatform?.());
  let cancelCurrent: (() => void) | null = null;
  return {
    available,
    cancel() { cancelCurrent?.(); cancelCurrent = null; },
    speak(text, onStart) {
      cancelCurrent?.();
      return new Promise<void>((resolve, reject) => {
        if (!available || !text.trim()) { reject(new Error("Speech output unavailable")); return; }
        let utterance: any;
        let done = false;
        let started = false;
        let deadline: ReturnType<typeof setTimeout>;
        const finish = (error?: Error) => {
          if (done) return;
          done = true; clearTimeout(deadline);
          if (utterance) utterance.onstart = utterance.onend = utterance.onerror = null;
          cancelCurrent = null;
          if (error) { host.speechSynthesis.cancel(); reject(error); } else resolve();
        };
        cancelCurrent = () => finish(new Error("Speech cancelled"));
        try {
          host.speechSynthesis.cancel();
          utterance = new host.SpeechSynthesisUtterance(text);
          utterance.rate = 0.96;
          utterance.onstart = () => {
            if (done) return;
            started = true; clearTimeout(deadline);
            deadline = setTimeout(() => finish(new Error("Speech playback timed out")), 120000);
            onStart();
          };
          utterance.onend = () => finish(started ? undefined : new Error("Speech start was not confirmed"));
          utterance.onerror = () => finish(new Error("Speech playback failed"));
          deadline = setTimeout(() => finish(new Error("Speech playback did not start")), 10000);
          host.speechSynthesis.speak(utterance);
        } catch { finish(new Error("Speech playback could not start")); }
      });
    },
  };
}
