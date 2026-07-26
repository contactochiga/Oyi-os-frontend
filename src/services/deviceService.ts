// src/services/deviceService.ts
import API from "./api";
import type { DeviceRuntimeContract } from "@/lib/deviceRuntimeContract";

export type AssignDevicesPayload = {
  deviceIds?: string[];
  devices?: Array<Record<string, any>>;
  room?: string | null;
  room_id?: string | null;
};

export type DeviceStateResponse = DeviceRuntimeContract & {
  deviceId?: string;
  assignment?: Record<string, any> | null;
  error?: string;
};

export type DeviceRuntimeSummary = DeviceRuntimeContract & {
  id?: string;
  device_id: string;
  name?: string;
  estate_id?: string | null;
  home_id?: string | null;
  room_id?: string | null;
  parent_device_id?: string | null;
  is_virtual?: boolean;
  external_id?: string | null;
  provider?: string | null;
  vendor?: string | null;
  adapter?: string | null;
  type?: string | null;
  category?: string | null;
  metadata?: Record<string, any>;
  freshness?: string;
  stale?: boolean;
};

export type DeviceStateInclude = "intelligence" | "timeline";

type RuntimeDevicesOptions = {
  force?: boolean;
};

type RuntimeDevicesCacheEntry = {
  createdAt: number;
  promise: Promise<DeviceRuntimeSummary[]>;
  value?: DeviceRuntimeSummary[];
};

const RUNTIME_DEVICES_DEDUPE_MS = 5_000;
const runtimeDevicesCache = new Map<string, RuntimeDevicesCacheEntry>();
const deviceStateInFlight = new Map<string, Promise<DeviceStateResponse>>();
const deviceViewReleaseInFlight = new Map<string, Promise<void>>();

export type IrProfileOption = {
  key: string;
  label?: string;
  appliance_type?: string;
  control_profile?: string;
  device_family?: string;
  supported_controls?: string[];
  source?: string;
};

export type SmartAccessCapabilityStatus =
  | "supported"
  | "unsupported"
  | "unknown"
  | "temporarily_unavailable"
  | "permission_denied"
  | "setup_incomplete"
  | "provider_disconnected"
  | "provider_declared_only"
  | "mapping_missing"
  | "verification_required";

export type SmartAccessCapabilityEvidence = {
  declaredByProvider?: boolean;
  readableByOyi?: boolean;
  executableByOyi?: boolean;
  liveVerified?: boolean;
  status: SmartAccessCapabilityStatus;
  reason?: string;
  sourceCodes?: string[];
  provider?: string;
  verifiedAt?: string;
};

export type SmartAccessResponse = {
  ok?: boolean;
  device?: {
    id: string;
    name?: string | null;
    estate_id?: string | null;
    home_id?: string | null;
    room_id?: string | null;
    provider?: string | null;
    provider_category?: string | null;
    provider_product_id?: string | null;
    provider_model?: string | null;
  };
  profile?: {
    is_smart_access?: boolean;
    device_family?: string;
    control_profile?: string;
    capabilities?: Record<string, Record<string, SmartAccessCapabilityEvidence>>;
    supported_controls?: string[];
    state?: {
      online?: boolean | null;
      locked?: boolean | null;
      lockState?: string | null;
      provider_connection_state?: "connected" | "disconnected" | "reconnect_required" | "unknown";
      device_reachability?: "online" | "offline" | "unknown";
      lock_state_freshness?: "fresh" | "stale" | "expired" | "unknown";
      lock_state_confirmed_at?: string | null;
      doorOpen?: boolean | null;
      batteryPercentage?: number | null;
      batteryLevel?: "normal" | "low" | "critical" | "unknown";
      battery_freshness?: "fresh" | "stale" | "expired" | "unknown";
      battery_confirmed_at?: string | null;
      batteryLow?: boolean;
      tamperActive?: boolean;
      wrongAttemptActive?: boolean;
      lastAccessEvent?: any;
    };
    truth?: {
      provider_connection_state?: "connected" | "disconnected" | "reconnect_required" | "unknown";
      device_reachability?: "online" | "offline" | "unknown";
      lock_state?: "locked" | "unlocked" | "unknown";
      lock_state_freshness?: "fresh" | "stale" | "expired" | "unknown";
      lock_state_confirmed_at?: string | null;
      battery_level?: number | null;
      battery_freshness?: "fresh" | "stale" | "expired" | "unknown";
      battery_confirmed_at?: string | null;
      last_successful_provider_contact_at?: string | null;
      last_provider_error_code?: string | null;
      last_provider_error_classification?: string | null;
      remote_unlock_available?: boolean;
      remote_unlock_unavailable_reason?: string | null;
      provider_reconnect_required?: boolean;
    };
    evidence?: Record<string, any>;
    confidence?: Record<string, any>;
    operation_matrix?: Array<Record<string, any>>;
    raw_fingerprint?: string;
  };
  records?: Array<Record<string, any>>;
  credentials?: Array<Record<string, any>>;
};

function normalizeDeviceListError(err: any) {
  const status = Number(err?.response?.status || 0);
  const backend = String(err?.response?.data?.error || "").trim();
  const error = new Error(
    status === 400
      ? "Your home context could not be loaded."
      : status === 401
      ? "Please sign in again to load your devices."
      : status === 403
      ? "This account does not have access to these devices."
      : status >= 500
      ? "Devices are temporarily unavailable. Try again."
      : backend || err?.message || "Failed to load devices",
  ) as Error & { status?: number; code?: string; technical?: string };
  error.status = status;
  error.code =
    status === 400
      ? "context_unavailable"
      : status === 401
      ? "not_authenticated"
      : status === 403
      ? "forbidden"
      : status >= 500
      ? "backend_unavailable"
      : "device_list_failed";
  error.technical = backend || err?.message || "Failed to load devices";
  return error;
}

/**
 * ✅ RULES (keep it simple)
 * - DISCOVERY = /devices/discover  (things Tuya can see, not yet “bound”)
 * - ASSIGNED  = /devices/estate/:estateId  (things saved to your DB for that estate)
 * - STATE     = /devices/:deviceId/state  (works for internal UUID OR external_id — your backend resolves it)
 * - COMMAND   = /devices/:deviceId/command
 */
export const deviceService = {
  /**
   * ✅ DISCOVERY ONLY
   * Always scans discoverable devices (Tuya / adapter).
   */
  async discoverDevices(adapter = "tuya") {
    try {
      const res = await API.get("/devices/discover", { params: { adapter } });
      return res.data?.devices ?? res.data ?? [];
    } catch (err: any) {
      throw normalizeDeviceListError(err);
    }
  },

  /**
   * ✅ ASSIGNED (BOUND) DEVICES ONLY
   * Pull devices that belong to this estate in your DB.
   */
  async getAssignedDevices(estateId?: string) {
    if (!estateId) return [];
    try {
      const res = await API.get(`/devices/estate/${encodeURIComponent(estateId)}`);
      return res.data?.devices ?? res.data ?? [];
    } catch (err: any) {
      throw normalizeDeviceListError(err);
    }
  },

  /**
   * Registry view for the Devices page. Includes estate-scoped provider devices
   * waiting for room/home assignment without leaking them into Home controls.
   */
  async getRegistryDevices(estateId?: string) {
    if (!estateId) return [];
    try {
      const res = await API.get(`/devices/estate/${encodeURIComponent(estateId)}`, {
        params: { include_unassigned: true },
      });
      return res.data?.devices ?? res.data ?? [];
    } catch (err: any) {
      throw normalizeDeviceListError(err);
    }
  },

  /**
   * ✅ Backward-compatible helper
   * - If estateId provided -> ASSIGNED
   * - If not -> DISCOVERY
   *
   * (Keep this so existing screens don’t break.)
   */
  async getDevices(estateId?: string) {
    if (estateId) return this.getAssignedDevices(estateId);
    return this.discoverDevices();
  },

  /**
   * ✅ STATE FETCH
   * Your backend controller resolves deviceId as:
   * - UUID in devices.id OR
   * - external_id in devices.external_id (scoped to estate)
   *
   * IMPORTANT:
   * - If backend returns 404 (device not found in DB / wrong estate), we return { state: {} }
   * - We DO NOT throw
   */
  async getDeviceState(deviceId: string, options: { include?: DeviceStateInclude[]; view?: "panel" | "device" | "active" } = {}): Promise<DeviceStateResponse> {
    const includeValues = Array.from(new Set(options.include || []));
    const include = includeValues.join(",");
    const inferredView = options.view || (includeValues.includes("intelligence") ? "panel" : undefined);
    const requestKey = `${deviceId}:${inferredView || "inventory"}:${include || "core"}`;
    const existing = deviceStateInFlight.get(requestKey);
    if (existing) return existing;
    const request = (async () => {
    try {
      const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/state`, {
        params: {
          ...(include ? { include } : {}),
          ...(inferredView ? { view: inferredView } : {}),
        },
      });

      return {
        deviceId: res.data?.deviceId,
        state: res.data?.state ?? {},
        normalized_state: res.data?.normalized_state ?? null,
        capabilities: res.data?.capabilities ?? [],
        supported_controls: res.data?.supported_controls ?? [],
        capability_codes: res.data?.capability_codes ?? [],
        channel_definitions: res.data?.channel_definitions ?? [],
        control_profile: res.data?.control_profile ?? null,
        health_status: res.data?.health_status ?? null,
        provider_health: res.data?.provider_health ?? null,
        primary_state: res.data?.primary_state ?? null,
        telemetry_summary: res.data?.telemetry_summary ?? null,
        last_signal: res.data?.last_signal ?? null,
        activity_summary: res.data?.activity_summary ?? null,
        device_family: res.data?.device_family ?? null,
        device_type: res.data?.device_type ?? null,
        memory_summary: res.data?.memory_summary ?? null,
        relationships: res.data?.relationships ?? null,
        predictive_findings: res.data?.predictive_findings ?? [],
        recent_executions: res.data?.recent_executions ?? [],
        active_scenes: res.data?.active_scenes ?? [],
        active_automations: res.data?.active_automations ?? [],
        conversation_context: res.data?.conversation_context ?? null,
        lastSeen: res.data?.lastSeen ?? null,
        canonical_state: res.data?.canonical_state ?? res.data?.canonicalState ?? null,
        canonicalState: res.data?.canonical_state ?? res.data?.canonicalState ?? null,
        canonical_presentation: res.data?.canonical_presentation ?? res.data?.presentation ?? null,
        presentation: res.data?.canonical_presentation ?? res.data?.presentation ?? null,
        assignment: res.data?.assignment ?? null,
        error: res.data?.error,
      };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { state: {}, error: "Device not found / not assigned to this estate" };
      }

      return {
        state: {},
        error: err?.response?.data?.error || err?.message || "Failed to load device state",
      };
    }
    })().finally(() => {
      deviceStateInFlight.delete(requestKey);
    });
    deviceStateInFlight.set(requestKey, request);
    return request;
  },

  async releaseDeviceView(deviceId: string): Promise<void> {
    if (!deviceId) return;
    const existing = deviceViewReleaseInFlight.get(deviceId);
    if (existing) return existing;
    const release = (async () => {
    try {
      await API.post(`/devices/${encodeURIComponent(deviceId)}/state/view/release`);
    } catch {
      // Lease TTL remains the crash/navigation fallback; release is best-effort.
    }
    })().finally(() => {
      deviceViewReleaseInFlight.delete(deviceId);
    });
    deviceViewReleaseInFlight.set(deviceId, release);
    return release;
  },

  async getRuntimeDevices(homeId?: string | null, options: RuntimeDevicesOptions = {}): Promise<DeviceRuntimeSummary[]> {
    const cacheKey = String(homeId || "active-home");
    const now = Date.now();
    const cached = runtimeDevicesCache.get(cacheKey);
    if (!options.force && cached && now - cached.createdAt <= RUNTIME_DEVICES_DEDUPE_MS) {
      return cached.value || cached.promise;
    }
    try {
      const promise = API.get("/devices/runtime", {
        params: homeId ? { home_id: homeId } : undefined,
      }).then((res) => {
      const rows = Array.isArray(res.data?.devices) ? res.data.devices : [];
      return rows
        .filter((row: any) => row?.device_id)
        .map((row: any) => ({
          ...row,
          deviceId: String(row.device_id),
          state: row?.state ?? {},
          normalized_state: row?.normalized_state ?? row?.state?.normalized_state ?? null,
          capabilities: row?.capabilities ?? [],
          supported_controls: row?.supported_controls ?? [],
          capability_codes: row?.capability_codes ?? [],
          channel_definitions: row?.channel_definitions ?? [],
          lastSeen: row?.last_refresh ?? row?.runtime_timestamp ?? null,
        }));
      });
      runtimeDevicesCache.set(cacheKey, { createdAt: now, promise });
      const value = await promise;
      runtimeDevicesCache.set(cacheKey, { createdAt: Date.now(), promise: Promise.resolve(value), value });
      return value;
    } catch (err: any) {
      runtimeDevicesCache.delete(cacheKey);
      throw normalizeDeviceListError(err);
    }
  },

  /**
   * ✅ ASSIGN / BIND devices into DB (estate/home/room)
   */
  async assignDevices(payload: AssignDevicesPayload) {
    const res = await API.post("/devices/assign", payload);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("oyi:device-registry-updated", { detail: res.data }));
    }
    return res.data;
  },

  async setFavorite(deviceId: string, favorite: boolean) {
    const res = await API.patch(`/devices/${encodeURIComponent(deviceId)}/preferences`, { favorite });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("oyi:device-registry-updated", { detail: res.data }));
    }
    return res.data;
  },

  /**
   * ✅ COMMAND execution
   */
  async commandDevice(deviceId: string, command: Record<string, any>, options: { idempotencyKey?: string; tapSequence?: number; clientTapTimestamp?: number } = {}) {
    const res = await API.post(
      `/devices/${encodeURIComponent(deviceId)}/command`,
      {
        command,
        ...(options.idempotencyKey ? { idempotency_key: options.idempotencyKey } : {}),
        ...(options.tapSequence != null ? { tap_sequence: options.tapSequence } : {}),
        ...(options.clientTapTimestamp != null ? { client_tap_timestamp: options.clientTapTimestamp } : {}),
      },
      options.idempotencyKey || options.tapSequence != null ? {
        headers: {
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
          ...(options.tapSequence != null ? { "X-IR-Tap-Sequence": String(options.tapSequence) } : {}),
        },
      } : undefined,
    );
    return res.data as { ok?: boolean; status?: string; error?: string; details?: string; state?: Record<string, any> };
  },

  async getIrProfiles(deviceId: string) {
    const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/ir/profiles`);
    return res.data as { hub_id?: string; available_profiles?: IrProfileOption[]; appliances?: any[] };
  },

  async createIrAppliance(deviceId: string, payload: { profile: string; label?: string; brand?: string; model?: string }) {
    const res = await API.post(`/devices/${encodeURIComponent(deviceId)}/ir/appliances`, payload);
    return res.data as { ok?: boolean; appliance?: Record<string, any>; error?: string };
  },

  async getSmartAccess(deviceId: string, options: { refresh?: boolean } = {}) {
    const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/smart-access`, {
      params: options.refresh ? { refresh: true } : undefined,
    });
    return res.data as SmartAccessResponse;
  },

  async getSmartAccessRecords(deviceId: string, limit = 30) {
    const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/smart-access/records`, { params: { limit } });
    return res.data as { ok?: boolean; records?: Array<Record<string, any>> };
  },

  async createSmartAccessCredential(deviceId: string, payload: Record<string, any>) {
    const res = await API.post(`/devices/${encodeURIComponent(deviceId)}/smart-access/credentials`, payload);
    return res.data as { ok?: boolean; status?: string; credential?: Record<string, any>; error?: string };
  },
};
