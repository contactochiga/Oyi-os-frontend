import { deviceService } from "@/services/deviceService";
import visitorService from "@/services/visitorService";
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
        continue;
      }

      if (a.type === "visitor.create") {
        const name = String(a.payload?.name || "").trim();
        const phone = String(a.payload?.phone || "").trim();
        if (!name || !phone) {
          out.push({ action: a, ok: false, error: "Visitor name or phone missing" });
          continue;
        }
        const res: any = await visitorService.create({
          name,
          phone,
          purpose: a.payload?.purpose,
          expires_hours: a.payload?.expires_hours,
          navigation_mode: a.payload?.navigation_mode,
        });
        if (res?.error) {
          out.push({ action: a, ok: false, error: String(res.error) });
          continue;
        }
        out.push({ action: a, ok: true });
      }
    } catch {
      out.push({ action: a, ok: false, error: "Command failed" });
    }
  }

  return out;
}
