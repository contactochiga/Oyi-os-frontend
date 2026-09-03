import API from "./api";
import { createCameraReadClient, type Camera, type CameraEvent, type CameraPlaybackSession } from "@/lib/oyi-camera-core/core";
import { createCameraMediaReadClient, type CameraMediaReference } from "@/lib/oyi-camera-core/media";
import { createCameraDetectionReadClient, type CameraDetection } from "@/lib/oyi-camera-core/detection";

export type CameraItem = Camera;
export type { CameraEvent };

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

const readClient = createCameraReadClient(API);
const mediaClient = createCameraMediaReadClient(API);
const detectionClient = createCameraDetectionReadClient(API);

export const cameraService = {
  /** Consumer inventory is deliberately home-scoped; estate inventory is never a fallback. */
  async listByHome(homeId: string): Promise<CameraItem[]> {
    if (!homeId) return [];
    try {
      return await readClient.listCameras({ scope: "home", homeId });
    } catch (err) {
      throw new Error(pickError(err, "Camera inventory is unavailable"));
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

  async listMedia(cameraId: string, limit = 6): Promise<CameraMediaReference[]> {
    try {
      const result = await mediaClient.getCameraMedia(cameraId, { limit });
      return result.items.filter((item: CameraMediaReference) => item.available);
    } catch (err) {
      console.warn("cameraService.listMedia failed", { reason: pickError(err, "camera media unavailable") });
      return [];
    }
  },

  async getMediaAccess(mediaId: string): Promise<CameraMediaReference> {
    return mediaClient.createCameraMediaAccess(mediaId);
  },

  async listDetections(cameraId: string, limit = 12): Promise<CameraDetection[]> {
    try {
      const result = await detectionClient.getCameraDetections(cameraId, { limit });
      return result.items;
    } catch (err) {
      console.warn("cameraService.listDetections failed", { reason: pickError(err, "camera detections unavailable") });
      return [];
    }
  },
};

export default cameraService;
