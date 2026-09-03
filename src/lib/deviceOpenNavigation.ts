import type { useRouter } from "next/navigation";
import { useDeviceOpenRequestStore } from "@/store/useDeviceOpenRequestStore";

// Canonical entry point for opening a device's real control surface from any
// page other than Devices itself (Room, Home favorites, and any future
// surface). Always routes through /devices, which owns the single
// DeviceModalRouter used for every device family (TV/AC/switch/lock/IR/
// status-only) — this keeps one physical device resolving to the same
// control surface no matter where it was opened from.
export function openCanonicalDevice(router: ReturnType<typeof useRouter>, deviceId: string) {
  const id = String(deviceId || "").trim();
  if (!id) return;
  useDeviceOpenRequestStore.getState().requestDeviceOpen(id);
  router.push(`/devices?deviceId=${encodeURIComponent(id)}`);
}
