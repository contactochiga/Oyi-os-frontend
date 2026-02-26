import { deviceService } from "@/services/deviceService";
import type { DeviceAction } from "../types";

export async function executeActions(actions: DeviceAction[] | undefined) {
  if (!actions?.length) return;

  for (const a of actions) {
    try {
      if (a.type === "device.command") {
        await deviceService.commandDevice(a.deviceId, a.command);
      }
    } catch {
      // ignore
    }
  }
}
