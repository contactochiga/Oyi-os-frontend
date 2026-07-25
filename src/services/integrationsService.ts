import API from "./api";

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

export type SmartIntegrationProvider = "tuya" | "alexa" | "google_assistant";
export type GenericIntegrationResponse = {
  provider: SmartIntegrationProvider;
  connected: boolean;
  external_user_id?: string | null;
  masked_external_user_id?: string | null;
};

export type TuyaSyncSummary = {
  ok: boolean;
  provider: "tuya";
  synced_at: string;
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  unavailable: number;
  errors: string[];
};

const TUYA_SYNC_STORAGE_KEY = "oyi_tuya_last_sync";

function activeContextStorageSuffix() {
  try {
    if (typeof window === "undefined") return "global";
    const estateId = window.localStorage.getItem("oyi_estate_id") || window.localStorage.getItem("estate_id") || window.localStorage.getItem("ochiga_estate") || "";
    const homeId = window.localStorage.getItem("oyi_home_id") || window.localStorage.getItem("home_id") || window.localStorage.getItem("ochiga_home") || "";
    return `${estateId || "estate"}:${homeId || "home"}`;
  } catch {
    return "global";
  }
}

function tuyaSyncStorageKey() {
  return `${TUYA_SYNC_STORAGE_KEY}:${activeContextStorageSuffix()}`;
}

export function formatTuyaSyncSummary(summary?: Partial<TuyaSyncSummary> | null) {
  if (!summary) return "";
  return `Added ${Number(summary.added || 0)} · Updated ${Number(summary.updated || 0)} · Unavailable ${Number(summary.unavailable || 0)}`;
}

export function getStoredTuyaSyncSummary(): TuyaSyncSummary | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(tuyaSyncStorageKey()) || window.localStorage.getItem(TUYA_SYNC_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TuyaSyncSummary) : null;
  } catch {
    return null;
  }
}

export async function syncTuyaDevices() {
  try {
    const res = await API.post("/integrations/tuya/sync");
    const summary = res.data as TuyaSyncSummary;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(tuyaSyncStorageKey(), JSON.stringify(summary));
      window.dispatchEvent(new CustomEvent("oyi:device-registry-updated", { detail: summary }));
    }
    return summary;
  } catch (err: any) {
    const status = Number(err?.response?.status || 0);
    const message = pickError(err, "Smart Life sync failed");
    if (status === 404) {
      try {
        const fallback = await API.post("/me/integrations/tuya/sync");
        const summary = fallback.data as TuyaSyncSummary;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(tuyaSyncStorageKey(), JSON.stringify(summary));
          window.dispatchEvent(new CustomEvent("oyi:device-registry-updated", { detail: summary }));
        }
        return summary;
      } catch (fallbackErr: any) {
        throw new Error(pickError(fallbackErr, "Smart Life sync failed"));
      }
    }
    if (status === 401 || status === 409 || /credential|token|linked|expired|unauthor/i.test(message)) {
      throw new Error("Reconnect Smart Life");
    }
    throw new Error(message);
  }
}

export async function getTuyaIntegration() {
  try {
    const res = await API.get("/me/integrations/tuya");
    return res.data as {
      provider: "tuya";
      connected: boolean;
      provider_ready?: boolean;
      credential_status?: "ready" | "missing";
      tuya_uid?: string | null;
      masked_uid?: string | null;
    };
  } catch (err: any) {
    return { error: pickError(err, "Failed to load Tuya integration") } as any;
  }
}

export async function saveTuyaIntegration(tuya_uid: string) {
  try {
    const res = await API.patch("/me/integrations/tuya", { tuya_uid });
    return res.data as { ok: boolean; provider: "tuya"; connected: boolean; tuya_uid?: string | null };
  } catch (err: any) {
    return { error: pickError(err, "Failed to save Tuya integration") } as any;
  }
}

export async function getGenericIntegration(provider: Exclude<SmartIntegrationProvider, "tuya">) {
  try {
    const res = await API.get(`/me/integrations/${provider}`);
    return res.data as GenericIntegrationResponse;
  } catch (err: any) {
    return { error: pickError(err, `Failed to load ${provider} integration`) } as any;
  }
}

export async function saveGenericIntegration(
  provider: Exclude<SmartIntegrationProvider, "tuya">,
  external_user_id: string
) {
  try {
    const res = await API.patch(`/me/integrations/${provider}`, { external_user_id });
    return res.data as GenericIntegrationResponse & { ok: boolean };
  } catch (err: any) {
    return { error: pickError(err, `Failed to save ${provider} integration`) } as any;
  }
}
