import API from "./api";
import { createCameraReadClient, type Camera, type CameraEvent, type CameraPlaybackSession } from "@/lib/oyi-camera-core/core";

export type CameraItem = Camera;
export type { CameraEvent };

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

const readClient = createCameraReadClient(API);

export const cameraService = {
  /** Consumer inventory is deliberately home-scoped; estate inventory is never a fallback. */
  async listByHome(homeId: string): Promise<CameraItem[]> {
    if (!homeId) return [];
    try {
      return await readClient.listCameras({ scope: "home", homeId });
    } catch (err) {
      console.warn("cameraService.listByHome failed", { reason: pickError(err, "camera inventory unavailable") });
      return [];
    }
  },

  async getPlayback(cameraId: string): Promise<CameraPlaybackSession> {
    try {
      return await readClient.createPlaybackSession(cameraId);
    } catch (err) {
      throw new Error(pickError(err, "Failed to load playback"));
    }
  },

  async listEvents(cameraId: string, opts?: { limit?: number; sinceMinutes?: number }): Promise<CameraEvent[]> {
    try {
      return await readClient.getCameraEvents(cameraId, opts);
    } catch (err) {
      throw new Error(pickError(err, "Failed to load camera events"));
    }
  },
};

export default cameraService;
