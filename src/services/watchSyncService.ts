import { Capacitor, registerPlugin } from "@capacitor/core";
import { getConsumerApiBaseURL } from "@/services/apiBase";
import type { SessionUser } from "@/store/useSessionStore";

type WatchSyncPayload = {
  backendBaseURL: string;
  bearerToken: string;
  userId?: string;
  homeId?: string;
  estateId?: string;
  role?: string;
};

export type WatchSyncResult = {
  available?: boolean;
  paired?: boolean;
  watchAppInstalled?: boolean;
  installed?: boolean;
  reachable?: boolean;
  activationState?: number;
  activationTimedOut?: boolean;
  usedApplicationContext?: boolean;
  usedTransferUserInfo?: boolean;
  usedSendMessage?: boolean;
  tokenSent?: boolean;
  backendURLSent?: boolean;
  lastSyncAt?: string | null;
  error?: string | null;
  lastSyncError?: string | null;
  lastActivationError?: string | null;
  synced?: boolean;
  acknowledged?: boolean;
  connected?: boolean;
  deliveryState?: "not_connected" | "sync_queued" | "sync_sent" | "waiting_for_watch" | "connected" | "offline" | "sync_failed" | string;
  lastAcknowledgedAt?: string | null;
  lastBackendSuccessAt?: string | null;
  lastWatchError?: string | null;
  reason?: string;
};

type OyiWatchSyncPlugin = {
  sync(payload: WatchSyncPayload): Promise<WatchSyncResult>;
  status(): Promise<WatchSyncResult>;
};

const OyiWatchSync = registerPlugin<OyiWatchSyncPlugin>("OyiWatchSync");

export function getConsumerBackendBaseURL() {
  return getConsumerApiBaseURL();
}

export async function syncOyiWatchSession(token: string | null | undefined, user: SessionUser | null | undefined) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { available: false, synced: false, reason: "ios_native_only" } satisfies WatchSyncResult;
  }

  if (!Capacitor.isPluginAvailable("OyiWatchSync")) {
    return { available: false, synced: false, reason: "plugin_unavailable" } satisfies WatchSyncResult;
  }

  if (!token) {
    return { available: true, synced: false, reason: "missing_token" } satisfies WatchSyncResult;
  }

  const payload: WatchSyncPayload = {
    backendBaseURL: getConsumerBackendBaseURL(),
    bearerToken: token,
    userId: user?.id,
    homeId: user?.home_id,
    estateId: user?.estate_id,
    role: user?.role,
  };

  return withWatchTimeout(OyiWatchSync.sync(payload));
}

export async function getOyiWatchSyncStatus() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { available: false, reason: "ios_native_only" } satisfies WatchSyncResult;
  }
  if (!Capacitor.isPluginAvailable("OyiWatchSync")) {
    return { available: false, reason: "plugin_unavailable" } satisfies WatchSyncResult;
  }
  return withWatchTimeout(OyiWatchSync.status());
}

export function isOyiWatchConnected(status: WatchSyncResult | null | undefined) {
  return Boolean(status?.connected || status?.acknowledged);
}

export function describeOyiWatchStatus(status: WatchSyncResult | null | undefined) {
  if (!status?.available) return "Not Connected";
  if (isOyiWatchConnected(status)) return "Connected";
  if (status.deliveryState === "sync_queued") return "Sync Queued";
  if (status.deliveryState === "sync_sent") return "Sync Sent";
  if (status.deliveryState === "waiting_for_watch" || status.tokenSent || status.backendURLSent) return "Waiting for Watch";
  if (status.deliveryState === "offline" && status.lastBackendSuccessAt) {
    return `Offline · Last synced ${new Date(status.lastBackendSuccessAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (status.lastWatchError || status.lastSyncError || status.error || status.deliveryState === "sync_failed") return "Sync Failed";
  if (status.reachable) return "Reachable";
  if (status.paired && status.watchAppInstalled) return "Installed · Paired";
  if (status.watchAppInstalled || status.installed) return "Installed";
  if (status.paired) return "Paired";
  return "Not Connected";
}

function withWatchTimeout<T extends WatchSyncResult>(request: Promise<T>, timeoutMs = 5000): Promise<T | WatchSyncResult> {
  return Promise.race([
    request,
    new Promise<WatchSyncResult>((resolve) =>
      setTimeout(() => resolve({ available: false, synced: false, reason: "watch_sync_timeout" }), timeoutMs)
    ),
  ]);
}
