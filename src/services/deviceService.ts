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
  error?: string;
};

export type IrProfileOption = {
  key: string;
  label?: string;
  appliance_type?: string;
  control_profile?: string;
  device_family?: string;
  supported_controls?: string[];
  source?: string;
};

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
      const status = Number(err?.response?.status || 0);
      if (status && status < 500) return [];
      return [];
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
    } catch {
      return [];
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
    } catch {
      return [];
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
  async getDeviceState(deviceId: string): Promise<DeviceStateResponse> {
    try {
      const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/state`);

      return {
        deviceId: res.data?.deviceId,
        state: res.data?.state ?? {},
        normalized_state: res.data?.normalized_state ?? null,
        capabilities: res.data?.capabilities ?? [],
        supported_controls: res.data?.supported_controls ?? [],
        control_profile: res.data?.control_profile ?? null,
        health_status: res.data?.health_status ?? null,
        provider_health: res.data?.provider_health ?? null,
        primary_state: res.data?.primary_state ?? null,
        telemetry_summary: res.data?.telemetry_summary ?? null,
        last_signal: res.data?.last_signal ?? null,
        activity_summary: res.data?.activity_summary ?? null,
        device_family: res.data?.device_family ?? null,
        device_type: res.data?.device_type ?? null,
        lastSeen: res.data?.lastSeen ?? null,
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
  async commandDevice(deviceId: string, command: Record<string, any>) {
    const res = await API.post(`/devices/${encodeURIComponent(deviceId)}/command`, { command });
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
};
