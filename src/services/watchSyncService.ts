import { Capacitor, registerPlugin } from "@capacitor/core";
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
  reachable?: boolean;
  activationState?: number;
  lastSyncError?: string | null;
  lastActivationError?: string | null;
  synced?: boolean;
  reason?: string;
};

type OyiWatchSyncPlugin = {
  sync(payload: WatchSyncPayload): Promise<WatchSyncResult>;
  status(): Promise<WatchSyncResult>;
};

const OyiWatchSync = registerPlugin<OyiWatchSyncPlugin>("OyiWatchSync");

export function getConsumerBackendBaseURL() {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
}

export async function syncOyiWatchSession(token: string | null | undefined, user: SessionUser | null | undefined) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { available: false, synced: false, reason: "ios_native_only" } satisfies WatchSyncResult;
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

  return OyiWatchSync.sync(payload);
}

export async function getOyiWatchSyncStatus() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { available: false, reason: "ios_native_only" } satisfies WatchSyncResult;
  }
  return OyiWatchSync.status();
}
