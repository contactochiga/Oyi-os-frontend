import { deviceService } from "@/services/deviceService";
import type { DeviceAction } from "../types";

export type ActionResult = {
  action: DeviceAction;
  ok: boolean;
  error?: string;
};

export async function executeActions(actions: DeviceAction[] | undefined) {
  if (!actions?.length) return [] as ActionResult[];

  const out: ActionResult[] = [];

  for (const a of actions) {
    try {
      if (a.type === "device.command") {
        await deviceService.commandDevice(a.deviceId, a.command);
        out.push({ action: a, ok: true });
      }
    } catch {
      out.push({ action: a, ok: false, error: "Command failed" });
    }
  }

  return out;
}
