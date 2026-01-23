import API from "./api";

export type SendDeviceCommandParams = {
  deviceId: string;

  // you can pass either command directly...
  command?: Record<string, any>;

  // ...or simple capability/value (like your AC panel)
  capability?: string;
  value?: any;

  // optional context/meta
  estateId?: string;
  homeId?: string;
  roomId?: string;
  meta?: Record<string, any>;
  source?: string; // default: consumer-ui
};

export const signalService = {
  async sendDeviceCommand(payload: SendDeviceCommandParams) {
    const { deviceId, command, capability, value, ...rest } = payload;

    // Normalize into command object (best for backend + MQTT)
    const normalizedCommand =
      command ??
      (capability ? { [capability]: value } : undefined);

    if (!normalizedCommand) {
      throw new Error("No command provided");
    }

    // Use your alias endpoint (clean + explicit)
    const res = await API.post(`/signals/device/${encodeURIComponent(deviceId)}/command`, {
      type: "device.command.requested",
      source: payload.source ?? "consumer-ui",
      command: normalizedCommand,
      ...rest,
    });

    // expected: { status: "accepted", signalType: "device.command.requested" }
    return res.data;
  },
};
