import {
  AirVent,
  Camera,
  Fan,
  Flame,
  Lamp,
  LockKeyhole,
  PanelTop,
  Plug,
  Radio,
  RadioReceiver,
  ShieldCheck,
  Speaker,
  Thermometer,
  ToggleLeft,
  Tv,
  Waves,
  Wind,
} from "lucide-react";

export type DeviceFamily =
  | "tv"
  | "climate"
  | "thermostat"
  | "light"
  | "lock"
  | "camera"
  | "curtain"
  | "fan"
  | "plug"
  | "switch"
  | "sensor"
  | "remote"
  | "speaker"
  | "purifier"
  | "heater"
  | "security"
  | "device";

function flatten(value: any): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (typeof value === "object") {
    return Object.entries(value)
      .flatMap(([key, entry]) => [key, flatten(entry)])
      .join(" ");
  }
  return "";
}

function textFrom(device: Record<string, any> = {}) {
  return [
    device?.type,
    device?.device_type,
    device?.category,
    device?.kind,
    device?.remote_type,
    device?.remoteType,
    device?.ir_profile,
    device?.irProfile,
    device?.product_name,
    device?.productName,
    device?.model,
    device?.name,
    device?.local_name,
    device?.alias,
    device?.vendor,
    device?.adapter,
    flatten(device?.capabilities),
    flatten(device?.metadata),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getDeviceFamily(device: Record<string, any> = {}): DeviceFamily {
  const supportedControls = [
    ...(Array.isArray(device?.supported_controls) ? device.supported_controls : []),
    ...(Array.isArray(device?.metadata?.supported_controls) ? device.metadata.supported_controls : []),
  ].map((value) => String(value || "").toLowerCase());
  const controlProfile = String(device?.control_profile || device?.metadata?.control_profile || "").toLowerCase();
  const explicitFamily = String(device?.device_family || device?.metadata?.device_family || "").toLowerCase();
  const text = textFrom(device);
  const hasPowerCapability = supportedControls.includes("power") || /\b(switch|switch_\d+|relay|power|plug)\b/.test(text);
  if (explicitFamily === "switch" || controlProfile === "switch") return "switch";
  if (explicitFamily === "plug" || controlProfile === "plug") return "plug";
  if (hasPowerCapability && ["heater", "climate", "thermostat"].includes(explicitFamily)) return "switch";
  if (hasPowerCapability && ["climate", "thermostat"].includes(controlProfile)) return "switch";
  if (explicitFamily === "climate" || controlProfile === "climate") return "climate";
  if (explicitFamily === "camera" || controlProfile === "camera") return "camera";
  if (explicitFamily === "lock" || controlProfile === "lock") return "lock";
  if (explicitFamily === "curtain" || controlProfile === "curtain") return "curtain";
  if (explicitFamily === "sensor" || controlProfile === "sensor") return "sensor";
  if (explicitFamily === "tv" || controlProfile === "tv") return "tv";
  if (explicitFamily === "ir_remote" || controlProfile === "ir_remote") return "remote";
  if (hasPowerCapability && /\b(ac|a\/c|air conditioner|aircon|hvac|climate|cooling|cooler)\b/.test(text)) return "switch";
  if (/\b(tv|television|smart tv|android tv|google tv|samsung tv|lg tv|hisense tv|tcl|tcl tv|set top|decoder)\b/.test(text)) return "tv";
  if (/\b(ir remote|smart ir|infrared remote|universal remote|remote control)\b/.test(text)) return "remote";
  if (/\b(media|screen|projector)\b/.test(text)) return "tv";
  if (/\b(thermostat)\b/.test(text)) return "thermostat";
  if (/\b(ac|a\/c|air conditioner|aircon|hvac|climate|cooling|cooler)\b/.test(text)) return "climate";
  if (/\b(air purifier|purifier|air quality)\b/.test(text)) return "purifier";
  if (!hasPowerCapability && /\b(heater|heat)\b/.test(text)) return "heater";
  if (/\b(fan|ceiling fan|standing fan)\b/.test(text)) return "fan";
  if (/\b(light|bulb|lamp|lighting|downlight|spotlight)\b/.test(text)) return "light";
  if (/\b(door lock|smart lock|lock|gate|access control|door)\b/.test(text)) return "lock";
  if (/\b(camera|cctv|nvr|dvr|onvif|rtsp|ip cam|snapshot)\b/.test(text)) return "camera";
  if (/\b(curtain|blind|shade|drape)\b/.test(text)) return "curtain";
  if (/\b(socket|plug|outlet|wall socket)\b/.test(text)) return "plug";
  if (/\b(switch|relay|gang|breaker)\b/.test(text)) return "switch";
  if (/\b(sensor|motion|contact|pir|smoke|leak|temperature sensor|humidity|occupancy)\b/.test(text)) return "sensor";
  if (/\b(speaker|audio|sound|sonos)\b/.test(text)) return "speaker";
  if (/\b(security|alarm|siren|panic)\b/.test(text)) return "security";
  return "device";
}

export function getDeviceIcon(device: Record<string, any> = {}) {
  const family = getDeviceFamily(device);
  if (family === "tv") return Tv;
  if (family === "climate") return AirVent;
  if (family === "thermostat") return Thermometer;
  if (family === "light") return Lamp;
  if (family === "lock") return LockKeyhole;
  if (family === "camera") return Camera;
  if (family === "curtain") return PanelTop;
  if (family === "fan") return Fan;
  if (family === "plug") return Plug;
  if (family === "switch") return ToggleLeft;
  if (family === "sensor") return Radio;
  if (family === "remote") return RadioReceiver;
  if (family === "speaker") return Speaker;
  if (family === "purifier") return Wind;
  if (family === "heater") return Flame;
  if (family === "security") return ShieldCheck;
  return Waves;
}

export function getDeviceIconTone(device: Record<string, any> = {}) {
  const family = getDeviceFamily(device);
  if (["climate", "thermostat", "fan", "purifier"].includes(family)) return "text-sky-200 bg-sky-400/10 border-sky-300/15 shadow-[0_0_20px_rgba(56,189,248,0.14)]";
  if (["lock", "camera", "security"].includes(family)) return "text-emerald-200 bg-emerald-400/10 border-emerald-300/15 shadow-[0_0_20px_rgba(52,211,153,0.14)]";
  if (["tv", "remote", "speaker"].includes(family)) return "text-violet-200 bg-violet-400/10 border-violet-300/15 shadow-[0_0_20px_rgba(167,139,250,0.14)]";
  if (family === "curtain") return "text-purple-200 bg-purple-400/10 border-purple-300/15 shadow-[0_0_20px_rgba(192,132,252,0.14)]";
  if (family === "sensor") return "text-cyan-200 bg-cyan-400/10 border-cyan-300/15 shadow-[0_0_20px_rgba(34,211,238,0.14)]";
  if (family === "heater") return "text-orange-200 bg-orange-400/10 border-orange-300/15 shadow-[0_0_20px_rgba(251,146,60,0.14)]";
  return "text-amber-200 bg-amber-400/10 border-amber-300/15 shadow-[0_0_20px_rgba(251,191,36,0.14)]";
}

export function getDeviceIconFromText(text: string) {
  return getDeviceIcon({ name: text });
}

export function isClimateDevice(device: Record<string, any> = {}) {
  return ["climate", "thermostat", "fan", "purifier", "heater"].includes(getDeviceFamily(device));
}

export function isSimplePowerDevice(device: Record<string, any> = {}) {
  return ["light", "switch", "plug"].includes(getDeviceFamily(device));
}
