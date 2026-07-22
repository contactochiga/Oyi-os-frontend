import messagesService from "@/services/messagesService";

type PresenceSubscription = {
  stop: () => void;
};

let activeCount = 0;
let timer: number | null = null;
let inFlight: Promise<void> | null = null;
let lastPingAt = 0;
let failureCount = 0;
let retryAfter = 0;
let listenersAttached = false;

const DEFAULT_INTERVAL_MS = 45_000;
const MIN_PING_GAP_MS = 10_000;
const MAX_RETRY_BACKOFF_MS = 120_000;

function clearTimer() {
  if (timer != null && typeof window !== "undefined") {
    window.clearInterval(timer);
  }
  timer = null;
}

async function pingPresence(reason: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (retryAfter > now) return;
  if (inFlight || now - lastPingAt < MIN_PING_GAP_MS) return;
  lastPingAt = now;
  inFlight = messagesService
    .pingPresence()
    .then((result: any) => {
      if (result?.error) throw new Error(String(result.error));
      failureCount = 0;
      retryAfter = 0;
    })
    .catch((error) => {
      failureCount += 1;
      retryAfter = Date.now() + Math.min(MAX_RETRY_BACKOFF_MS, 2_000 * 2 ** Math.min(failureCount, 6));
      if (process.env.NODE_ENV !== "production") {
        console.debug("oyi_presence_ping_failed", { reason, error });
      }
    })
    .finally(() => {
      inFlight = null;
    });
  await inFlight;
}

function onFocus() {
  void pingPresence("focus");
}

function onVisibility() {
  if (document.visibilityState === "visible") {
    void pingPresence("visible");
  }
}

function attachListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
  listenersAttached = true;
}

function detachListeners() {
  if (!listenersAttached || typeof window === "undefined") return;
  window.removeEventListener("focus", onFocus);
  document.removeEventListener("visibilitychange", onVisibility);
  listenersAttached = false;
}

export function startPresenceHeartbeat(intervalMs = DEFAULT_INTERVAL_MS): PresenceSubscription {
  if (typeof window === "undefined") return { stop: () => {} };
  activeCount += 1;
  attachListeners();
  if (timer == null) {
    void pingPresence("start");
    timer = window.setInterval(() => {
      void pingPresence("interval");
    }, Math.max(15_000, intervalMs));
  }

  return {
    stop: () => {
      activeCount = Math.max(0, activeCount - 1);
      if (activeCount > 0) return;
      clearTimer();
      detachListeners();
      inFlight = null;
      lastPingAt = 0;
      failureCount = 0;
      retryAfter = 0;
    },
  };
}
