import API from "./api";

export type CameraItem = {
  id: string;
  estate_id?: string;
  name?: string;
  ip?: string;
  edge_hls_url?: string | null;
};

export type CameraEvent = {
  id: string;
  camera_id: string;
  event_type: string;
  confidence?: number | null;
  snapshot_url?: string | null;
  message?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const cameraService = {
  async listByEstate(estateId: string): Promise<CameraItem[]> {
    if (!estateId) return [];
    try {
      const res = await API.get(`/cameras/estate/${encodeURIComponent(estateId)}`);
      return res.data?.items ?? [];
    } catch (err) {
      console.warn("cameraService.listByEstate error:", err);
      return [];
    }
  },

  async getPlayback(cameraId: string, rewindSeconds = 0): Promise<{ type: "hls"; url: string }> {
    try {
      const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/playback`, {
        params: { rewind: Math.max(0, Math.floor(rewindSeconds || 0)) },
      });
      if (!res.data?.url) throw new Error("Playback URL not available");
      return { type: "hls", url: String(res.data.url) };
    } catch (err: any) {
      throw new Error(pickError(err, "Failed to load playback"));
    }
  },

  async listEvents(cameraId: string, opts?: { limit?: number; sinceMinutes?: number }) {
    try {
      const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/events`, {
        params: {
          limit: opts?.limit ?? 50,
          sinceMinutes: opts?.sinceMinutes ?? 24 * 60,
        },
      });
      return (res.data?.events ?? []) as CameraEvent[];
    } catch (err: any) {
      throw new Error(pickError(err, "Failed to load camera events"));
    }
  },
};

export default cameraService;

