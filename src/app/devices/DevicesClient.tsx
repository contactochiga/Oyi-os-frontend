"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Fan,
  Flame,
  Home,
  Mic,
  Minus,
  Moon,
  Play,
  Power,
  Plus,
  Search,
  SlidersHorizontal,
  Snowflake,
  Square,
  Star,
  Thermometer,
  VolumeX,
  Wind,
  X,
} from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import BottomNav from "@/app/components/BottomNav";
import OyiComposerRow from "@/app/components/OyiComposerRow";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { deviceService, type IrProfileOption } from "@/services/deviceService";
import { aiService } from "@/services/aiService";
import { loadOyiCoreExecutionHistory } from "@/services/oyiCoreRuntimeService";
import { oyiService } from "@/services/oyiService";
import { sceneService } from "@/services/sceneService";
import { getSocket } from "@/services/socket";
import { useRuntimeIntelligenceStore } from "@/store/useRuntimeIntelligenceStore";
import { useActiveIntelligenceContextStore } from "@/store/useActiveIntelligenceContextStore";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";
import DoorPanel from "@/app/components/remotes/DoorPanel";
import { getDeviceFamily, getDeviceIcon, getDeviceIconTone, isSimplePowerDevice } from "@/lib/devicePresentation";
import {
  activitySummary as runtimeActivitySummary,
  controlProfileLabel,
  deviceFamilyLabel,
  displayPrimaryState,
  healthLabel,
  normalizeRuntimeContract,
  onlineState,
  simplePowerState,
  type DeviceRuntimeContract,
} from "@/lib/deviceRuntimeContract";
import { mergeDeviceRuntimePatch, readConfirmedSwitchChannel } from "@/lib/deviceControlReconciliation";
import { scopeMatches } from "@/lib/footerBadges";

type AnyDevice = Record<string, any>;
type DiscoveryDevice = Record<string, any>;
type AddDeviceTab = "nearby" | "provider" | "manual";
type CategoryKey = "all" | "lights" | "climate" | "security" | "entertainment" | "sensors";
type DeviceTool = "timer" | "schedule" | "settings" | "activity";
type IrProfile = "tv" | "ac" | "fan" | "projector";
type SwitchCommandStatus = "idle" | "queued" | "dispatching" | "awaiting_confirmation" | "confirmed" | "failed" | "mismatch" | "timed_out" | "uncertain" | "pending" | "timeout";
type DrawerConversationTarget = {
  object_type: "device" | "device_channel";
  canonical_id: string;
  parent_device_id: string | null;
  channel_code: string | null;
  label: string;
  room_id: string | null;
  context_id: string;
  context_version: number;
};
type SwitchChannelCommandState = {
  confirmed_state: boolean | null;
  pending_expected_state: boolean | string | number | null;
  latest_desired_state: boolean | string | number | null;
  desired_state: boolean;
  active_command_execution_id: string | null;
  command_status: SwitchCommandStatus;
  provider_status: "not_started" | "pending" | "accepted" | "rejected" | "unavailable";
  command_execution_id: string | null;
  command_key: string;
  command_code: string;
  tap_sequence: number;
  client_tap_timestamp: number;
  pending_started_at: string | null;
  last_confirmed_at: string | null;
  last_error?: { classification: string; message: string; retryable: boolean } | null;
  error?: string | null;
};

function switchStateKey(deviceId: string, commandCode: string) {
  return `${deviceId}:${commandCode}`;
}

const CATEGORIES: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "lights", label: "Lights" },
  { key: "climate", label: "Climate" },
  { key: "security", label: "Security" },
  { key: "entertainment", label: "Entertainment" },
  { key: "sensors", label: "Sensors" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function deviceListMessage(error: any) {
  const code = String(error?.code || "");
  if (code === "context_unavailable") return "Your home context could not be loaded.";
  if (code === "forbidden") return "This account does not have access to these devices.";
  if (code === "backend_unavailable") return "Devices are temporarily unavailable. Try again.";
  if (code === "not_authenticated") return "Please sign in again to load your devices.";
  return error?.message || "Failed to load devices";
}

function pickDbId(d: AnyDevice) {
  return d?.id || d?.device_id || null;
}

function pickExternalId(d: AnyDevice) {
  return d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.devId || d?.uuid || null;
}

function idsForDevice(d: AnyDevice) {
  return [pickDbId(d), pickExternalId(d), d?.device_id, d?.dev_id, d?.devId, d?.uuid]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function pickName(d: AnyDevice) {
  return d?.name || d?.product_name || d?.productName || d?.model || d?.local_name || d?.localName || d?.alias || "Unnamed Device";
}

function pickRoomName(d: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null) {
  const presentation = runtime?.canonical_presentation || runtime?.presentation || null;
  return presentation?.assignment?.roomName || d?.room_name || d?.room?.name || d?.metadata?.room_name || d?.metadata?.room || null;
}

function pickRoomKey(d: AnyDevice) {
  return String(d?.room_id || d?.room?.id || pickRoomName(d) || "unassigned").toLowerCase();
}

function pickRoomId(d: AnyDevice) {
  return d?.room_id || d?.room?.id || null;
}

function pickDiscoveryExternalId(d: DiscoveryDevice) {
  return d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.uuid || null;
}

function isOnline(d: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null): boolean | null {
  const direct = onlineState(d, runtime);
  if (direct !== null) return direct;
  if (typeof d?.online === "boolean") return d.online;
  if (typeof d?.isOnline === "boolean") return d.isOnline;
  if (typeof d?.connected === "boolean") return d.connected;
  if (typeof d?.status === "string") {
    const s = d.status.toLowerCase();
    if (s.includes("online") || s.includes("active")) return true;
    if (s.includes("offline") || s.includes("lost") || s.includes("unavailable") || s.includes("disabled")) return false;
  }
  return null;
}

function inferFamily(d: AnyDevice) {
  return getDeviceFamily(d);
}

function categoryFor(device: AnyDevice): CategoryKey {
  const family = inferFamily(device);
  if (["light", "switch", "plug"].includes(family)) return "lights";
  if (["climate", "thermostat", "fan", "curtain", "purifier", "heater"].includes(family)) return "climate";
  if (["camera", "lock", "security"].includes(family)) return "security";
  if (["tv", "remote", "speaker"].includes(family)) return "entertainment";
  if (family === "sensor") return "sensors";
  return "all";
}

function deviceIcon(device: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null) {
  return getDeviceIcon({ ...device, ...(runtime || {}) });
}

function iconTone(device: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null) {
  return getDeviceIconTone(device, runtime);
}

function guessGangCount(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null): 1 | 2 | 3 {
  const normalized = normalizeRuntimeContract(device, runtime).normalized_state || {};
  const switchKeys = Object.keys((normalized as any)?.switches || {});
  if (switchKeys.includes("switch_3")) return 3;
  if (switchKeys.includes("switch_2")) return 2;
  const raw = (device?.metadata?.raw ?? device?.metadata ?? device?.meta ?? {}) as any;
  const rawKeys = Object.keys(raw || {});
  const has2 = rawKeys.some((k) => k === "switch_2" || k === "switch_2_code");
  const has3 = rawKeys.some((k) => k === "switch_3" || k === "switch_3_code");
  if (has3) return 3;
  if (has2) return 2;
  const keys = Object.keys(state || {});
  if (keys.includes("switch_3")) return 3;
  if (keys.includes("switch_2")) return 2;
  const dps = state?.dps || state?.raw?.dps;
  if (dps && typeof dps === "object") {
    const dpKeys = Object.keys(dps);
    if (dpKeys.some((k) => String(k).includes("switch_3"))) return 3;
    if (dpKeys.some((k) => String(k).includes("switch_2"))) return 2;
  }
  return 1;
}

function readGangValues(gangCount: 1 | 2 | 3, state: any, runtime?: Partial<DeviceRuntimeContract> | null): Array<boolean | null> {
  const out: Array<boolean | null> = [];
  for (let i = 1; i <= gangCount; i += 1) {
    const k = `switch_${i}`;
    out.push(readConfirmedSwitchChannel(k, state, runtime));
  }
  if (gangCount === 1 && out[0] === null) {
    const normalized = state?.normalized_state && typeof state.normalized_state === "object" ? state.normalized_state : {};
    const v = state?.switch ?? state?.power ?? state?.on ?? (normalized as any)?.power ?? readConfirmedSwitchChannel("switch", state, runtime);
    if (typeof v === "boolean") out[0] = v;
  }
  return out;
}

function switchCommandCodes(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, runtime);
  const channels = Array.isArray(contract.channel_definitions) ? contract.channel_definitions : [];
  const channelCodes = channels
    .filter((channel: any) => channel?.controllable !== false && channel?.code)
    .map((channel: any) => String(channel.code));
  if (channelCodes.length) return channelCodes.slice(0, 3);
  const codes = [
    ...(Array.isArray(contract.capability_codes) ? contract.capability_codes : []),
    ...(Array.isArray(contract.supported_controls) ? contract.supported_controls : []),
    ...(Array.isArray(device?.capability_codes) ? device.capability_codes : []),
    ...(Array.isArray(device?.supported_controls) ? device.supported_controls : []),
    ...Object.keys(state || {}),
  ].map((code) => String(code));
  return Array.from(new Set(codes.filter((code) => code === "switch" || code === "power" || /^switch_\d+$/i.test(code)))).slice(0, 3);
}

function normalizeCommandKey(device: AnyDevice, state: any, runtime: Partial<DeviceRuntimeContract> | null | undefined, gangIndex: number) {
  const codes = switchCommandCodes(device, state, runtime);
  if (codes[gangIndex]) return codes[gangIndex];
  return gangIndex === 0 ? "switch" : `switch_${gangIndex + 1}`;
}

function readPowerState(state: any, runtime?: Partial<DeviceRuntimeContract> | null): boolean | null {
  return simplePowerState({}, { ...(runtime || {}), state });
}

function readTemperature(state: any, runtime?: Partial<DeviceRuntimeContract> | null): string | null {
  const normalized = normalizeRuntimeContract({}, runtime).normalized_state || {};
  const raw = (normalized as any)?.temperature ?? state?.temp_current ?? state?.temperature ?? state?.temp ?? state?.current_temperature;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const c = n > 80 ? Math.round(n / 10) : Math.round(n);
  return `${c}°C`;
}

function readLockState(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null): string | null {
  const family = inferFamily(device);
  if (family !== "lock") return null;
  const normalized = normalizeRuntimeContract(device, runtime).normalized_state || {};
  const raw = String((normalized as any)?.lock_state ?? state?.lock_state ?? state?.door_state ?? state?.status ?? "").toLowerCase();
  if (raw.includes("unlock") || raw === "open") return "Unlocked";
  if (raw.includes("lock") || raw === "closed") return "Locked";
  return null;
}

function displayState(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, { ...(runtime || {}), state });
  const presentation = contract.canonical_presentation || contract.presentation || null;
  if (presentation?.primaryState?.label) return presentation.primaryState.label;
  const canonical = contract.canonical_state;
  if (canonical?.availability === "offline") return "Offline";
  if (canonical?.availability === "provider_disconnected") return "Provider disconnected";
  if (canonical?.availability === "setup_incomplete") return "Setup incomplete";
  if (canonical?.availability === "stale") return canonical.primaryState?.label ? `${canonical.primaryState.label} · stale` : "Stale";
  if (canonical?.primaryState?.label) return canonical.primaryState.label;
  const primary = displayPrimaryState(device, contract);
  if (primary && primary !== "Awaiting sync") return primary;
  const lock = readLockState(device, state, runtime);
  if (lock) return lock;
  const temp = readTemperature(state, runtime);
  if (temp) return temp;
  const family = inferFamily(device);
  if (family === "curtain") {
    const open = state?.open ?? state?.curtain_open ?? state?.position;
    if (typeof open === "boolean") return open ? "Open" : "Closed";
    if (typeof open === "number") return open > 0 ? "Open" : "Closed";
  }
  const power = readPowerState(state, runtime);
  if (power !== null) return power ? "On" : "Off";
  const online = isOnline(device, runtime);
  if (online === false) return "Offline";
  if (online === true) return "Online";
  return "Awaiting sync";
}

function isSimpleControlDevice(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null) {
  const gangCount = guessGangCount(device, state, runtime);
  return gangCount === 1 && canSwitchDevice(device, runtime);
}

function isFavoriteDevice(device: AnyDevice) {
  const meta = device?.metadata || {};
  return Boolean(device?.favorite || device?.is_favorite || device?.pinned || meta?.favorite || meta?.is_favorite || meta?.pinned);
}

function friendlyStateRows(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, { ...(runtime || {}), state });
  const canonical = contract.canonical_state;
  const online = isOnline(device, contract);
  const power = readPowerState(state, contract);
  const rows = [
    { label: "State", value: displayState(device, state, contract) },
    { label: "Health", value: healthLabel(contract.health_status, "Unknown") },
    { label: "Connection", value: canonical?.availability ? canonical.availability.replace(/_/g, " ") : online === null ? "Unknown" : online ? "Online" : "Offline" },
    { label: "Room", value: pickRoomName(device, contract) || "Unassigned" },
    { label: "Device type", value: deviceFamilyLabel(contract.device_family || inferFamily(device), "Device") },
    { label: "Control profile", value: controlProfileLabel(contract.control_profile, "Standard") },
  ];
  if (power !== null && rows[0].value !== (power ? "On" : "Off")) rows.push({ label: "Power", value: power ? "On" : "Off" });
  const lastSeen = canonical?.lastSeenAt || state?.last_seen || state?.lastSeen || device?.last_seen || device?.lastSeen || device?.updated_at;
  if (lastSeen) rows.push({ label: "Last active", value: new Date(lastSeen).toLocaleString() });
  if (canonical?.batteryPercentage != null) rows.push({ label: "Battery", value: `${Math.round(Number(canonical.batteryPercentage))}% · ${canonical.batteryLevel || "unknown"}` });
  const caps = uiCapabilities(device, contract);
  const supported = [
    caps.canSwitch && "Power",
    caps.timer && "Timer",
    caps.schedule && "Schedule",
    caps.cycle && "Cycle",
    caps.inching && "Inching",
    caps.tv.length ? "TV remote" : null,
    caps.ac.length ? "AC remote" : null,
  ].filter(Boolean);
  if (supported.length) rows.push({ label: "Supported controls", value: supported.join(", ") });
  const summary = runtimeActivitySummary(device, contract, "");
  if (summary) rows.push({ label: "Recent activity", value: summary });
  return rows;
}

function attentionReason(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, { ...(runtime || {}), state });
  const alert = contract.canonical_state?.alerts?.find((item: { severity?: string }) => item.severity === "critical") || contract.canonical_state?.alerts?.[0];
  if (alert?.message) return alert.message;
  if (isOnline(device, contract) === false) return "Connection lost";
  const battery = Number(contract.canonical_state?.batteryPercentage ?? state?.battery ?? state?.battery_percentage ?? device?.battery);
  if (Number.isFinite(battery) && battery > 0 && battery <= 20) return "Battery low";
  const status = String(runtime?.health_status || device?.status || state?.status || "").toLowerCase();
  if (status.includes("firmware")) return "Firmware update available";
  if (status.includes("error") || status.includes("fault")) return "Attention needed";
  return null;
}

function providerLabel(device: AnyDevice) {
  const provider = String(device?.provider || device?.vendor || device?.adapter || "device").toLowerCase();
  if (provider === "tuya") return "Tuya / Smart Life";
  if (provider === "ssdp") return "Local network";
  if (provider === "onvif") return "ONVIF";
  return provider.replace(/_/g, " ");
}

function suggestedRoom(device: AnyDevice) {
  return device?.metadata?.provider_room_name || device?.metadata?.room_name || device?.metadata?.room || device?.metadata?.tuya?.room_name || null;
}

function friendlyCapabilities(device: AnyDevice) {
  const raw = Array.isArray(device?.capabilities) ? device.capabilities : [];
  const labels = raw
    .map((capability: any) => String(capability?.name || capability?.label || capability?.code || capability || "").toLowerCase())
    .map((capability: string) => {
      if (/switch|power|on_off/.test(capability)) return "Power";
      if (/bright|dimmer/.test(capability)) return "Brightness";
      if (/temp|climate|thermostat/.test(capability)) return "Temperature";
      if (/colour|color|hue|saturation/.test(capability)) return "Color";
      if (/curtain|blind|position/.test(capability)) return "Position";
      if (/lock|unlock/.test(capability)) return "Lock";
      return null;
    })
    .filter(Boolean) as string[];
  return Array.from(new Set(labels)).slice(0, 6);
}

function uiCapabilities(device: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, runtime);
  const ui = device?.ui_capabilities && typeof device.ui_capabilities === "object" ? device.ui_capabilities : {};
  const supported = Array.isArray(ui.supported_commands) ? ui.supported_commands.map((item: any) => String(item).toLowerCase()) : [];
  const runtimeSupported = Array.isArray(contract.supported_controls) ? contract.supported_controls.map((item) => String(item).toLowerCase()) : [];
  return {
    canSwitch: Boolean(ui.can_switch || supported.includes("switch") || runtimeSupported.includes("power") || contract.control_profile === "switch" || contract.control_profile === "plug" || friendlyCapabilities(device).includes("Power")),
    timer: Boolean(ui.timer || supported.includes("timer") || runtimeSupported.includes("timer")),
    schedule: Boolean(ui.schedule || supported.includes("schedule") || runtimeSupported.includes("schedule")),
    cycle: Boolean(ui.cycle || supported.includes("cycle")),
    inching: Boolean(ui.inching || supported.includes("inching")),
    tv: Array.isArray(ui?.remote?.tv) ? ui.remote.tv.map((item: any) => String(item).toLowerCase()) : [],
    ac: Array.isArray(ui?.remote?.ac) ? ui.remote.ac.map((item: any) => String(item).toLowerCase()) : [],
  };
}

type IrRemoteButton = {
  canonical: string;
  label: string;
  providerKey: string;
  keyId?: string | number | null;
  keyName?: string | null;
};

function normalizeIrKey(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
}

function canonicalTvKey(definition: any) {
  const normalized = [
    definition?.key_name,
    definition?.key,
    definition?.key_code,
    definition?.code,
    definition?.value,
  ].map(normalizeIrKey).filter(Boolean);
  if (normalized.some((key) => key === "power" || key === "power_toggle")) return "power";
  if (normalized.some((key) => key === "ok" || key === "enter" || key === "select")) return "ok";
  if (normalized.some((key) => key === "navigate_up" || key === "nav_up" || key === "up")) return "up";
  if (normalized.some((key) => key === "navigate_down" || key === "nav_down" || key === "down")) return "down";
  if (normalized.some((key) => key === "navigate_left" || key === "nav_left" || key === "left")) return "left";
  if (normalized.some((key) => key === "navigate_right" || key === "nav_right" || key === "right")) return "right";
  if (normalized.some((key) => key === "volume_up" || key === "vol_up" || key === "volume+")) return "volume_up";
  if (normalized.some((key) => key === "volume_down" || key === "vol_down" || key === "volume_")) return "volume_down";
  if (normalized.some((key) => key === "channel_up" || key === "ch_up" || key === "channel+")) return "channel_up";
  if (normalized.some((key) => key === "channel_down" || key === "ch_down" || key === "channel_")) return "channel_down";
  if (normalized.some((key) => key === "mute")) return "mute";
  if (normalized.some((key) => key === "input" || key === "source")) return "source";
  if (normalized.some((key) => key === "back" || key === "return")) return "back";
  if (normalized.some((key) => key === "homepage" || key === "home")) return "home";
  if (normalized.some((key) => key === "menu")) return "menu";
  return normalized[0] || "";
}

function tvRemoteButtonMap(device: AnyDevice) {
  const supportedKeys = Array.isArray(device?.metadata?.ir_appliance?.supported_keys)
    ? device.metadata.ir_appliance.supported_keys
    : [];
  const map = new Map<string, IrRemoteButton>();
  for (const definition of supportedKeys) {
    const canonical = canonicalTvKey(definition);
    const providerKey = String(definition?.key || definition?.key_code || definition?.code || definition?.value || "").trim();
    if (!canonical || !providerKey || map.has(canonical)) continue;
    map.set(canonical, {
      canonical,
      label: String(definition?.key_name || definition?.key || canonical).trim(),
      providerKey,
      keyId: definition?.key_id ?? definition?.id ?? null,
      keyName: definition?.key_name || null,
    });
  }
  return map;
}

function canSwitchDevice(device: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null) {
  const caps = uiCapabilities(device, runtime);
  return caps.canSwitch && isSimplePowerDevice(device);
}

function collectDeviceCodes(value: any, out = new Set<string>(), depth = 0): Set<string> {
  if (!value || depth > 4) return out;
  if (typeof value === "string") {
    out.add(value.toLowerCase());
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectDeviceCodes(item, out, depth + 1));
    return out;
  }
  if (typeof value === "object") {
    ["code", "name", "label", "id"].forEach((key) => {
      if (typeof value[key] === "string") out.add(String(value[key]).toLowerCase());
    });
    Object.entries(value).forEach(([key, nested]) => {
      if (/^[a-z0-9_:-]{2,}$/i.test(key)) out.add(key.toLowerCase());
      collectDeviceCodes(nested, out, depth + 1);
    });
  }
  return out;
}

function commandCodeFor(device: AnyDevice, patterns: RegExp[]) {
  const candidates = Array.from(collectDeviceCodes([
    device?.capabilities,
    device?.metadata?.raw?.functions,
    device?.metadata?.raw?.status,
    device?.metadata?.tuya?.functions,
    device?.metadata?.tuya?.status,
    device?.metadata?.functions,
    device?.metadata?.status,
  ]));
  return candidates.find((code) => patterns.some((pattern) => pattern.test(code))) || null;
}

type DeviceRendererKind = "switch" | "socket" | "tv" | "ac" | "ir" | "lock" | "unsupported";

function learnedIrTemplate(device: AnyDevice): IrProfile | null {
  const raw = `${device?.remote_type || ""} ${device?.remoteType || ""} ${device?.ir_profile || ""} ${device?.irProfile || ""} ${device?.device_type || ""} ${device?.product_name || ""} ${device?.productName || ""} ${device?.model || ""} ${device?.metadata?.remote_type || ""} ${device?.metadata?.remoteType || ""} ${device?.metadata?.ir_profile || ""} ${device?.metadata?.irProfile || ""} ${device?.metadata?.ir_template || ""} ${device?.metadata?.remote_template || ""} ${device?.metadata?.profile || ""} ${device?.metadata?.category || ""} ${device?.category || ""} ${device?.type || ""} ${device?.name || ""}`.toLowerCase();
  if (/projector/.test(raw)) return "projector";
  if (/(^| )(fan|ceiling fan)( |$)/.test(raw)) return "fan";
  if (/(air|ac|aircon|hvac|climate)/.test(raw)) return "ac";
  if (/(tv|television|decoder|set.top|android tv|google tv|samsung tv|lg tv|hisense tv|tcl tv|smart tv)/.test(raw)) return "tv";
  return null;
}

function deviceRendererKind(device: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null): DeviceRendererKind {
  const contract = normalizeRuntimeContract(device, runtime);
  const family = String(contract.control_profile || contract.device_family || inferFamily(device)).toLowerCase();
  const profile = learnedIrTemplate(device);
  const text = `${device?.remote_type || ""} ${device?.remoteType || ""} ${device?.ir_profile || ""} ${device?.device_type || ""} ${device?.product_name || ""} ${device?.productName || ""} ${device?.model || ""} ${device?.category || ""} ${device?.type || ""} ${device?.name || ""} ${device?.metadata?.category || ""} ${device?.metadata?.remoteType || ""} ${device?.metadata?.ir_profile || ""}`.toLowerCase();
  if (family === "lock" || /\b(jtmspro|door lock|smart lock|lock|front door|door)\b/.test(text)) return "lock";
  if (["switch", "plug", "light"].includes(family)) return family === "plug" ? "socket" : "switch";
  if (["tv", "television", "projector", "set_top_box", "speaker"].includes(family) || /\btv\b|television|decoder|set.top/.test(text)) return "tv";
  if ((["climate", "air_conditioner", "thermostat"].includes(family)) && !canSwitchDevice(device, runtime)) return "ac";
  if (!canSwitchDevice(device, runtime) && /\bac\b|aircon|air.condition|hvac|climate/.test(text)) return "ac";
  if (profile === "tv") return "tv";
  if (profile === "ac") return "ac";
  if (family === "remote" || /ir|infrared|remote/.test(text)) return "ir";
  if (family === "plug" || /socket|plug|outlet/.test(text)) return "socket";
  if (family === "light" || family === "switch" || /light|switch|relay|gang/.test(text)) return "switch";
  return "unsupported";
}

function relativeTimeLabel(value?: string | number | null) {
  if (!value) return "Just now";
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.round(diff / 60000);
  if (minutes <= 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function runtimeLastUpdatedAt(runtime?: Partial<DeviceRuntimeContract> | null) {
  const presentation = runtime?.canonical_presentation || runtime?.presentation || null;
  const canonical = runtime?.canonical_state || runtime?.canonicalState || null;
  const candidates = [
    presentation?.lastConfirmedStateAt,
    presentation?.lastCheckedAt,
    presentation?.lastSeenAt,
    canonical?.lastProviderSyncAt,
    canonical?.lastSeenAt,
    runtime?.lastSeen,
    (runtime as any)?.last_refresh,
    (runtime as any)?.updated_at,
  ];
  for (const value of candidates) {
    const timestamp = value ? new Date(value as any).getTime() : NaN;
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function telemetryContextLine(device: AnyDevice, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, runtime);
  const summary = runtimeActivitySummary(device, runtime, "");
  if (summary) return summary;
  const lastSeen = contract.lastSeen ? relativeTimeLabel(contract.lastSeen) : null;
  return lastSeen ? `Last activity ${lastSeen}.` : `${pickName(device)} is ready.`;
}

function deriveAwarenessMessage(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeContract> | null, awareness?: Record<string, any> | null, recommendation?: Record<string, any> | null) {
  const title = displayState(device, state, runtime);
  const summary = runtimeActivitySummary(device, runtime, `${pickName(device)} is ready.`);
  const rec = String(recommendation?.title || recommendation?.headline || recommendation?.summary || "").trim();
  return {
    headline: String(awareness?.headline || `${pickName(device)} • ${title}`).trim(),
    body: String(awareness?.summary || awareness?.body || summary).trim(),
    support: rec || telemetryContextLine(device, runtime),
  };
}

function naturalLabel(value: any, fallback = "Activity update") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .replace(/_/g, " ")
    .replace(/\bconsumer app\b/gi, "from your phone")
    .replace(/\bfacility app\b/gi, "from facility")
    .replace(/\bprovider\b/gi, "provider")
    .replace(/\btuya\b/gi, "connected device provider")
    .replace(/\btelemetry\b/gi, "device update")
    .replace(/\bcommand failed\b/gi, "did not respond")
    .replace(/\bmanual control\b/gi, "manual control")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDeviceTimelineEntries(device: AnyDevice, executionHistory: Array<Record<string, any>>, runtime?: Partial<DeviceRuntimeContract> | null) {
  const rows = executionHistory
    .map((entry, index) => {
      const status = String(entry?.status || entry?.result?.status || "").toLowerCase();
      const action = String(
        entry?.result?.summary ||
        entry?.executionSummary ||
        entry?.action ||
        entry?.summary ||
        entry?.title ||
        entry?.message ||
        entry?.event_type ||
        ""
      ).trim();
      const actor = String(entry?.initiatorType || entry?.origin || entry?.source || "").trim();
      const title = naturalLabel(action, runtimeActivitySummary(device, runtime, "Device activity"));
      const subtitle = actor ? naturalLabel(actor, "") : "";
      const occurredAt = entry?.completedAt || entry?.requestedAt || entry?.created_at || entry?.occurred_at || entry?.timestamp || null;
      return {
        id: String(entry?.executionId || entry?.id || `${pickDbId(device) || "device"}-${index}`),
        title,
        subtitle,
        time: relativeTimeLabel(occurredAt),
        tone: status.includes("fail") ? "failed" : status.includes("offline") ? "attention" : "normal",
      };
    })
    .filter((entry) => entry.title);

  if (rows.length) return rows.slice(0, 6);

  return [
    {
      id: "default-activity",
      title: naturalLabel(runtimeActivitySummary(device, runtime, `${pickName(device)} is operating normally.`)),
      subtitle: "",
      time: relativeTimeLabel(normalizeRuntimeContract(device, runtime).lastSeen),
      tone: "normal" as const,
    },
  ];
}

function ComposerWaveform({ active, levels }: { active: boolean; levels?: number[] }) {
  const bars = levels?.length ? levels : Array.from({ length: 18 }).map((_, index) => 0.18 + (((index * 5) % 18) / 24));
  return (
    <div className="flex h-7 items-center gap-[3px] overflow-hidden" aria-hidden="true">
      {bars.slice(-18).map((level, index) => (
        <span
          key={index}
          className="w-[2px] rounded-full bg-sky-200/80 shadow-[0_0_8px_rgba(56,189,248,0.32)]"
          style={{
            height: `${Math.max(5, Math.min(18, 4 + level * 20))}px`,
            opacity: active ? 0.82 : 0.32,
            transition: "height 90ms ease, opacity 120ms ease",
          }}
        />
      ))}
    </div>
  );
}

function splitConversationResponse(value: string, fallbackHeadline: string, fallbackBody: string) {
  const text = String(value || "").trim();
  if (!text) return { headline: fallbackHeadline, body: fallbackBody };
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length === 1) return { headline: parts[0], body: fallbackBody };
  return {
    headline: parts[0],
    body: parts.slice(1).join(" "),
  };
}

function threadMatchesDevice(thread: Record<string, any> | null | undefined, device: AnyDevice) {
  const metadata = thread?.metadata && typeof thread.metadata === "object" ? thread.metadata : {};
  const objectId = String((metadata as any)?.object_id || (metadata as any)?.device_id || "").trim();
  const deviceId = String(pickDbId(device) || "").trim();
  return thread?.module === "device_drawer" && objectId && deviceId && objectId === deviceId;
}

function messageLinesFromThread(messages: Array<Record<string, any>> = []): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      role: (message.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: String(message.content || "").trim(),
    }))
    .filter((message) => message.content);
}

export default function DeviceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useAuth();
  const activeContext = useActiveContext();
  const estateId = useMemo(() => activeContext.estate_id || null, [activeContext.estate_id]);
  const homeId = useMemo(() => activeContext.home_id || null, [activeContext.home_id]);
  const contextReady = activeContext.ready;

  const [items, setItems] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [stateMap, setStateMap] = useState<Record<string, any>>({});
  const [runtimeMap, setRuntimeMap] = useState<Record<string, DeviceRuntimeContract>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDevice, setSheetDevice] = useState<AnyDevice | null>(null);
  const [stateOpen, setStateOpen] = useState(false);
  const [stateTitle, setStateTitle] = useState("Device");
  const [stateMeta, setStateMeta] = useState<{ rows?: Array<{ label: string; value: string }> } | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [statePanelDeviceId, setStatePanelDeviceId] = useState<string | null>(null);
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [addDeviceTab, setAddDeviceTab] = useState<AddDeviceTab>("nearby");
  const [discovering, setDiscovering] = useState(false);
  const [binding, setBinding] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveryDevice[]>([]);
  const [selectedDiscover, setSelectedDiscover] = useState<Record<string, boolean>>({});
  const [bindRoom, setBindRoom] = useState("");
  const [assignDevice, setAssignDevice] = useState<AnyDevice | null>(null);
  const [assignRoom, setAssignRoom] = useState("");
  const [editingFavorites, setEditingFavorites] = useState(false);
  const [tool, setTool] = useState<{ kind: DeviceTool; device: AnyDevice } | null>(null);
  const [deviceExecutions, setDeviceExecutions] = useState<Array<Record<string, any>>>([]);
  const irTapSequenceRef = useRef(0);
  const switchTapSequenceRef = useRef<Record<string, number>>({});
  const switchTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const commandPollersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [switchCommands, setSwitchCommands] = useState<Record<string, SwitchChannelCommandState>>({});
  const latestAwareness = useRuntimeIntelligenceStore((state) => state.latestAwareness);
  const latestRecommendations = useRuntimeIntelligenceStore((state) => state.latestRecommendations);

  function nextSwitchTapSequence(deviceId: string, commandCode: string) {
    const key = switchStateKey(deviceId, commandCode);
    const next = (switchTapSequenceRef.current[key] || 0) + 1;
    switchTapSequenceRef.current[key] = next;
    return next;
  }

  function clearSwitchTimeout(key: string) {
    if (switchTimeoutsRef.current[key]) clearTimeout(switchTimeoutsRef.current[key]);
    delete switchTimeoutsRef.current[key];
  }

  const clearCommandPoll = useCallback((commandExecutionId: string | null | undefined) => {
    const key = String(commandExecutionId || "");
    if (!key) return;
    if (commandPollersRef.current[key]) clearTimeout(commandPollersRef.current[key]);
    delete commandPollersRef.current[key];
  }, []);

  const clearAllCommandPolls = useCallback(() => {
    Object.keys(commandPollersRef.current).forEach((key) => clearCommandPoll(key));
  }, [clearCommandPoll]);

  function isTerminalExecutionStatus(status: string) {
    return ["state_confirmed", "provider_rejected", "state_mismatch", "confirmation_timed_out", "failed", "cancelled"].includes(status);
  }

  function scheduleSwitchTimeout(key: string, label: string) {
    clearSwitchTimeout(key);
    switchTimeoutsRef.current[key] = setTimeout(() => {
      setSwitchCommands((current) => {
        const pending = current[key];
        if (!pending || !["queued", "dispatching", "awaiting_confirmation", "pending"].includes(pending.command_status)) return current;
        return {
          ...current,
          [key]: {
            ...pending,
            command_status: "timed_out",
            provider_status: pending.provider_status || "pending",
            last_error: { classification: "confirmation_timed_out", message: `${label} did not confirm in time.`, retryable: true },
            error: `${label} did not confirm in time.`,
          },
        };
      });
    }, 12_000);
  }

  function channelValueFromState(state: Record<string, any> | null | undefined, channelCode: string): boolean | null {
    return readConfirmedSwitchChannel(channelCode, state, null);
  }

  function reconcileConfirmedDevicePatch(deviceId: string, patch: Record<string, any>, observedAt?: string | null) {
    setStateMap((prev) => {
      const reconciled = mergeDeviceRuntimePatch({
        state: { ...(prev[deviceId] || {}), ...patch },
        runtime: runtimeMap[deviceId] || null,
        observedAt,
      });
      return { ...prev, [deviceId]: reconciled.state };
    });
    setRuntimeMap((prev) => {
      const reconciled = mergeDeviceRuntimePatch({
        state: { ...(stateMap[deviceId] || {}), ...patch },
        runtime: prev[deviceId] || null,
        observedAt,
      });
      return { ...prev, [deviceId]: reconciled.runtime };
    });
  }

  function settleSwitchCommandsFromPatch(deviceId: string, patch: Record<string, any>) {
    setSwitchCommands((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, pending] of Object.entries(current)) {
        if (!key.startsWith(`${deviceId}:`)) continue;
        const raw = channelValueFromState(patch, pending.command_code);
        if (typeof raw !== "boolean") continue;
        console.info("consumer_command_ui_reconciled", {
          source: "runtime_state",
          device_id: deviceId,
          channel: pending.command_code,
          confirmed_state: raw,
          pending_state: pending.latest_desired_state,
          command_status: pending.command_status,
        });
        if (raw !== pending.latest_desired_state) {
          next[key] = {
            ...pending,
            confirmed_state: raw,
            command_status: "awaiting_confirmation",
            provider_status: pending.provider_status || "accepted",
            last_confirmed_at: new Date().toISOString(),
          };
          changed = true;
          continue;
        }
        clearSwitchTimeout(key);
        delete next[key];
        changed = true;
      }
      return changed ? next : current;
    });
  }

  function dispatchFollowupIfNeeded(deviceId: string, channelCode: string, confirmed: boolean | null, desired: unknown) {
    if (typeof confirmed !== "boolean" || typeof desired !== "boolean" || confirmed === desired) return;
    const device = items.find((candidate) => String(pickDbId(candidate) || "") === deviceId);
    if (!device) return;
    const state = stateMap[deviceId] || {};
    const runtime = runtimeMap[deviceId] || null;
    const gangCount = guessGangCount(device, state, runtime);
    let gangIndex = -1;
    for (let i = 0; i < gangCount; i += 1) {
      if (normalizeCommandKey(device, state, runtime, i) === channelCode) gangIndex = i;
    }
    if (gangIndex < 0) return;
    window.setTimeout(() => void toggleGang(device, gangIndex, desired), 0);
  }

  function applyCommandExecutionUpdate(update: Record<string, any>) {
    const deviceId = String(update?.canonical_device_id || update?.device_id || "");
    const channelCode = String(update?.channel_code || "");
    const executionId = String(update?.command_execution_id || update?.executionId || "");
    if (!deviceId || !channelCode) return;
    const stateKey = switchStateKey(deviceId, channelCode);
    const finalStatus = String(update?.final_status || update?.confirmation_status || update?.provider_status || "").toLowerCase();
    const providerStatus = String(update?.provider_status || "").toLowerCase();
    const observedState = update?.observed_state && typeof update.observed_state === "object" ? update.observed_state : null;
    const confirmedValue = channelValueFromState(observedState, channelCode);
    const safeMessage = String(update?.safe_error_message || update?.error || "").trim();
    if (typeof confirmedValue === "boolean") {
      reconcileConfirmedDevicePatch(deviceId, { [channelCode]: confirmedValue }, String(update?.evidence_observed_at || update?.confirmation_completed_at || update?.updated_at || "") || null);
    }
    setSwitchCommands((current) => {
      const pending = current[stateKey];
      if (!pending) return current;
      if (executionId && pending.active_command_execution_id && executionId !== pending.active_command_execution_id) return current;
      console.info("consumer_command_ui_reconciled", {
        source: update?.source === "status_poll" ? "status_poll" : "socket",
        device_id: deviceId,
        channel: channelCode,
        confirmed_state: confirmedValue,
        pending_state: pending.latest_desired_state,
        command_status: finalStatus,
      });
      if (["state_confirmed", "confirmed", "executed"].includes(finalStatus)) {
        clearCommandPoll(executionId);
        clearSwitchTimeout(stateKey);
        const desired = pending.latest_desired_state;
        const confirmed = typeof confirmedValue === "boolean" ? confirmedValue : pending.pending_expected_state === pending.latest_desired_state ? pending.latest_desired_state : pending.confirmed_state;
        dispatchFollowupIfNeeded(deviceId, channelCode, typeof confirmed === "boolean" ? confirmed : null, desired);
        if (typeof confirmed === "boolean" && typeof desired === "boolean" && confirmed !== desired) {
          return {
            ...current,
            [stateKey]: {
              ...pending,
              confirmed_state: confirmed,
              pending_expected_state: desired,
              desired_state: desired,
              command_status: "queued",
              provider_status: "not_started",
              active_command_execution_id: null,
              command_execution_id: null,
              last_confirmed_at: new Date().toISOString(),
            },
          };
        }
        const next = { ...current };
        delete next[stateKey];
        return next;
      }
      if (["accepted", "awaiting_state_confirmation", "provider_accepted"].includes(finalStatus) || providerStatus === "accepted") {
        return {
          ...current,
          [stateKey]: {
            ...pending,
            active_command_execution_id: executionId || pending.active_command_execution_id,
            command_execution_id: executionId || pending.command_execution_id,
            command_status: "awaiting_confirmation",
            provider_status: "accepted",
          },
        };
      }
      if (["provider_rejected", "state_mismatch", "confirmation_timed_out", "failed", "rejected"].includes(finalStatus)) {
        clearCommandPoll(executionId);
        clearSwitchTimeout(stateKey);
        const mappedStatus = finalStatus === "confirmation_timed_out" ? "timed_out" : finalStatus === "state_mismatch" ? "mismatch" : "failed";
        return {
          ...current,
          [stateKey]: {
            ...pending,
            pending_expected_state: null,
            command_status: mappedStatus,
            provider_status: finalStatus === "provider_rejected" || finalStatus === "rejected" ? "rejected" : pending.provider_status,
            last_error: { classification: finalStatus || "command_failed", message: safeMessage || `${pending.command_code} command did not complete.`, retryable: true },
            error: safeMessage || `${pending.command_code} command did not complete.`,
          },
        };
      }
      return current;
    });
  }

  function pollCommandExecution(commandExecutionId: string, deviceId: string, commandCode: string, attempts = 8) {
    clearCommandPoll(commandExecutionId);
    let remaining = attempts;
    const tick = async () => {
      if (remaining <= 0) return;
      remaining -= 1;
      try {
        const result = await deviceService.getCommandExecution(commandExecutionId);
        const execution = result?.execution || null;
        if (execution) {
          applyCommandExecutionUpdate({ ...execution, canonical_device_id: execution.canonical_device_id || deviceId, channel_code: execution.channel_code || commandCode, source: "status_poll" });
          const finalStatus = String(execution.final_status || execution.confirmation_status || "").toLowerCase();
          if (isTerminalExecutionStatus(finalStatus)) {
            clearCommandPoll(commandExecutionId);
            return;
          }
        }
      } catch {
        // Socket/runtime updates remain authoritative; polling is only recovery.
      }
      commandPollersRef.current[commandExecutionId] = setTimeout(tick, remaining > 4 ? 1200 : 2200);
    };
    commandPollersRef.current[commandExecutionId] = setTimeout(tick, 1000);
  }

  async function hydrateStates(
    list: AnyDevice[],
    prefetchedRuntime?: Awaited<ReturnType<typeof deviceService.getRuntimeDevices>>,
  ) {
    const patch: Record<string, any> = {};
    const runtimePatch: Record<string, DeviceRuntimeContract> = {};
    try {
      const runtimeDevices = prefetchedRuntime || await deviceService.getRuntimeDevices(homeId);
      const runtimeById = new Map(runtimeDevices.map((runtime) => [String(runtime.device_id), runtime]));
      list.forEach((device) => {
        const sid = String(pickDbId(device) || "");
        const runtime = runtimeById.get(sid);
        if (!sid || !runtime) return;
        const normalized = normalizeRuntimeContract(device, runtime);
        const reconciled = mergeDeviceRuntimePatch({
          state: normalized.state || runtime.state || {},
          runtime: normalized,
          observedAt: String((runtime as any)?.runtime_timestamp || (runtime as any)?.state_confirmed_at || (runtime as any)?.updated_at || "") || null,
        });
        patch[sid] = reconciled.state;
        runtimePatch[sid] = reconciled.runtime;
      });
    } catch (error: any) {
      console.error("[consumer.devices.runtime] batch_load_failed", {
        estateId,
        homeId,
        code: error?.code || null,
        status: error?.status || error?.response?.status || null,
        technical: error?.technical || error?.response?.data?.error || error?.message || null,
      });
      return;
    }
    if (Object.keys(patch).length) {
      setStateMap((prev) => ({ ...prev, ...patch }));
      Object.entries(patch).forEach(([sid, state]) => settleSwitchCommandsFromPatch(sid, state as Record<string, any>));
    }
    if (Object.keys(runtimePatch).length) setRuntimeMap((prev) => ({ ...prev, ...runtimePatch }));
  }

  async function hydrateDeviceIntelligence(device: AnyDevice) {
    const sid = String(pickDbId(device) || "");
    if (!sid) return;
    try {
      const response = await deviceService.getDeviceState(sid, { include: ["intelligence"], view: "panel" });
      if (response.error) return;
      const normalized = normalizeRuntimeContract(device, response);
      const reconciled = mergeDeviceRuntimePatch({
        state: response.state || {},
        runtime: normalized,
        observedAt: String((response as any)?.runtime_timestamp || (response as any)?.state_confirmed_at || (response as any)?.updated_at || "") || null,
      });
      setStateMap((current) => ({ ...current, [sid]: reconciled.state }));
      setRuntimeMap((current) => ({ ...current, [sid]: reconciled.runtime }));
      settleSwitchCommandsFromPatch(sid, reconciled.state);
    } catch {
      // The live runtime remains usable while optional intelligence is unavailable.
    }
  }

  async function load() {
    if (!contextReady || !estateId || !homeId) {
      setItems([]);
      setStateMap({});
      setLoading(activeContext.loading || activeContext.switching);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const runtimeDevices = await deviceService.getRuntimeDevices(homeId);
      const nextList = Array.isArray(runtimeDevices) ? runtimeDevices : [];
      setItems(nextList);
      await hydrateStates(nextList, runtimeDevices);
    } catch (e: any) {
      console.error("[consumer.devices.list] load_failed", {
        estateId,
        homeId,
        code: e?.code || null,
        status: e?.status || e?.response?.status || null,
        technical: e?.technical || e?.response?.data?.error || e?.message || null,
      });
      setErr(deviceListMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, activeContext.contextKey]);

  useEffect(() => {
    const timeouts = switchTimeoutsRef.current;
    return () => {
      Object.keys(timeouts).forEach((key) => {
        if (timeouts[key]) clearTimeout(timeouts[key]);
        delete timeouts[key];
      });
      clearAllCommandPolls();
    };
  }, [clearAllCommandPolls]);

  useEffect(() => {
    clearAllCommandPolls();
    setSwitchCommands({});
  }, [activeContext.contextKey, clearAllCommandPolls]);

  useEffect(() => {
    if (!contextReady || !estateId || !homeId) return;
    const socket = getSocket();
    if (!socket) return;

    const subscribe = () => {
      socket.emit("subscribe:estate", estateId);
      socket.emit("subscribe:home", homeId);
    };

    const onUpdate = (payload: any) => {
      if ((payload?.estate_id || payload?.estateId || payload?.home_id || payload?.homeId) && !scopeMatches(
        { estateId: payload?.estate_id || payload?.estateId, homeId: payload?.home_id || payload?.homeId },
        { estateId, homeId },
        { allowUnscoped: false },
      )) return;

      const eventIds = [
        payload?.deviceId,
        payload?.device_id,
        payload?.external_device_id,
        payload?.externalId,
      ].map((value) => String(value || "").trim()).filter(Boolean);
      if (!eventIds.length) return;

      const target = items.find((device) => idsForDevice(device).some((id) => eventIds.includes(id)));
      if (!target) return;
      const sid = String(pickDbId(target) || "");
      if (!sid) return;
      const statePatch = payload?.state || {};
      reconcileConfirmedDevicePatch(sid, statePatch, String(payload?.provider_timestamp || payload?.runtime_timestamp || payload?.updated_at || "") || null);
      settleSwitchCommandsFromPatch(sid, statePatch);
    };

    socket.on("connect", subscribe);
    socket.on("device:update", onUpdate);
    socket.on("device.status.updated", onUpdate);
    socket.on("command.execution.updated", applyCommandExecutionUpdate);
    if (socket.connected) subscribe();

    return () => {
      socket.off("connect", subscribe);
      socket.off("device:update", onUpdate);
      socket.off("device.status.updated", onUpdate);
      socket.off("command.execution.updated", applyCommandExecutionUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, activeContext.contextKey, estateId, homeId, items]);

  useEffect(() => {
    if (["1", "device"].includes(String(searchParams.get("add") || ""))) void openAddDevice();
    if (String(searchParams.get("edit") || "") === "favorites") setEditingFavorites(true);
    const categoryParam = String(searchParams.get("category") || "").toLowerCase();
    const normalizedCategory = categoryParam === "light" ? "lights" : categoryParam;
    if (CATEGORIES.some((item) => item.key === normalizedCategory)) setCategory(normalizedCategory as CategoryKey);
    // Open the resident device picker once when linked from Home empty state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("oyi:device-registry-updated", refresh);
    return () => window.removeEventListener("oyi:device-registry-updated", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, activeContext.contextKey]);

  useEffect(() => {
    const targetId = String(searchParams.get("deviceId") || "").trim();
    if (!targetId || !items.length) return;
    const target = items.find((device) => {
      const ids = [pickDbId(device), pickExternalId(device), device?.device_id, device?.dev_id].map((value) => String(value || ""));
      return ids.includes(targetId);
    });
    if (target) openDevice(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchParams]);

  useEffect(() => {
    if (!sheetOpen || !sheetDevice) {
      setDeviceExecutions([]);
      return;
    }
    const provider = String(sheetDevice?.provider || sheetDevice?.vendor || sheetDevice?.adapter || "").trim();
    const deviceId = String(pickDbId(sheetDevice) || pickExternalId(sheetDevice) || "").trim();
    let alive = true;
    void loadOyiCoreExecutionHistory({
      limit: 8,
      deviceId: deviceId || undefined,
      provider: provider || undefined,
    })
      .then((executions) => {
        if (alive) setDeviceExecutions(Array.isArray(executions) ? executions : []);
      })
      .catch(() => {
        if (alive) setDeviceExecutions([]);
      });
    return () => {
      alive = false;
      if (deviceId) void deviceService.releaseDeviceView(deviceId);
    };
  }, [sheetOpen, sheetDevice]);

  useEffect(() => {
    if (!stateOpen && statePanelDeviceId) {
      const deviceId = statePanelDeviceId;
      setStatePanelDeviceId(null);
      void deviceService.releaseDeviceView(deviceId);
    }
    return () => {
      if (statePanelDeviceId) void deviceService.releaseDeviceView(statePanelDeviceId);
    };
  }, [stateOpen, statePanelDeviceId]);

  const selectedDiscoveryIds = useMemo(() => Object.keys(selectedDiscover).filter((k) => selectedDiscover[k]), [selectedDiscover]);
  const providerDevices = useMemo(() => items.filter((device) => !device?.home_id && String(device?.provider || device?.vendor || device?.adapter || "").toLowerCase() === "tuya"), [items]);
  const residentItems = useMemo(() => {
    const parentIds = new Set(
      items
        .map((device) => String(device?.parent_device_id || device?.metadata?.ir_appliance?.parent_device_id || "").trim())
        .filter(Boolean),
    );
    return items.filter((device) => {
      const id = String(pickDbId(device) || "").trim();
      const runtime = id ? runtimeMap[id] : null;
      const contract = normalizeRuntimeContract(device, runtime);
      const isTransportHub =
        !device?.is_virtual &&
        String(contract.control_profile || contract.device_family || "").toLowerCase() === "ir_remote" &&
        parentIds.has(id);
      return !isTransportHub;
    });
  }, [items, runtimeMap]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return residentItems.filter((d) => {
      const deviceCategory = categoryFor(d);
      const family = inferFamily(d);
      const categoryMatch = category === "all" || deviceCategory === category || (category === "lights" && family === "switch");
      if (!categoryMatch) return false;
      if (!term) return true;
      return [pickName(d), pickRoomName(d), displayState(d, stateMap[String(pickDbId(d))] || {}, runtimeMap[String(pickDbId(d))] || null)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [residentItems, q, category, stateMap, runtimeMap]);

  const favorites = useMemo(() => residentItems.filter((device) => Boolean(device?.home_id) && isFavoriteDevice(device)).slice(0, 8), [residentItems]);

  const roomGroups = useMemo(() => {
    const map = new Map<string, { key: string; roomId: string; name: string; devices: AnyDevice[] }>();
    residentItems.forEach((device) => {
      const roomId = pickRoomId(device);
      if (!device?.home_id || !roomId) return;
      const key = pickRoomKey(device);
      const name = pickRoomName(device) || "Room";
      const current = map.get(key) || { key, roomId: String(roomId), name, devices: [] as AnyDevice[] };
      current.devices.push(device);
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [residentItems]);

  const attentionItems = useMemo(() => {
    return residentItems
      .map((device) => ({ device, reason: attentionReason(device, stateMap[String(pickDbId(device))] || {}, runtimeMap[String(pickDbId(device))] || null) }))
      .filter((item) => Boolean(item.reason));
  }, [residentItems, stateMap, runtimeMap]);

  async function warmState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;
    const sid = String(dbId);
    if (stateMap[sid]) return;
    try {
      const res = await deviceService.getDeviceState(sid, { view: "control" });
      const normalized = normalizeRuntimeContract(device, res as any);
      const reconciled = mergeDeviceRuntimePatch({
        state: (res as any)?.state ?? res ?? {},
        runtime: normalized,
        observedAt: String((res as any)?.runtime_timestamp || (res as any)?.state_confirmed_at || (res as any)?.updated_at || "") || null,
      });
      setStateMap((p) => ({ ...p, [sid]: reconciled.state }));
      setRuntimeMap((p) => ({ ...p, [sid]: reconciled.runtime }));
    } catch {
      // silent warmup
    }
  }

  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    const sid = String(dbId);
    if (!canSwitchDevice(device, runtimeMap[sid] || null)) return setErr(`${pickName(device)} does not expose a supported power command.`);
    setErr(null);
    const label = pickName(device);
    let stateKey = "";
    let commandCode = "";
    let confirmedState: boolean | null = null;
    try {
      await warmState(device);
      const cached = stateMap[sid] || {};
      const runtime = runtimeMap[sid] || null;
      const gangCount = guessGangCount(device, cached, runtime);
      const code = normalizeCommandKey(device, cached, runtime, gangIndex);
      commandCode = code;
      stateKey = switchStateKey(sid, code);
      const existing = switchCommands[stateKey];
      const values = readGangValues(gangCount, cached, runtime);
      confirmedState = existing?.confirmed_state ?? values[gangIndex] ?? null;
      if (existing && ["queued", "dispatching", "awaiting_confirmation", "pending"].includes(existing.command_status)) {
        setSwitchCommands((current) => {
          const active = current[stateKey];
          if (!active) return current;
          return {
            ...current,
            [stateKey]: {
              ...active,
              pending_expected_state: next,
              latest_desired_state: next,
              desired_state: next,
              command_status: active.active_command_execution_id ? "awaiting_confirmation" : "queued",
              error: null,
              last_error: null,
            },
          };
        });
        console.info("consumer_command_followup_coalesced", {
          device_id: sid,
          channel: code,
          active_execution: existing.active_command_execution_id || existing.command_execution_id || null,
          previous_desired_state: existing.latest_desired_state,
          latest_desired_state: next,
        });
        return;
      }
      const tapSequence = nextSwitchTapSequence(sid, code);
      const clientTapTimestamp = Date.now();
      const commandKey = `${activeContext.contextKey || "home"}:${sid}:${code}:${tapSequence}`;
      console.info("consumer_command_intent_registered", {
        device_id: sid,
        channel: code,
        desired_state: next,
        active_execution: null,
        latest_desired_state: next,
      });
      setSwitchCommands((current) => ({
        ...current,
        [stateKey]: {
          confirmed_state: confirmedState,
          pending_expected_state: next,
          latest_desired_state: next,
          desired_state: next,
          active_command_execution_id: null,
          command_status: "dispatching",
          provider_status: "pending",
          command_execution_id: null,
          command_key: commandKey,
          command_code: code,
          tap_sequence: tapSequence,
          client_tap_timestamp: clientTapTimestamp,
          pending_started_at: new Date(clientTapTimestamp).toISOString(),
          last_confirmed_at: null,
          last_error: null,
          error: null,
        },
      }));
      scheduleSwitchTimeout(stateKey, label);
      const response = await deviceService.commandDevice(sid, { [code]: next }, {
        idempotencyKey: commandKey,
        commandKey,
        tapSequence,
        clientTapTimestamp,
      });
      setSwitchCommands((current) => {
        const pending = current[stateKey];
        if (!pending || pending.command_key !== commandKey) return current;
        return {
          ...current,
          [stateKey]: {
            ...pending,
            command_execution_id: response?.command_execution_id || pending.command_execution_id,
            active_command_execution_id: response?.command_execution_id || pending.active_command_execution_id,
            command_status: "awaiting_confirmation",
            provider_status: response?.provider_status === "accepted" ? "accepted" : pending.provider_status,
          },
        };
      });
      if (response?.command_execution_id) pollCommandExecution(String(response.command_execution_id), sid, code);
    } catch (e: any) {
      const body = e?.response?.data || {};
      const channelLabel = `Channel ${gangIndex + 1}`;
      const message = body?.safe_error_message || body?.details || body?.error || e?.message || `${channelLabel} command failed.`;
      const scopedMessage = `${channelLabel} command failed. ${message}`;
      if (stateKey) {
        clearSwitchTimeout(stateKey);
        setSwitchCommands((current) => {
          const pending = current[stateKey];
          if (!pending) return current;
          return {
            ...current,
            [stateKey]: {
              ...pending,
              command_status: "failed",
              provider_status: "rejected",
              pending_expected_state: null,
              last_error: { classification: body?.provider_error_classification || body?.error || "command_failed", message: scopedMessage, retryable: Boolean(body?.retryable) },
              error: scopedMessage,
            },
          };
        });
      }
      setStateMap((p) => {
        const cached = p[sid] || {};
        if (!commandCode || confirmedState === null) return p;
        const reconciled = mergeDeviceRuntimePatch({
          state: { ...cached, [commandCode]: confirmedState },
          runtime: runtimeMap[sid] || null,
          commandCode,
          confirmedValue: confirmedState,
        });
        return { ...p, [sid]: reconciled.state };
      });
      if (commandCode && confirmedState !== null) {
        setRuntimeMap((prev) => {
          const reconciled = mergeDeviceRuntimePatch({
            state: { ...(stateMap[sid] || {}), [commandCode]: confirmedState },
            runtime: prev[sid] || null,
            commandCode,
            confirmedValue: confirmedState,
          });
          return { ...prev, [sid]: reconciled.runtime };
        });
      }
      setErr(`${label}: ${scopedMessage}`);
    }
  }

  async function toggleMasterPower(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    const sid = String(dbId);
    if (isOnline(device, runtimeMap[sid] || null) === false) return setErr(`${pickName(device)} is offline.`);
    if (!canSwitchDevice(device, runtimeMap[sid] || null)) return setErr(`${pickName(device)} does not expose a supported power command.`);
    setBusyId(sid);
    setErr(null);
    try {
      await warmState(device);
      const cached = stateMap[sid] || {};
      const runtime = runtimeMap[sid] || null;
      const gangCount = guessGangCount(device, cached, runtime);
      const values = readGangValues(gangCount, cached, runtime);
      const nowOn = values.some((value) => value === true) ? true : values.some((value) => value === false) ? false : readPowerState(cached, runtime);
      const next = nowOn === null ? true : !nowOn;
      for (let i = 0; i < gangCount; i += 1) {
        if (values[i] !== next) await toggleGang(device, i, next);
      }
    } catch (e: any) {
      const body = e?.response?.data || {};
      setErr(body.safe_error_message || body.details || body.error || e?.message || "Command failed");
    } finally {
      setBusyId(null);
    }
  }

  async function sendDeviceCommand(device: AnyDevice, command: Record<string, any>, optimisticPatch?: Record<string, any>) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    const sid = String(dbId);
    if (isOnline(device, runtimeMap[sid] || null) === false) return setErr(`${pickName(device)} is offline.`);
    const commandType = String(command?.type || "").toLowerCase();
    const isIrRemoteCommand = commandType === "tv_remote" || commandType === "ir_remote" || commandType === "ac_remote";
    const now = Date.now();
    const tapSequence = isIrRemoteCommand ? ++irTapSequenceRef.current : undefined;
    const idempotencyKey = isIrRemoteCommand
      ? `${activeContext.contextKey || "home"}:${sid}:${commandType || "ir"}:${tapSequence}:${now}`
      : `${activeContext.contextKey || "home"}:${sid}:${commandType || "command"}:${now}:${Math.random().toString(36).slice(2, 8)}`;
    if (!isIrRemoteCommand) setBusyId(sid);
    setErr(null);
    try {
      if (isIrRemoteCommand) {
        await deviceService.commandDevice(sid, command, {
          idempotencyKey,
          tapSequence,
          clientTapTimestamp: now,
          commandTransport: "ir",
        });
      } else {
        await deviceService.commandDevice(sid, command, { idempotencyKey });
      }
      if (optimisticPatch) setStateMap((p) => ({ ...p, [sid]: { ...(p[sid] || {}), ...optimisticPatch } }));
      setTool(null);
    } catch (e: any) {
      const body = e?.response?.data || {};
      if (!isIrRemoteCommand) setErr(body.safe_error_message || body.details || body.error || e?.message || "Command failed");
      throw e;
    } finally {
      if (!isIrRemoteCommand) setBusyId(null);
    }
  }

  async function saveDeviceSchedule(device: AnyDevice, input: { time: string; days: string[]; repeat: boolean; power: "on" | "off" }) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    setBusyId(String(dbId));
    setErr(null);
    try {
      await sceneService.createAutomation({
        name: `${pickName(device)} ${input.power === "on" ? "on" : "off"} schedule`,
        trigger: { type: "time", time: input.time, days: input.days, repeat: input.repeat },
        condition: {},
        actions: [{ device_id: String(dbId), command: { switch: input.power === "on" } }],
        enabled: true,
      });
      setTool(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Schedule could not be saved.");
    } finally {
      setBusyId(null);
    }
  }

  async function bindIrAppliance(device: AnyDevice, profile: IrProfile) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);
    try {
      const result = await deviceService.createIrAppliance(sid, { profile });
      if (result?.error) {
        setErr(String(result.error));
        return;
      }
      await load();
      const applianceId = String(result?.appliance?.id || "").trim();
      if (applianceId) {
        const nextDevice = items.find((item) => String(pickDbId(item) || "") === applianceId);
        if (nextDevice) setSheetDevice(nextDevice);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Add or sync an appliance profile before using this remote.");
    } finally {
      setBusyId(null);
    }
  }

  function openDevice(device: AnyDevice) {
    if (!device?.home_id) {
      setAssignDevice(device);
      setAssignRoom(String(suggestedRoom(device) || ""));
      return;
    }
    setSheetDevice(device);
    setSheetOpen(true);
    const sid = String(pickDbId(device) || "");
    const renderer = deviceRendererKind(device, sid ? runtimeMap[sid] : null);
    if (sid) void deviceService.getDeviceState(sid, { view: "control" }).then((res) => {
      const state = (res as any)?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));
      setRuntimeMap((p) => ({ ...p, [sid]: normalizeRuntimeContract(device, res) }));
    }).catch(() => {});
    if (renderer !== "lock") void hydrateDeviceIntelligence(device);
  }

  async function assignListedDevice() {
    if (!assignDevice || binding) return;
    setBinding(true);
    setErr(null);
    try {
      await deviceService.assignDevices({
        devices: [{
          external_id: String(pickExternalId(assignDevice) || ""),
          vendor: assignDevice?.vendor || assignDevice?.adapter || assignDevice?.provider || "tuya",
          adapter: assignDevice?.adapter || assignDevice?.vendor || assignDevice?.provider || "tuya",
          name: pickName(assignDevice),
          type: assignDevice?.type || assignDevice?.category || "device",
          icon: assignDevice?.icon,
          online: typeof assignDevice?.online === "boolean" ? assignDevice.online : undefined,
          metadata: assignDevice?.metadata || {},
        }],
        room: assignRoom.trim() || null,
      } as any);
      setAssignDevice(null);
      setAssignRoom("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to assign device");
    } finally {
      setBinding(false);
    }
  }

  async function toggleFavorite(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId || !device?.home_id || busyId) return;
    const sid = String(dbId);
    const favorite = !isFavoriteDevice(device);
    setBusyId(sid);
    setErr(null);
    try {
      await deviceService.setFavorite(sid, favorite);
      setItems((current) =>
        current.map((item) =>
          String(pickDbId(item) || "") === sid
            ? { ...item, metadata: { ...(item?.metadata || {}), favorite } }
            : item,
        ),
      );
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to update favorite");
    } finally {
      setBusyId(null);
    }
  }

  async function viewFriendlyDetails(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;
    const sid = String(dbId);
    setStateTitle(pickName(device));
      setStateMeta({ rows: friendlyStateRows(device, stateMap[sid] || {}, runtimeMap[sid] || null) });
    setStatePanelDeviceId(sid);
    setStateOpen(true);
    setStateLoading(true);
    try {
      const res = await deviceService.getDeviceState(sid, { view: "control" });
      const state = (res as any)?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));
      setRuntimeMap((p) => ({ ...p, [sid]: normalizeRuntimeContract(device, res) }));
      setStateMeta({ rows: friendlyStateRows(device, state, normalizeRuntimeContract(device, res)) });
    } finally {
      setStateLoading(false);
    }
  }

  async function refreshDiscovery(adapter = addDeviceTab === "nearby" ? "ssdp" : "tuya") {
    setDiscovering(true);
    setErr(null);
    try {
      const found = await deviceService.discoverDevices(adapter);
      setDiscovered(Array.isArray(found) ? found : []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to discover devices");
      setDiscovered([]);
    } finally {
      setDiscovering(false);
    }
  }

  async function openAddDevice() {
    setAddDeviceOpen(true);
    setAddDeviceTab("nearby");
    setSelectedDiscover({});
    await refreshDiscovery("ssdp");
  }

  async function bindSelectedDevices() {
    if (!selectedDiscoveryIds.length) return;
    setBinding(true);
    setErr(null);
    try {
      const targets = [...discovered, ...providerDevices].filter((d, index, list) => {
        const ext = pickDiscoveryExternalId(d);
        return ext && selectedDiscover[String(ext)] && list.findIndex((entry) => String(pickDiscoveryExternalId(entry)) === String(ext)) === index;
      });
      const payload: any = {
        devices: targets.map((d) => ({
          external_id: String(pickDiscoveryExternalId(d)),
          vendor: d?.vendor || d?.adapter || "tuya",
          adapter: d?.adapter || d?.vendor || "tuya",
          name: d?.name || d?.type || "Device",
          type: d?.type || d?.category || "device",
          icon: d?.icon,
          ip: d?.ip,
          protocol: d?.protocol,
          online: typeof d?.online === "boolean" ? d.online : undefined,
          metadata: d?.metadata ?? d,
        })),
        room: bindRoom || null,
        estate_id: estateId || undefined,
        home_id: homeId || undefined,
      };
      await deviceService.assignDevices(payload);
      setAddDeviceOpen(false);
      setBindRoom("");
      setSelectedDiscover({});
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to add selected devices");
    } finally {
      setBinding(false);
    }
  }

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_12%,rgba(0,132,255,0.16),transparent_30%),radial-gradient(circle_at_18%_38%,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,rgba(4,12,22,0.18),rgba(0,0,0,0.93))]" />

        <div className="fixed inset-x-0 z-[80] px-5" style={{ top: "calc(8px + var(--sat))" }}>
          <div className="mx-auto flex max-w-[430px] items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><HamburgerMenu /></div>
            <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><MessagesInboxButton /></div>
          </div>
        </div>

        <div className="absolute inset-x-0 overflow-y-auto px-5" style={{ top: "calc(68px + var(--sat))", bottom: "calc(78px + var(--sab))", WebkitOverflowScrolling: "touch" }}>
          <div className="mx-auto max-w-[430px] pb-6">
            <header className="flex items-end justify-between gap-3">
              <div>
                <h1 className="text-[30px] font-semibold leading-none tracking-[-0.055em] text-white">Devices</h1>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => router.push("/scenes")} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-medium text-white/68 active:scale-[0.98]"><Moon className="h-3.5 w-3.5" /> Scenes</button>
                <button type="button" onClick={openAddDevice} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100 shadow-[0_0_18px_rgba(0,132,255,0.14)] active:scale-[0.98]">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </header>

            {err ? <div className="mt-4 rounded-[18px] border border-red-300/16 bg-red-500/10 px-3.5 py-3 text-xs text-red-100">{err}</div> : null}

            <section className="mt-5">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Favorite Controls</h2>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditingFavorites((current) => !current)} className="text-xs text-sky-200/76">{editingFavorites ? "Done" : "Edit favorites"}</button>
                  <button type="button" onClick={load} disabled={loading} className="text-xs text-sky-200/76 disabled:text-white/30">{loading ? "Syncing" : "Refresh"}</button>
                </div>
              </div>
              {favorites.length ? (
                <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {favorites.map((device) => <FavoriteCard key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} state={stateMap[String(pickDbId(device))] || {}} runtime={runtimeMap[String(pickDbId(device))] || null} busy={busyId === String(pickDbId(device))} onOpen={openDevice} onPower={toggleMasterPower} />)}
                </div>
              ) : (
                <div className="rounded-[22px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] p-4 text-sm text-white/54 shadow-[0_14px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                  No favorite controls yet.
                </div>
              )}
            </section>

            <section className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Device categories">
              {CATEGORIES.map((item) => {
                const active = category === item.key;
                return <button key={item.key} type="button" onClick={() => setCategory(item.key)} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition active:scale-[0.98]", active ? "border-sky-400/70 bg-sky-400/10 text-sky-200 shadow-[0_0_20px_rgba(0,132,255,0.18)]" : "border-white/[0.075] bg-white/[0.025] text-white/62 hover:bg-white/[0.05]")}>{item.label}</button>;
              })}
            </section>

            <section className="mt-4">
              <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Devices by Room</h2>
              {roomGroups.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {roomGroups.map((room) => <RoomCard key={room.key} room={room} />)}
                </div>
              ) : (
                <AmbientEmpty className="mt-3" title="No rooms available" body="Assigned room devices will appear here." />
              )}
            </section>

            {attentionItems.length ? (
              <section className="mt-5">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Attention Needed</h2>
                <div className="mt-3 space-y-2">
                  {attentionItems.map(({ device, reason }) => <AttentionRow key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} runtime={runtimeMap[String(pickDbId(device))] || null} reason={String(reason)} />)}
                </div>
              </section>
            ) : null}

            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">All Devices</h2>
                <button type="button" onClick={() => router.push("/activity")} className="inline-flex items-center gap-1 text-xs text-sky-200/80">View Activity <ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
              <label className="flex h-11 items-center gap-2 rounded-full border border-white/[0.075] bg-white/[0.035] px-4 text-white/70 shadow-[0_12px_34px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus-within:border-sky-300/25 focus-within:bg-sky-400/[0.045]">
                <Search className="h-4 w-4 text-white/36" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search devices" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/34" />
              </label>

              <div className="mt-3 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] shadow-[0_14px_48px_rgba(0,0,0,0.29)] backdrop-blur-2xl">
                {loading && !filtered.length ? <div className="px-4 py-5 text-sm text-white/50">Loading devices…</div> : null}
                {!loading && !filtered.length ? <div className="px-4 py-5 text-sm text-white/50">No devices available.</div> : null}
                {filtered.map((device, index) => <DeviceRow key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} state={stateMap[String(pickDbId(device))] || {}} runtime={runtimeMap[String(pickDbId(device))] || null} busy={busyId === String(pickDbId(device))} bordered={index > 0} editingFavorites={editingFavorites} onOpen={openDevice} onPower={toggleMasterPower} onFavorite={toggleFavorite} />)}
              </div>
            </section>
          </div>
        </div>

        {addDeviceOpen ? <AddDeviceSheet tab={addDeviceTab} setTab={setAddDeviceTab} discovering={discovering} binding={binding} discovered={discovered} providerDevices={providerDevices} selectedDiscover={selectedDiscover} selectedCount={selectedDiscoveryIds.length} bindRoom={bindRoom} setBindRoom={setBindRoom} setSelectedDiscover={setSelectedDiscover} onClose={() => setAddDeviceOpen(false)} onScan={refreshDiscovery} onBind={bindSelectedDevices} /> : null}
        {assignDevice ? <UnassignedDeviceSheet device={assignDevice} room={assignRoom} setRoom={setAssignRoom} binding={binding} onClose={() => setAssignDevice(null)} onAssign={assignListedDevice} /> : null}
        {sheetOpen && sheetDevice ? <DeviceModalRouter device={sheetDevice} state={stateMap[String(pickDbId(sheetDevice))] || {}} runtime={runtimeMap[String(pickDbId(sheetDevice))] || null} switchCommands={switchCommands} busy={busyId === String(pickDbId(sheetDevice))} awareness={latestAwareness} recommendation={latestRecommendations[0] || null} onClose={() => setSheetOpen(false)} onToggleGang={toggleGang} onPower={toggleMasterPower} onCommand={sendDeviceCommand} onTool={(kind, device) => setTool({ kind, device })} onCreateScene={(device) => router.push(`/scenes?create=scene&deviceId=${encodeURIComponent(String(pickDbId(device) || ""))}`)} onCreateAutomation={(device) => router.push(`/scenes?tab=automations&deviceId=${encodeURIComponent(String(pickDbId(device) || ""))}`)} onBindIrAppliance={bindIrAppliance} /> : null}
        {tool ? <DeviceToolSheet kind={tool.kind} device={tool.device} runtime={runtimeMap[String(pickDbId(tool.device))] || null} executionHistory={deviceExecutions} busy={busyId === String(pickDbId(tool.device))} onClose={() => setTool(null)} onTimer={(command, patch) => sendDeviceCommand(tool.device, command, patch)} onSchedule={(input) => saveDeviceSchedule(tool.device, input)} onSettings={async ({ favorite, room }) => {
          const id = String(pickDbId(tool.device) || "");
          if (!id) return;
          setBusyId(id);
          setErr(null);
          try {
            if (typeof favorite === "boolean") await deviceService.setFavorite(id, favorite);
            if (room.trim()) await deviceService.assignDevices({ deviceIds: [id], room: room.trim() });
            await load();
            setTool(null);
          } catch (e: any) {
            setErr(e?.response?.data?.error || e?.message || "Settings could not be saved.");
          } finally {
            setBusyId(null);
          }
        }} /> : null}
        {stateOpen ? <DetailsModal title={stateTitle} meta={stateMeta} loading={stateLoading} onClose={() => setStateOpen(false)} /> : null}
        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}

function FavoriteCard({ device, state, runtime, busy, onOpen, onPower }: { device: AnyDevice; state: any; runtime?: Partial<DeviceRuntimeContract> | null; busy: boolean; onOpen: (device: AnyDevice) => void; onPower: (device: AnyDevice) => void }) {
  const Icon = deviceIcon(device, runtime);
  const stateText = busy ? "Working…" : displayState(device, state, runtime);
  return (
    <button type="button" onClick={() => onOpen(device)} className="relative min-h-[142px] w-[156px] shrink-0 snap-start overflow-hidden rounded-[26px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.052),rgba(255,255,255,0.014))] p-3.5 text-left shadow-[0_16px_48px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition active:scale-[0.985]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-400/12 blur-3xl" />
      <div className={cn("relative grid h-11 w-11 place-items-center rounded-full border", iconTone(device, runtime))}><Icon className="h-5 w-5" /></div>
      <div className="relative mt-5 text-[15px] font-semibold leading-5 tracking-[-0.035em] text-white line-clamp-2">{pickName(device)}</div>
      <div className="relative mt-1 truncate text-xs text-white/46">{pickRoomName(device, runtime) || "Unassigned"}</div>
      <div className="relative mt-3 flex items-center justify-between gap-2">
        <span className={cn("text-[13px] font-semibold", stateText === "On" || stateText === "Online" || stateText === "Locked" ? "text-emerald-300" : "text-white/72")}>{stateText}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onPower(device); }} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/72" aria-label="Toggle power"><Fan className="h-4 w-4" /></button>
      </div>
    </button>
  );
}

function RoomCard({ room }: { room: { key: string; roomId: string; name: string; devices: AnyDevice[] } }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push(`/room?roomId=${encodeURIComponent(room.roomId)}`)} className="rounded-[22px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] p-3.5 text-left shadow-[0_12px_36px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition active:scale-[0.985]">
      <div className="grid h-9 w-9 place-items-center rounded-full border border-sky-300/14 bg-sky-400/10 text-sky-200"><Home className="h-4.5 w-4.5" /></div>
      <div className="mt-3 truncate text-[15px] font-semibold tracking-[-0.035em] text-white">{room.name}</div>
      <div className="mt-1 text-xs text-white/48">{room.devices.length} device{room.devices.length === 1 ? "" : "s"}</div>
    </button>
  );
}

function UnassignedDeviceSheet({ device, room, setRoom, binding, onClose, onAssign }: { device: AnyDevice; room: string; setRoom: (value: string) => void; binding: boolean; onClose: () => void; onAssign: () => void }) {
  const Icon = deviceIcon(device);
  const suggestion = suggestedRoom(device);
  return (
    <div className="fixed inset-0 z-[135]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(14px+var(--sab))]">
        <section className="mx-auto max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", iconTone(device, null))}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">{pickName(device)}</h2><p className="mt-0.5 text-xs capitalize text-white/44">{providerLabel(device)} · {inferFamily(device)}</p></div>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4">
            <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between text-xs"><span className="text-white/42">Connection</span><span className={isOnline(device) === false ? "text-amber-200" : "text-emerald-200"}>{isOnline(device) === false ? "Offline" : isOnline(device) === true ? "Online" : "Awaiting sync"}</span></div>
              <p className="mt-3 text-xs text-white/42">Assign this device to make it available in your home controls.</p>
            </div>
            <div className="mt-3 rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="text-xs font-medium text-white/76">Assign to this home</div>
              <p className="mt-1 text-xs leading-5 text-white/42">Assign this imported device before controlling it. Add a room now or organize it later.</p>
              {suggestion ? <p className="mt-2 text-[11px] text-sky-200/72">Suggested room: {String(suggestion)}</p> : null}
              <input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Room name (optional)" className="mt-3 h-10 w-full rounded-full border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" disabled={binding} />
              <button type="button" onClick={onAssign} disabled={binding} className="mt-2 h-10 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-45">{binding ? "Assigning…" : "Add to Oyi Home"}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DeviceRow({ device, state, runtime, busy, bordered, editingFavorites, onOpen, onPower, onFavorite }: { device: AnyDevice; state: any; runtime?: Partial<DeviceRuntimeContract> | null; busy: boolean; bordered: boolean; editingFavorites: boolean; onOpen: (device: AnyDevice) => void; onPower: (device: AnyDevice) => void; onFavorite: (device: AnyDevice) => void }) {
  const Icon = deviceIcon(device, runtime);
  const simple = isSimpleControlDevice(device, state, runtime);
  const stateText = busy ? "Working…" : displayState(device, state, runtime);
  const contract = normalizeRuntimeContract(device, { ...(runtime || {}), state });
  const secondary = runtimeActivitySummary(device, contract, contract.canonical_state?.secondaryState?.label || pickRoomName(device, contract) || "Unassigned");
  return (
    <div className={cn("flex w-full items-center gap-3 px-3.5 py-3 transition hover:bg-white/[0.035]", bordered && "border-t border-white/[0.055]")}>
      <button type="button" onClick={() => onOpen(device)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", iconTone(device, runtime))}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold tracking-[-0.025em] text-white">{pickName(device)}</span>
          <span className="mt-0.5 block truncate text-xs text-white/44">{secondary}</span>
        </span>
      </button>
      <span className="shrink-0 text-right text-[13px] font-medium text-white/72">{stateText}</span>
      {editingFavorites && device?.home_id ? <button type="button" onClick={() => void onFavorite(device)} className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border transition", isFavoriteDevice(device) ? "border-amber-300/35 bg-amber-300/12 text-amber-200" : "border-white/10 bg-white/[0.05] text-white/38")} aria-label={isFavoriteDevice(device) ? "Remove favorite" : "Add favorite"}><Star className={cn("h-4 w-4", isFavoriteDevice(device) && "fill-current")} /></button> : simple ? <button type="button" onClick={() => void onPower(device)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60" aria-label={`Toggle ${pickName(device)}`}><ChevronRight className="h-4 w-4" /></button> : <ChevronRight className="h-4 w-4 shrink-0 text-white/32" />}
    </div>
  );
}

function AttentionRow({ device, runtime, reason }: { device: AnyDevice; runtime?: Partial<DeviceRuntimeContract> | null; reason: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-amber-300/12 bg-amber-400/[0.055] px-3.5 py-3 text-left">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-amber-300/15 bg-amber-400/10 text-amber-200"><AlertTriangle className="h-4.5 w-4.5" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{pickName(device)}</span><span className="mt-0.5 block text-xs text-amber-100/66">{reason} · {healthLabel(runtime?.health_status, "Attention")}</span></span>
    </div>
  );
}

function AmbientEmpty({ title, body, className }: { title: string; body: string; className?: string }) {
  return <div className={cn("rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4 text-sm text-white/54", className)}><div className="font-medium text-white/74">{title}</div><div className="mt-1 text-xs text-white/42">{body}</div></div>;
}

function AddDeviceSheet({ tab, setTab, discovering, binding, discovered, providerDevices, selectedDiscover, selectedCount, bindRoom, setBindRoom, setSelectedDiscover, onClose, onScan, onBind }: any) {
  const visibleDevices = tab === "provider" ? providerDevices : discovered;
  return (
    <div className="fixed inset-0 z-[130]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(14px+var(--sab))]">
        <section className="mx-auto max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <div><h2 className="text-base font-semibold tracking-[-0.035em] text-white">Add Devices</h2><p className="mt-0.5 text-xs text-white/44">Discover and assign devices to this home.</p></div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-4">
            <div className="flex gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([["nearby", "Nearby / Local"], ["provider", "Provider Devices"], ["manual", "Manual Setup"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => { setTab(key); setSelectedDiscover({}); if (key === "nearby") void onScan("ssdp"); }} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs", tab === key ? "border-sky-300/35 bg-sky-400/10 text-sky-100" : "border-white/[0.07] bg-white/[0.025] text-white/52")}>{label}</button>)}
            </div>
            {tab === "manual" ? <AmbientEmpty title="Automatic discovery first" body="Connect a provider or install Oyi Edge to discover devices automatically. Manual enrollment is not enabled for this home." /> : null}
            {tab !== "manual" ? <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs leading-5 text-white/42">{tab === "nearby" ? "Search supported LAN devices. Deeper local discovery requires Oyi Edge." : "Assign devices imported from Tuya / Smart Life cloud sync."}</p>{tab === "nearby" ? <button type="button" onClick={() => void onScan("ssdp")} disabled={discovering || binding} className="shrink-0 rounded-full border border-sky-300/16 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-50">{discovering ? "Scanning" : "Scan"}</button> : null}</div> : null}
            {tab !== "manual" && discovering ? <div className="text-sm text-white/56">Scanning for devices…</div> : null}
            {tab !== "manual" && !discovering && !visibleDevices.length ? <AmbientEmpty title={tab === "provider" ? "No provider devices ready" : "No nearby devices found"} body={tab === "provider" ? "Sync your provider in Connected Systems, then return to assign imported devices." : "Local discovery requires Oyi Edge or supported LAN devices."} /> : null}
            <div className="space-y-2">
              {tab !== "manual" && visibleDevices.map((d: DiscoveryDevice, index: number) => {
                const ext = pickDiscoveryExternalId(d);
                const key = ext ? String(ext) : `tmp-${index}`;
                const selected = ext ? Boolean(selectedDiscover[String(ext)]) : false;
                return <button key={key} type="button" disabled={!ext || binding} onClick={() => ext && setSelectedDiscover((prev: Record<string, boolean>) => ({ ...prev, [String(ext)]: !prev[String(ext)] }))} className={cn("flex w-full items-center justify-between gap-3 rounded-[18px] border px-3 py-2.5 text-left", selected ? "border-sky-300/25 bg-sky-400/10" : "border-white/[0.07] bg-white/[0.035]", !ext && "opacity-50")}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{d?.name || d?.type || "Device"}</span><span className="mt-0.5 block truncate text-xs text-white/42">{d?.protocol || d?.adapter || d?.vendor || "device"} · {tab === "provider" ? "Available / Unassigned" : "Nearby"}</span></span><span className="text-xs text-white/50">{selected ? "Selected" : typeof d?.online === "boolean" ? (d.online ? "Online" : "Offline") : "Found"}</span></button>;
              })}
            </div>
            {selectedCount ? <div className="mt-3 rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-3"><input value={bindRoom} onChange={(e) => setBindRoom(e.target.value)} placeholder="Room name (optional)" className="h-10 w-full rounded-full border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/34" disabled={binding} /><button type="button" onClick={onBind} disabled={binding} className="mt-2 h-10 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50">{binding ? "Adding…" : `Add ${selectedCount} device${selectedCount === 1 ? "" : "s"}`}</button></div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function DeviceModalRouter({ device, state, runtime, switchCommands, busy, awareness, recommendation, onClose, onToggleGang, onPower, onCommand, onTool, onCreateScene, onCreateAutomation, onBindIrAppliance }: { device: AnyDevice; state: any; runtime?: Partial<DeviceRuntimeContract> | null; switchCommands?: Record<string, SwitchChannelCommandState>; busy: boolean; awareness?: Record<string, any> | null; recommendation?: Record<string, any> | null; onClose: () => void; onToggleGang: (device: AnyDevice, gangIndex: number, next: boolean) => void; onPower: (device: AnyDevice) => void; onCommand: (device: AnyDevice, command: Record<string, any>, optimisticPatch?: Record<string, any>) => Promise<void>; onTool: (kind: DeviceTool, device: AnyDevice) => void; onCreateScene: (device: AnyDevice) => void; onCreateAutomation: (device: AnyDevice) => void; onBindIrAppliance: (device: AnyDevice, profile: IrProfile) => void }) {
  const { user } = useAuth();
  const activeContext = useActiveContext();
  const pushIntelligenceContext = useActiveIntelligenceContextStore((store) => store.pushContext);
  const popIntelligenceContext = useActiveIntelligenceContextStore((store) => store.popContext);
  const gangCount = guessGangCount(device, state, runtime);
  const values = Object.keys(state || {}).length ? readGangValues(gangCount, state, runtime) : Array.from({ length: gangCount }, () => null);
  const caps = uiCapabilities(device, runtime);
  const [selectedIrProfile, setSelectedIrProfile] = useState<IrProfile | null>(null);
  const [irOptions, setIrOptions] = useState<IrProfileOption[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [conversationState, setConversationState] = useState<"idle" | "thinking" | "done" | "error">("idle");
  const [conversationLines, setConversationLines] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [conversationThreadId, setConversationThreadId] = useState<string | null>(null);
  const [conversationRestoring, setConversationRestoring] = useState(false);
  const [contextualActions, setContextualActions] = useState<Array<{ label: string; action: () => void }>>([]);
  const [voiceMode, setVoiceMode] = useState<"idle" | "recording">("idle");
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceLevels, setVoiceLevels] = useState<number[]>([]);
  const [voiceHint, setVoiceHint] = useState("");
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const baseRenderer = deviceRendererKind(device, runtime);
  const learnedProfile = learnedIrTemplate(device);
  const activeIrProfile = learnedProfile || selectedIrProfile;
  const renderer = baseRenderer === "ir" && activeIrProfile === "tv" ? "tv" : baseRenderer === "ir" && activeIrProfile === "ac" ? "ac" : baseRenderer;
  const isLockRenderer = renderer === "lock";
  const needsIrProfile = baseRenderer === "ir" && !activeIrProfile;
  const awarenessMessage = deriveAwarenessMessage(device, state, runtime, awareness, recommendation);
  const latestAssistantLine = [...conversationLines].reverse().find((line) => line.role === "assistant")?.content || "";
  const latestUserLine = [...conversationLines].reverse().find((line) => line.role === "user")?.content || "";
  const responseSurface = splitConversationResponse(latestAssistantLine, awarenessMessage.headline, awarenessMessage.body);
  const intelligenceContext = normalizeRuntimeContract(device, runtime);
  const timerCode = commandCodeFor(device, [/countdown/, /timer/]);
  const deviceContextId = `ctx_consumer_device_${String(pickDbId(device) || "").trim()}`;
  const [drawerConversationTarget, setDrawerConversationTarget] = useState<DrawerConversationTarget>(() => {
    const deviceId = String(pickDbId(device) || "").trim();
    return {
      object_type: "device",
      canonical_id: deviceId,
      parent_device_id: null,
      channel_code: null,
      label: pickName(device),
      room_id: pickRoomId(device),
      context_id: `ctx_consumer_device_${deviceId}`,
      context_version: 1,
    };
  });

  useEffect(() => {
    const deviceId = String(pickDbId(device) || "").trim();
    setDrawerConversationTarget({
      object_type: "device",
      canonical_id: deviceId,
      parent_device_id: null,
      channel_code: null,
      label: pickName(device),
      room_id: pickRoomId(device),
      context_id: `ctx_consumer_device_${deviceId}`,
      context_version: 1,
    });
  }, [device]);

  function drawerTargetForChannel(gangIndex: number): DrawerConversationTarget {
    const deviceId = String(pickDbId(device) || "").trim();
    const commandCode = normalizeCommandKey(device, state, runtime, gangIndex);
    const channelLabel = `Channel ${gangIndex + 1}`;
    return {
      object_type: "device_channel",
      canonical_id: `${deviceId}:${commandCode}`,
      parent_device_id: deviceId,
      channel_code: commandCode,
      label: `${pickName(device)} · ${channelLabel}`,
      room_id: pickRoomId(device),
      context_id: `${deviceContextId}_${commandCode}`,
      context_version: drawerConversationTarget.context_version + 1,
    };
  }

  function intentHintForPrompt(prompt: string) {
    const lower = prompt.toLowerCase();
    if (/fail|failure|failed|error|timeout|rejected/.test(lower)) return "failure_history";
    if (/diagnos|investigat|check connection|why/.test(lower)) return "diagnosis";
    if (/relationship|what controls|where.*belong|scene|automation|dependencies/.test(lower)) return "relationships";
    if (/activity|history|what happened|recent/.test(lower)) return "activity_history";
    if (/last command|did that work|command/.test(lower)) return "command_outcome";
    if (/working|health|healthy|status|online|offline/.test(lower)) return "health_check";
    if (/what can|capabilit|help/.test(lower)) return "capability";
    return "current_state";
  }

  function makeDrawerIntelligenceContext(target: DrawerConversationTarget) {
    const visibleFetchedAt = new Date().toISOString();
    const scopeEstateId = activeContext.estate_id || user?.estate_id || null;
    const scopeHomeId = activeContext.home_id || user?.home_id || null;
    const runtimeTimestamp = String((runtime as any)?.runtime_timestamp || (runtime as any)?.state_confirmed_at || (runtime as any)?.state_updated_at || (runtime as any)?.updated_at || "");
    const runtimeFreshness = String((runtime as any)?.freshness?.state || (runtime as any)?.freshness || "");
    const channelDefinitions = Array.isArray(intelligenceContext.channel_definitions) ? intelligenceContext.channel_definitions : [];
    const channelStates = Object.fromEntries(switchCommandCodes(device, state, runtime).map((code, index) => [code, typeof values[index] === "boolean" ? (values[index] ? "on" : "off") : "unknown"]));
    const currentState = target.channel_code
      ? String(channelStates[target.channel_code] || "unknown")
      : intelligenceContext.primary_state || null;
    return {
      context_id: target.context_id,
      context_version: target.context_version,
      surface: "consumer",
      module: "device",
      route: "/devices",
      scope: {
        estate_id: scopeEstateId,
        building_id: null,
        home_id: scopeHomeId,
        unit_id: null,
        room_id: target.room_id || pickRoomId(device),
      },
      primary_object: {
        object_type: "device",
        canonical_id: target.parent_device_id || target.canonical_id,
        label: pickName(device),
        privacy_class: isLockRenderer ? "smart_access_private" : "resident_device_private",
        source_module: "devices",
      },
      selected_subobject: target.object_type === "device_channel" ? {
        object_type: "device_channel",
        canonical_id: target.canonical_id,
        label: target.label,
        parent_id: target.parent_device_id,
        metadata: { channel_code: target.channel_code },
      } : null,
      visible_state: {
        source: "device_runtime_v2",
        object_type: target.object_type,
        object_id: target.canonical_id,
        parent_device_id: target.parent_device_id || undefined,
        home_id: scopeHomeId,
        estate_id: scopeEstateId,
        fetched_at: visibleFetchedAt,
        runtime_timestamp: runtimeTimestamp,
        provider_timestamp: String((runtime as any)?.provider_timestamp || (runtime as any)?.last_successful_provider_contact_at || ""),
        data_version: runtimeTimestamp,
        freshness: runtimeFreshness,
        current_state: currentState,
        health: intelligenceContext.health_status || null,
        summary: {
          source: "device_runtime_v2",
          object_id: target.canonical_id,
          canonical_device_id: target.parent_device_id || target.canonical_id,
          parent_device_id: target.parent_device_id,
          device_id: target.parent_device_id || target.canonical_id,
          channel_code: target.channel_code,
          command_key: target.channel_code,
          home_id: scopeHomeId,
          estate_id: scopeEstateId,
          fetched_at: visibleFetchedAt,
          runtime_timestamp: runtimeTimestamp,
          freshness: runtimeFreshness,
          name: pickName(device),
          family: intelligenceContext.device_family || null,
          device_family: intelligenceContext.device_family || null,
          control_profile: intelligenceContext.control_profile || null,
          supported_controls: intelligenceContext.supported_controls || [],
          capability_codes: intelligenceContext.capability_codes || [],
          channel_definitions: channelDefinitions,
          channel_states: channelStates,
          canonical_state: (runtime as any)?.canonical_state || null,
          normalized_state: intelligenceContext.normalized_state || {},
          provider_health: (runtime as any)?.provider_health || null,
          health_status: intelligenceContext.health_status || null,
          provider_ack_is_physical_confirmation: false,
        },
      },
      source: target.object_type === "device_channel" ? "selected_card" : "detail_panel",
      permissions: [],
      ownership: { owner: "resident_home" },
    };
  }

  useEffect(() => {
    const deviceId = String(pickDbId(device) || "").trim();
    if (!deviceId) return;
    const visibleFetchedAt = new Date().toISOString();
    const scopeEstateId = activeContext.estate_id || user?.estate_id || null;
    const scopeHomeId = activeContext.home_id || user?.home_id || null;
    const runtimeTimestamp = String((runtime as any)?.runtime_timestamp || (runtime as any)?.state_confirmed_at || (runtime as any)?.state_updated_at || (runtime as any)?.updated_at || "");
    const runtimeFreshness = String((runtime as any)?.freshness?.state || (runtime as any)?.freshness || "");
    const channelDefinitions = Array.isArray(intelligenceContext.channel_definitions) ? intelligenceContext.channel_definitions : [];
    pushIntelligenceContext({
      context_id: deviceContextId,
      surface: "consumer",
      module: "device",
      route: "/devices",
      scope: {
        estate_id: scopeEstateId,
        building_id: null,
        home_id: scopeHomeId,
        unit_id: null,
        room_id: pickRoomId(device),
      },
      primary_object: {
        object_type: "device",
        canonical_id: deviceId,
        label: pickName(device),
        privacy_class: isLockRenderer ? "smart_access_private" : "resident_device_private",
        source_module: "devices",
      },
      selected_subobject: null,
      visible_state: {
        source: "device_runtime_v2",
        object_type: "device",
        object_id: deviceId,
        home_id: scopeHomeId,
        estate_id: scopeEstateId,
        fetched_at: visibleFetchedAt,
        runtime_timestamp: runtimeTimestamp,
        provider_timestamp: String((runtime as any)?.provider_timestamp || (runtime as any)?.last_successful_provider_contact_at || ""),
        data_version: runtimeTimestamp,
        freshness: runtimeFreshness,
        current_state: intelligenceContext.primary_state || null,
        health: intelligenceContext.health_status || null,
        summary: {
          source: "device_runtime_v2",
          object_id: deviceId,
          canonical_device_id: deviceId,
          home_id: scopeHomeId,
          estate_id: scopeEstateId,
          fetched_at: visibleFetchedAt,
          runtime_timestamp: runtimeTimestamp,
          freshness: runtimeFreshness,
          name: pickName(device),
          family: intelligenceContext.device_family || null,
          device_family: intelligenceContext.device_family || null,
          control_profile: intelligenceContext.control_profile || null,
          supported_controls: intelligenceContext.supported_controls || [],
          capability_codes: intelligenceContext.capability_codes || [],
          channel_definitions: channelDefinitions,
          canonical_state: (runtime as any)?.canonical_state || null,
          normalized_state: intelligenceContext.normalized_state || {},
          provider_health: (runtime as any)?.provider_health || null,
          health_status: intelligenceContext.health_status || null,
          provider_ack_is_physical_confirmation: false,
        },
      },
      source: "detail_panel",
      permissions: [],
      ownership: { owner: "resident_home" },
    });
    return () => popIntelligenceContext(deviceContextId);
  }, [activeContext.estate_id, activeContext.home_id, device, deviceContextId, intelligenceContext.capability_codes, intelligenceContext.channel_definitions, intelligenceContext.control_profile, intelligenceContext.device_family, intelligenceContext.health_status, intelligenceContext.normalized_state, intelligenceContext.primary_state, intelligenceContext.supported_controls, isLockRenderer, popIntelligenceContext, pushIntelligenceContext, runtime, user?.estate_id, user?.home_id]);

  function registerDeviceChannelContext(gangIndex: number) {
    const deviceId = String(pickDbId(device) || "").trim();
    if (!deviceId) return;
    const commandCode = normalizeCommandKey(device, state, runtime, gangIndex);
    const channelLabel = `Channel ${gangIndex + 1}`;
    const visibleFetchedAt = new Date().toISOString();
    const scopeEstateId = activeContext.estate_id || user?.estate_id || null;
    const scopeHomeId = activeContext.home_id || user?.home_id || null;
    const runtimeTimestamp = String((runtime as any)?.runtime_timestamp || (runtime as any)?.state_confirmed_at || (runtime as any)?.state_updated_at || (runtime as any)?.updated_at || "");
    const runtimeFreshness = String((runtime as any)?.freshness?.state || (runtime as any)?.freshness || "");
    const channelDefinitions = Array.isArray(intelligenceContext.channel_definitions) ? intelligenceContext.channel_definitions : [];
    const channelStates = Object.fromEntries(switchCommandCodes(device, state, runtime).map((code, index) => [code, typeof values[index] === "boolean" ? (values[index] ? "on" : "off") : "unknown"]));
    const nextTarget = drawerTargetForChannel(gangIndex);
    setDrawerConversationTarget(nextTarget);
    pushIntelligenceContext({
      context_id: `${deviceContextId}_${commandCode}`,
      surface: "consumer",
      module: "device",
      route: "/devices",
      scope: {
        estate_id: scopeEstateId,
        building_id: null,
        home_id: scopeHomeId,
        unit_id: null,
        room_id: pickRoomId(device),
      },
      primary_object: {
        object_type: "device",
        canonical_id: deviceId,
        label: pickName(device),
        privacy_class: "resident_device_private",
        source_module: "devices",
      },
      selected_subobject: {
        object_type: "device_channel",
        canonical_id: `${deviceId}:${commandCode}`,
        label: `${pickName(device)} · ${channelLabel}`,
        parent_id: deviceId,
        metadata: { channel_code: commandCode, gang_index: gangIndex },
      },
      visible_state: {
        source: "device_runtime_v2",
        object_type: "device_channel",
        object_id: `${deviceId}:${commandCode}`,
        parent_device_id: deviceId,
        home_id: scopeHomeId,
        estate_id: scopeEstateId,
        fetched_at: visibleFetchedAt,
        runtime_timestamp: runtimeTimestamp,
        provider_timestamp: String((runtime as any)?.provider_timestamp || (runtime as any)?.last_successful_provider_contact_at || ""),
        data_version: runtimeTimestamp,
        freshness: runtimeFreshness,
        current_state: typeof values[gangIndex] === "boolean" ? (values[gangIndex] ? "on" : "off") : "unknown",
        health: intelligenceContext.health_status || null,
        summary: {
          source: "device_runtime_v2",
          object_id: `${deviceId}:${commandCode}`,
          parent_device_id: deviceId,
          device_id: deviceId,
          channel_code: commandCode,
          command_key: commandCode,
          home_id: scopeHomeId,
          estate_id: scopeEstateId,
          fetched_at: visibleFetchedAt,
          runtime_timestamp: runtimeTimestamp,
          freshness: runtimeFreshness,
          name: pickName(device),
          family: intelligenceContext.device_family || null,
          device_family: intelligenceContext.device_family || null,
          control_profile: intelligenceContext.control_profile || null,
          supported_controls: intelligenceContext.supported_controls || [],
          capability_codes: intelligenceContext.capability_codes || [],
          channel_definitions: channelDefinitions,
          channel_states: channelStates,
          provider_health: (runtime as any)?.provider_health || null,
          provider_ack_is_physical_confirmation: false,
        },
      },
      source: "selected_card",
      permissions: [],
      ownership: { owner: "resident_home" },
    });
  }

  function handleToggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    registerDeviceChannelContext(gangIndex);
    onToggleGang(device, gangIndex, next);
  }

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    try { recognitionRef.current?.stop?.(); } catch {}
  }, []);

  function stopVoiceCapture() {
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setVoiceMode("idle");
  }

  function startVoiceCapture() {
    if (voiceMode === "recording") {
      stopVoiceCapture();
      return;
    }
    if (typeof window === "undefined") return;
    setVoiceHint("");
    setVoiceLevels(Array.from({ length: 18 }).map((_, index) => 0.22 + (((index * 7) % 14) / 28)));
    setVoiceSeconds(0);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceHint("Voice capture is not available here yet. Type your device request.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const text = Array.from(event?.results || [])
          .map((result: any) => String(result?.[0]?.transcript || ""))
          .join(" ")
          .trim();
        setComposerValue(text);
      };
      recognition.onerror = () => {
        setVoiceHint("I could not hear clearly. Try again or type your request.");
        stopVoiceCapture();
      };
      recognition.onend = () => {
        stopVoiceCapture();
      };
      setVoiceMode("recording");
      timerRef.current = window.setInterval(() => {
        setVoiceSeconds((current) => current + 1);
        setVoiceLevels((current) => [...current.slice(-17), 0.18 + Math.random() * 0.72]);
      }, 1000);
      recognition.start();
    } catch {
      setVoiceHint("Voice capture could not start. Type your device request instead.");
      stopVoiceCapture();
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function restoreDeviceConversation() {
      const estateId = activeContext.estate_id || user?.estate_id || null;
      const homeId = activeContext.home_id || user?.home_id || null;
      const deviceId = String(pickDbId(device) || "").trim();
      setConversationRestoring(true);
      setConversationLines([]);
      setConversationThreadId(null);
      setContextualActions([]);
      try {
        const threads = await oyiService.listThreads({
          surface: "consumer",
          estate_id: estateId,
          home_id: homeId,
          limit: 24,
        });
        if (cancelled) return;
        const match = (threads.threads || []).find((thread) => threadMatchesDevice(thread, device));
        if (!match?.id) return;
        const messages = await oyiService.getThreadMessages(match.id);
        if (cancelled) return;
        setConversationThreadId(match.id);
        setConversationLines(messageLinesFromThread(messages.messages || []));
      } catch {
        if (!cancelled) {
          setConversationThreadId(null);
          setConversationLines([]);
        }
      } finally {
        if (!cancelled) setConversationRestoring(false);
      }
    }
    void restoreDeviceConversation();
    return () => {
      cancelled = true;
    };
  }, [activeContext.contextKey, device, user?.estate_id, user?.home_id]);

  function setSuggestedFollowUps(message: string) {
    const normalized = message.toLowerCase();
    if (/show (?:full )?(?:activity|history)|recent activity|what happened|how many times/.test(normalized)) {
      setContextualActions([
        { label: "Show full history", action: () => onTool("activity", device) },
        { label: "Show failures", action: () => void submitDeviceConversation("Show failures for this selected device.") },
        { label: "Show physical actions", action: () => void submitDeviceConversation("Show manual switch actions for this selected device.") },
        { label: "Show scene activity", action: () => void submitDeviceConversation("Show scene and automation activity for this selected device.") },
      ]);
      return;
    }
    if (/relationship|dependencies|what scenes|what automations/.test(normalized)) {
      setContextualActions([
        { label: "Open automations", action: () => onCreateAutomation(device) },
        { label: "Open scenes", action: () => onCreateScene(device) },
      ]);
      return;
    }
    setContextualActions([]);
  }

  async function handleQuickTimer() {
    if (!timerCode) {
      setConversationLines((current) => [
        ...current,
        { role: "user", content: "Turn off in 20 mins" },
        { role: "assistant", content: "This device does not expose a timer control yet. Use Set schedule or create an automation instead." },
      ]);
      setConversationState("error");
      setContextualActions([
        { label: "Set schedule", action: () => onTool("schedule", device) },
        { label: "Create automation", action: () => onCreateAutomation(device) },
      ]);
      return;
    }
    setConversationState("thinking");
    setConversationLines((current) => [...current, { role: "user", content: "Turn off in 20 mins" }]);
    try {
      await Promise.resolve(onCommand(device, { [timerCode]: 20 * 60, timer_action: "off" }, { [timerCode]: 20 * 60 }));
      setConversationLines((current) => [
        ...current,
        { role: "assistant", content: "Timer accepted. Oyi will confirm when it is scheduled." },
      ]);
      setConversationState("done");
      setContextualActions([
        { label: "Show activity", action: () => void submitDeviceConversation("Show activity for this selected device.") },
        { label: "Set schedule", action: () => onTool("schedule", device) },
      ]);
    } catch {
      setConversationLines((current) => [
        ...current,
        { role: "assistant", content: "I could not set that timer right now. Try again in a moment." },
      ]);
      setConversationState("error");
    }
  }

  async function submitDeviceConversation(prompt: string) {
    const message = String(prompt || "").trim();
    if (!message || busy) return;
    const targetContract = drawerConversationTarget.canonical_id ? drawerConversationTarget : {
      object_type: "device" as const,
      canonical_id: String(pickDbId(device) || "").trim(),
      parent_device_id: null,
      channel_code: null,
      label: pickName(device),
      room_id: pickRoomId(device),
      context_id: deviceContextId,
      context_version: 1,
    };
    const activeDrawerContext = makeDrawerIntelligenceContext(targetContract);
    const intentHint = intentHintForPrompt(message);
    const submittedTarget = {
      target_type: targetContract.object_type,
      target_id: targetContract.canonical_id,
      open_as: "page" as const,
      action: "inspect" as const,
    };
    const submittedObject = {
      object_type: targetContract.object_type,
      canonical_id: targetContract.canonical_id,
      label: targetContract.label,
      estate_id: activeContext.estate_id || user?.estate_id || null,
      home_id: activeContext.home_id || user?.home_id || null,
      room_id: targetContract.room_id || pickRoomId(device),
      parent_id: targetContract.parent_device_id,
      source_module: "devices",
      capabilities: Array.isArray(intelligenceContext.supported_controls) ? intelligenceContext.supported_controls : [],
      current_state: activeDrawerContext.visible_state?.current_state || intelligenceContext.primary_state || null,
      health: intelligenceContext.health_status || null,
      relationships: intelligenceContext.relationships || {},
      metadata: {
        control_profile: intelligenceContext.control_profile || null,
        channel_code: targetContract.channel_code,
        immutable_drawer_target: targetContract,
        visible_state: activeDrawerContext.visible_state,
      },
    };
    if (process.env.NODE_ENV !== "production") {
      console.debug("[oyi-device-conversation-target]", {
        visible_target_id: drawerConversationTarget.canonical_id,
        submitted_target_id: targetContract.canonical_id,
        channel_code: targetContract.channel_code,
        target_consistency: drawerConversationTarget.canonical_id === targetContract.canonical_id ? "matched" : "repaired_before_submit",
      });
    }
    stopVoiceCapture();
    setComposerValue("");
    setConversationState("thinking");
    setContextualActions([]);
    setConversationLines((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "Understanding…" }]);
    const thinkingStages = ["Understanding…", "Checking device…", "Applying context…"];
    const stageTimers: number[] = [];
    thinkingStages.slice(1).forEach((stage, index) => {
      stageTimers.push(window.setTimeout(() => {
        setConversationLines((current) => {
          const next = [...current];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i]?.role === "assistant") {
              next[i] = { role: "assistant", content: stage };
              break;
            }
          }
          return next;
        });
      }, 700 * (index + 1)));
    });
    try {
      const response = await aiService.chat(message, {
        surface: "consumer",
        module: "device_drawer",
        thread_id: conversationThreadId || undefined,
        estate_id: activeContext.estate_id || user?.estate_id || null,
        home_id: activeContext.home_id || user?.home_id || null,
        operational_object: submittedObject,
        target: submittedTarget,
        intent_hint: intentHint,
        operation_class_hint: "read",
        scope_mode_hint: "exact_target",
        active_intelligence_context: activeDrawerContext,
        device_id: targetContract.parent_device_id || pickDbId(device),
        device_name: pickName(device),
        room_id: targetContract.room_id || pickRoomId(device),
        room_name: pickRoomName(device),
        control_profile: intelligenceContext.control_profile,
        primary_state: intelligenceContext.primary_state,
        health_status: intelligenceContext.health_status,
        supported_controls: intelligenceContext.supported_controls,
        channel_definitions: intelligenceContext.channel_definitions,
        memory_summary: intelligenceContext.memory_summary,
        relationships: intelligenceContext.relationships,
        predictive_findings: intelligenceContext.predictive_findings,
        recent_executions: intelligenceContext.recent_executions,
        active_scenes: intelligenceContext.active_scenes,
        active_automations: intelligenceContext.active_automations,
        conversation_context: {
          ...(intelligenceContext.conversation_context || {}),
          active_context: activeDrawerContext,
          context_id: activeDrawerContext.context_id,
          context_version: activeDrawerContext.context_version,
          selected_subobject: activeDrawerContext.selected_subobject,
          visible_state: activeDrawerContext.visible_state,
          immutable_drawer_target: targetContract,
          intent_hint: intentHint,
          operation_class_hint: "read",
          scope_mode_hint: "exact_target",
        },
      });
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      if (response.thread_id) setConversationThreadId(String(response.thread_id));
      setConversationLines((current) => {
        const next = [...current];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i]?.role === "assistant") {
            next[i] = { role: "assistant", content: String(response.reply || "Done.") };
            return next;
          }
        }
        next.push({ role: "assistant", content: String(response.reply || "Done.") });
        return next;
      });
      setConversationState(response.intent === "error" ? "error" : "done");
      setSuggestedFollowUps(message);
    } catch {
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      setConversationLines((current) => {
        const next = [...current];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i]?.role === "assistant") {
            next[i] = { role: "assistant", content: "I couldn’t complete that right now. Try again in a moment." };
            return next;
          }
        }
        next.push({ role: "assistant", content: "I couldn’t complete that right now. Try again in a moment." });
        return next;
      });
      setConversationState("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      const dbId = pickDbId(device);
      if (!dbId || baseRenderer !== "ir") return;
      try {
        const result = await deviceService.getIrProfiles(String(dbId));
        if (!cancelled) setIrOptions(Array.isArray(result?.available_profiles) ? result.available_profiles : []);
      } catch {
        if (!cancelled) setIrOptions([]);
      }
    }
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [baseRenderer, device]);
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(10px+var(--sab))]">
        <section className="mx-auto flex max-h-[min(88dvh,720px)] max-w-[430px] flex-col overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex shrink-0 justify-center pt-3"><div className="h-1 w-10 rounded-full bg-white/18" /></div>
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-[-0.04em] text-white">{pickName(device)}</h2>
              <p className="mt-1 truncate text-xs text-white/46">{pickRoomName(device) || "Unassigned"} • {displayState(device, state, runtime)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onCreateScene(device)} className="grid h-8 w-8 place-items-center rounded-full border border-sky-300/14 bg-sky-400/10 text-sky-100" aria-label="Create scene with this device"><Star className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60" aria-label="Close device controls"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
            <section className="pb-4">
              <p className="text-[17px] font-semibold tracking-[-0.04em] text-white">
                {latestAssistantLine ? responseSurface.headline : awarenessMessage.headline}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-white/74">
                {latestAssistantLine ? responseSurface.body || awarenessMessage.body : awarenessMessage.body}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/46">
                {latestAssistantLine ? `Device · ${pickName(device)}${latestUserLine ? ` · ${latestUserLine}` : ""}` : awarenessMessage.support}
              </p>
            </section>
            {needsIrProfile ? <IRProfilePicker options={irOptions} onSelect={(profile) => { setSelectedIrProfile(profile); onBindIrAppliance(device, profile); }} /> : null}
            {renderer === "tv" ? <TVRenderer device={device} runtime={runtime} busy={busy} onPower={onPower} onCommand={onCommand} /> : null}
            {renderer === "ac" ? <ACRenderer device={device} state={state} runtime={runtime} busy={busy} onCommand={onCommand} /> : null}
            {renderer === "socket" ? <SocketRenderer device={device} state={state} runtime={runtime} caps={caps} gangCount={gangCount} values={values} switchCommands={switchCommands} busy={busy} onToggleGang={handleToggleGang} /> : null}
            {renderer === "ir" && !needsIrProfile ? <IRRenderer device={device} state={state} runtime={runtime} busy={busy} onPower={onPower} onCommand={onCommand} /> : null}
            {renderer === "lock" ? <DoorPanel deviceId={String(pickDbId(device) || "")} lastUpdated={runtimeLastUpdatedAt(runtime) || undefined} onInteraction={() => {}} /> : null}
            {renderer === "switch" ? <SwitchRenderer device={device} state={state} runtime={runtime} caps={caps} gangCount={gangCount} values={values} switchCommands={switchCommands} busy={busy} onToggleGang={handleToggleGang} /> : null}
            {renderer === "unsupported" ? <UnsupportedDeviceRenderer device={device} runtime={runtime} /> : null}
            {conversationRestoring ? <p className="mt-3 text-xs text-white/40">Restoring recent device conversation…</p> : null}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(contextualActions.length ? contextualActions : isLockRenderer ? [
                { label: "Show activity", action: () => void submitDeviceConversation("Show activity for this selected lock.") },
                { label: "Check lock health", action: () => void submitDeviceConversation("Check this lock health and battery.") },
                { label: "View access events", action: () => void submitDeviceConversation("Show access events for this selected lock.") },
                { label: "View relationships", action: () => void submitDeviceConversation("What controls this lock and where does it belong?") },
              ] : [
                { label: "Check status", action: () => void submitDeviceConversation(`What is the current status of ${pickName(device)}?`) },
                { label: "Show activity", action: () => void submitDeviceConversation("Show activity for this selected device.") },
                { label: "Turn off in 20 mins", action: () => void handleQuickTimer() },
                { label: "Set schedule", action: () => onTool("schedule", device) },
                { label: "Rename device", action: () => onTool("settings", device) },
                { label: "Create automation", action: () => onCreateAutomation(device) },
                { label: "Check connection", action: () => void submitDeviceConversation("Diagnose this selected device.") },
                { label: "View relationships", action: () => void submitDeviceConversation("View relationships for this selected device.") },
              ]).map((item) => (
                <button key={item.label} type="button" onClick={item.action} className="shrink-0 rounded-full border border-sky-200/15 bg-sky-400/[0.07] px-3 py-1.5 text-[11px] font-medium text-sky-100/84 transition active:scale-95">
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <OyiComposerRow
                value={composerValue}
                onChange={setComposerValue}
                onSend={() => void submitDeviceConversation(composerValue)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (composerValue.trim() && conversationState !== "thinking") void submitDeviceConversation(composerValue);
                  }
                }}
                onMicClick={startVoiceCapture}
                micActive={voiceMode === "recording"}
                micDisabled={conversationState === "thinking"}
                micIcon={voiceMode === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                sendIcon={<ArrowUp className="h-4 w-4" />}
                disabled={conversationState === "thinking"}
                placeholder="Ask Oyi about this device…"
              />
              {voiceMode === "recording" ? (
                <div className="mt-2 flex items-center gap-2 px-1">
                  <ComposerWaveform active levels={voiceLevels} />
                  <span className="shrink-0 text-[11px] text-sky-100/74">{voiceSeconds}s</span>
                </div>
              ) : null}
              {voiceHint ? <p className="mt-2 text-[11px] text-white/42">{voiceHint}</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function UnsupportedDeviceRenderer({ device, runtime }: { device: AnyDevice; runtime?: Partial<DeviceRuntimeContract> | null }) {
  const family = String(normalizeRuntimeContract(device, runtime).device_family || inferFamily(device));
  const profile = controlProfileLabel(runtime?.control_profile, "Standard");
  const isRemoteLike = family === "remote" || /ir|infrared|remote/i.test(`${device?.category || ""} ${device?.type || ""} ${device?.name || ""} ${JSON.stringify(device?.metadata || {})}`);
  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-4">
      <div className="text-sm font-semibold text-white">{isRemoteLike ? "Device profile required" : "Control profile unavailable"}</div>
      <p className="mt-2 text-xs leading-5 text-white/46">
        {isRemoteLike ? "Choose or sync the IR profile before Oyi shows remote controls for this device." : `Oyi has not unlocked a safe ${profile.toLowerCase()} control surface for this device yet.`}
      </p>
    </div>
  );
}

function IRProfilePicker({ options, onSelect }: { options?: IrProfileOption[]; onSelect: (profile: IrProfile) => void }) {
  const profiles: Array<{ key: IrProfile; label: string }> = (
    Array.isArray(options) && options.length
      ? options
          .map((option) => ({ key: String(option.key) as IrProfile, label: String(option.label || option.key) }))
          .filter((option) => option.key)
      : []
  );
  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-4">
      <div className="text-sm font-semibold text-white">Choose remote profile</div>
      <p className="mt-1 text-xs leading-5 text-white/44">
        {profiles.length
          ? "Select the exact appliance profile the connected provider exposed for this hub."
          : "The connected provider has not exposed any configured appliance profiles for this hub yet."}
      </p>
      {profiles.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {profiles.map((profile) => (
            <button key={profile.key} type="button" onClick={() => onSelect(profile.key)} className="rounded-[16px] border border-sky-300/14 bg-sky-400/10 px-3 py-3 text-sm font-semibold text-sky-100 transition active:scale-[0.98]">
              {profile.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-3 text-xs leading-5 text-white/52">
          Sync the configured Smart Life remotes first, then return to import only the supported appliance profiles for this hub.
        </div>
      )}
    </div>
  );
}

function SwitchRenderer({ device, state, runtime, caps, gangCount, values, switchCommands, busy, onToggleGang }: { device: AnyDevice; state: any; runtime?: Partial<DeviceRuntimeContract> | null; caps: ReturnType<typeof uiCapabilities>; gangCount: number; values: Array<boolean | null>; switchCommands?: Record<string, SwitchChannelCommandState>; busy: boolean; onToggleGang: (device: AnyDevice, gangIndex: number, next: boolean) => void }) {
  const safeGangCount = Math.min(3, Math.max(1, gangCount)) as 1 | 2 | 3;
  const sid = String(pickDbId(device) || "");
  const desiredValues: Array<boolean | null | undefined> = [];
  const pendingKeys: Record<number, boolean> = {};
  const issues: string[] = [];
  let pendingOnCount = 0;
  let pendingOffCount = 0;
  for (let i = 0; i < safeGangCount; i += 1) {
    const code = normalizeCommandKey(device, state, runtime, i);
    const pending = sid ? switchCommands?.[switchStateKey(sid, code)] : null;
    if (pending && ["queued", "dispatching", "awaiting_confirmation", "pending"].includes(pending.command_status)) {
      desiredValues[i] = typeof pending.latest_desired_state === "boolean" ? pending.latest_desired_state : pending.desired_state;
      pendingKeys[i] = true;
      if (desiredValues[i] === true) pendingOnCount += 1;
      if (desiredValues[i] === false) pendingOffCount += 1;
    } else if (pending && (pending.command_status === "failed" || pending.command_status === "timed_out" || pending.command_status === "timeout" || pending.command_status === "mismatch" || pending.command_status === "uncertain")) {
      desiredValues[i] = pending.confirmed_state;
      issues.push(`Channel ${i + 1}: ${pending.error || (pending.command_status === "timed_out" || pending.command_status === "timeout" ? "confirmation timed out" : "command failed")}`);
    }
  }
  const confirmedOnCount = values.slice(0, safeGangCount).filter((value, index) => value === true && !pendingKeys[index]).length;
  const changingCount = Object.keys(pendingKeys).length;
  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Controls</div>
          <div className="text-[11px] text-white/45">
            {changingCount ? `${confirmedOnCount} confirmed on · ${changingCount} changing` : `${values.slice(0, safeGangCount).filter((value) => value === true).length} of ${safeGangCount} confirmed on`}
          </div>
        </div>
        {caps.canSwitch ? <GangRingSwitch gangCount={safeGangCount} online={isOnline(device, runtime)} values={values} desiredValues={desiredValues} pendingKeys={pendingKeys} busy={busy} onToggleGang={(gangIndex, next) => onToggleGang(device, gangIndex, next)} size={safeGangCount === 1 ? 88 : 70} /> : null}
        {changingCount ? <p className="mt-3 text-xs text-amber-100/75">Changing… {pendingOnCount ? `${pendingOnCount} pending on` : ""}{pendingOnCount && pendingOffCount ? " · " : ""}{pendingOffCount ? `${pendingOffCount} pending off` : ""}. Waiting for provider/state confirmation.</p> : null}
        {issues.length ? (
          <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100/85">
            {issues.map((issue) => <p key={issue}>{issue}</p>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SocketRenderer(props: Parameters<typeof SwitchRenderer>[0]) {
  return <SwitchRenderer {...props} gangCount={1} />;
}

function ACRenderer({ device, state, runtime, busy, onCommand }: { device: AnyDevice; state: any; runtime?: Partial<DeviceRuntimeContract> | null; busy: boolean; onCommand: (device: AnyDevice, command: Record<string, any>, optimisticPatch?: Record<string, any>) => Promise<void> | void }) {
  const temp = readTemperature(state, runtime);
  const supported = Array.isArray(runtime?.supported_controls) ? runtime.supported_controls.map((item) => String(item).toLowerCase()) : [];
  const powerCode = commandCodeFor(device, [/^power$/, /power_switch/, /power_state/]);
  const canPower = Boolean(powerCode || supported.includes("power"));
  const tempCode = commandCodeFor(device, [/temp_set/, /temperature/, /^temp$/]);
  const modeCode = commandCodeFor(device, [/^mode$/, /work_mode/]);
  const fanCode = commandCodeFor(device, [/fan/, /wind_speed/, /windspeed/]);
  const swingCode = commandCodeFor(device, [/swing/, /shake/, /oscillat/]);
  const modes = [["cool", "Cool", Snowflake], ["heat", "Heat", Flame], ["dry", "Dry", Moon], ["fan", "Fan", Fan], ["auto", "Auto", Thermometer]] as const;
  const fanSpeeds = ["low", "medium", "high", "auto"] as const;
  const currentTemp = Number(String(temp || "").replace(/[^\d]/g, "")) || 24;
  const currentPower = readPowerState(state, runtime);
  const nextPower = currentPower === null ? true : !currentPower;
  const sendAc = (command: Record<string, any>, patch?: Record<string, any>) => {
    void Promise.resolve(onCommand(device, command, patch)).catch(() => undefined);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-[28px] border border-sky-300/12 bg-[radial-gradient(circle_at_top,#0f3550_0%,rgba(6,12,22,0.74)_48%,rgba(255,255,255,0.035)_100%)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-sky-100/44">Climate</div>
            <div className="mt-1 text-4xl font-semibold tracking-[-0.08em] text-white">{temp || "—"}<span className="text-lg text-white/42">°C</span></div>
            <div className="mt-1 text-xs text-white/42">Supported range 16°C – 30°C</div>
          </div>
          {canPower ? <button type="button" disabled={busy || isOnline(device, runtime) === false} onClick={() => sendAc({ type: "ac_remote", power: nextPower }, { power: nextPower, ...(powerCode ? { [powerCode]: nextPower } : {}) })} className="grid h-14 w-14 place-items-center rounded-full border border-sky-300/22 bg-sky-400/12 text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.18)]" aria-label="Power">
            <Power className="h-5 w-5" />
          </button> : null}
        </div>
        {tempCode ? <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <RemoteKey icon={Minus} label="Temp -" enabled onClick={() => sendAc({ type: "ac_remote", temperature: Math.max(16, currentTemp - 1) }, { [tempCode]: Math.max(16, currentTemp - 1), temperature: Math.max(16, currentTemp - 1) })} />
          <div className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-2 text-center text-[11px] text-white/46">16°C – 30°C</div>
          <RemoteKey icon={Plus} label="Temp +" enabled onClick={() => sendAc({ type: "ac_remote", temperature: Math.min(30, currentTemp + 1) }, { [tempCode]: Math.min(30, currentTemp + 1), temperature: Math.min(30, currentTemp + 1) })} />
        </div> : null}
      </div>
      {modeCode ? <ControlGroup title="Mode">{modes.map(([key, label, Icon]) => <RemoteKey key={key} icon={Icon} label={label} enabled onClick={() => sendAc({ type: "ac_remote", mode: key }, { [modeCode]: key })} />)}</ControlGroup> : null}
      {fanCode ? <ControlGroup title="Fan">{fanSpeeds.map((speed) => <RemoteKey key={speed} icon={Wind} label={speed[0].toUpperCase() + speed.slice(1)} enabled onClick={() => sendAc({ type: "ac_remote", fan_speed: speed }, { [fanCode]: speed, fan_speed: speed })} />)}</ControlGroup> : null}
      {swingCode ? <ControlGroup title="Swing"><RemoteKey icon={ChevronUp} label="Swing" enabled onClick={() => sendAc({ type: "ac_remote", swing: true }, { [swingCode]: true, swing: true })} /></ControlGroup> : null}
    </div>
  );
}

function TVRenderer({ device, runtime, onPower, onCommand }: { device: AnyDevice; runtime?: Partial<DeviceRuntimeContract> | null; busy: boolean; onPower: (device: AnyDevice) => void; onCommand: (device: AnyDevice, command: Record<string, any>, optimisticPatch?: Record<string, any>) => Promise<void> | void }) {
  const caps = uiCapabilities(device, runtime);
  const providerButtons = tvRemoteButtonMap(device);
  const exposedKeys = new Set(caps.tv);
  const supports = (...keys: string[]) => {
    if (providerButtons.size) return keys.some((key) => providerButtons.has(key));
    return !exposedKeys.size || keys.some((key) => exposedKeys.has(key));
  };
  const switchPower = canSwitchDevice(device, runtime);
  const canShow = (key: string, ...aliases: string[]) => supports(key, ...aliases);
  const canSend = (key: string, ...aliases: string[]) => supports(key, ...aliases);
  const [remoteStatus, setRemoteStatus] = useState<"idle" | "sending" | "acknowledged" | "rejected">("idle");
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const sendKey = async (key: string) => {
    const definition = providerButtons.get(key);
    setRemoteStatus("sending");
    setRemoteError(null);
    try {
      await Promise.resolve(onCommand(device, {
        type: "tv_remote",
        key: definition?.providerKey || key,
        command_key: key,
        provider_key: definition?.providerKey || undefined,
        key_id: definition?.keyId ?? undefined,
      }));
      setRemoteStatus("acknowledged");
    } catch (error: any) {
      const body = error?.response?.data || {};
      setRemoteError(body.safe_error_message || body.details || body.error || error?.message || "This remote command could not be completed.");
      setRemoteStatus("rejected");
    } finally {
      window.setTimeout(() => setRemoteStatus("idle"), 900);
    }
  };
  const canPower = switchPower || canShow("power");
  const canSendPower = switchPower || canSend("power");
  const hasNavigation = canShow("up") || canShow("down") || canShow("left") || canShow("right") || canShow("ok", "enter", "select");
  const hasSystem = canShow("home") || canShow("back", "return") || canShow("menu") || canShow("source", "input");
  const hasVolume = canShow("volume_up", "vol_up") || canShow("volume_down", "vol_down");
  const hasChannel = canShow("channel_up", "ch_up") || canShow("channel_down", "ch_down");
  const hasMedia = canShow("play_pause", "play", "pause");
  const powerClick = () => {
    if (switchPower) onPower(device);
    else void sendKey("power");
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2">
        <span className="text-[11px] text-white/42">IR dispatch</span>
        <span className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium",
          remoteStatus === "sending" && "text-amber-200",
          remoteStatus === "acknowledged" && "text-emerald-200",
          remoteStatus === "rejected" && "text-red-200",
          remoteStatus === "idle" && "text-white/42",
        )}>
          <span className={cn(
            "h-2 w-2 rounded-full",
            remoteStatus === "sending" && "bg-amber-300",
            remoteStatus === "acknowledged" && "bg-emerald-300",
            remoteStatus === "rejected" && "bg-red-300",
            remoteStatus === "idle" && "bg-white/28",
          )} />
          {remoteStatus === "sending" ? "Sending" : remoteStatus === "acknowledged" ? "Provider acknowledged" : remoteStatus === "rejected" ? "Unavailable" : "Idle"}
        </span>
      </div>
      {remoteError ? <p className="rounded-[18px] border border-red-300/16 bg-red-400/[0.08] px-3 py-2 text-xs leading-5 text-red-100/86">{remoteError}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {canPower ? <TvRemoteKey icon={Power} label="Power" enabled={isOnline(device, runtime) !== false && canSendPower} onClick={powerClick} /> : null}
        {canShow("mute") ? <TvRemoteKey icon={VolumeX} label="Mute" enabled={canSend("mute")} onClick={() => void sendKey("mute")} /> : null}
      </div>
      {hasNavigation ? <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-3">
        <div className="mb-2 text-center text-[11px] uppercase tracking-[0.2em] text-white/34">Navigation</div>
        <div className="mx-auto grid max-w-[228px] grid-cols-3 gap-2">
          <span />
          {canShow("up") ? <TvRemoteKey large icon={ChevronUp} label="Up" enabled={canSend("up")} onClick={() => void sendKey("up")} /> : <span />}
          <span />
          {canShow("left") ? <TvRemoteKey large icon={ChevronLeft} label="Left" enabled={canSend("left")} onClick={() => void sendKey("left")} /> : <span />}
          {canShow("ok", "enter", "select") ? <TvRemoteKey large primary icon={Check} label="OK" enabled={canSend("ok", "enter", "select")} onClick={() => void sendKey("ok")} /> : <span />}
          {canShow("right") ? <TvRemoteKey large icon={ChevronRight} label="Right" enabled={canSend("right")} onClick={() => void sendKey("right")} /> : <span />}
          <span />
          {canShow("down") ? <TvRemoteKey large icon={ChevronDown} label="Down" enabled={canSend("down")} onClick={() => void sendKey("down")} /> : <span />}
          <span />
        </div>
        <p className="mt-2 text-center text-[10px] leading-4 text-white/34">Provider acknowledgement confirms dispatch, not physical TV state.</p>
      </div> : null}
      {hasSystem ? <TvControlGroup title="System">
        {canShow("home") ? <TvRemoteKey icon={Home} label="Home" enabled={canSend("home")} onClick={() => void sendKey("home")} /> : null}
        {canShow("back", "return") ? <TvRemoteKey icon={ChevronLeft} label="Back" enabled={canSend("back", "return")} onClick={() => void sendKey("back")} /> : null}
        {canShow("menu") ? <TvRemoteKey icon={SlidersHorizontal} label="Menu" enabled={canSend("menu")} onClick={() => void sendKey("menu")} /> : null}
        {canShow("source", "input") ? <TvRemoteKey icon={ChevronRight} label="Source" enabled={canSend("source", "input")} onClick={() => void sendKey("source")} /> : null}
      </TvControlGroup> : null}
      {hasVolume || hasChannel ? <div className="grid grid-cols-2 gap-2">
        {hasVolume ? <TvControlGroup title="Volume">
          {canShow("volume_up", "vol_up") ? <TvRemoteKey icon={Plus} label="Vol +" enabled={canSend("volume_up", "vol_up")} onClick={() => void sendKey("volume_up")} /> : null}
          {canShow("volume_down", "vol_down") ? <TvRemoteKey icon={Minus} label="Vol -" enabled={canSend("volume_down", "vol_down")} onClick={() => void sendKey("volume_down")} /> : null}
        </TvControlGroup> : null}
        {hasChannel ? <TvControlGroup title="Channel">
          {canShow("channel_up", "ch_up") ? <TvRemoteKey icon={Plus} label="Ch +" enabled={canSend("channel_up", "ch_up")} onClick={() => void sendKey("channel_up")} /> : null}
          {canShow("channel_down", "ch_down") ? <TvRemoteKey icon={Minus} label="Ch -" enabled={canSend("channel_down", "ch_down")} onClick={() => void sendKey("channel_down")} /> : null}
        </TvControlGroup> : null}
      </div> : null}
      {hasMedia ? <TvControlGroup title="Media">
        <TvRemoteKey icon={Play} label="Play/Pause" enabled={canSend("play_pause", "play", "pause")} onClick={() => void sendKey("play_pause")} />
      </TvControlGroup> : null}
    </div>
  );
}

function TvControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.17em] text-white/34">{title}</div>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function TvRemoteKey({ icon: Icon, label, enabled, busy, large, primary, onClick }: { icon: any; label: string; enabled: boolean; busy?: boolean; large?: boolean; primary?: boolean; onClick?: () => void }) {
  const [feedback, setFeedback] = useState<"idle" | "success" | "failure">("idle");
  async function press() {
    if (!enabled || busy || !onClick) return;
    setFeedback("idle");
    try {
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      onClick();
      setFeedback("success");
    } catch {
      setFeedback("failure");
    } finally {
      window.setTimeout(() => setFeedback("idle"), 520);
    }
  }
  return (
    <button type="button" disabled={!enabled || busy || !onClick} onClick={press} className={cn("rounded-[14px] border px-2 text-center transition duration-200", large ? "min-h-[58px] py-2.5" : "min-h-10 py-1.5", enabled && onClick ? "border-sky-300/18 bg-sky-400/10 text-sky-100 shadow-[0_0_0_rgba(56,189,248,0)] active:scale-95 active:shadow-[0_0_22px_rgba(56,189,248,0.34)]" : "border-white/[0.08] bg-white/[0.04] text-white/56", primary && "border-white/18 bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.16)]", busy && "animate-pulse", feedback === "success" && "border-emerald-300/30 bg-emerald-400/12 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.26)]", feedback === "failure" && "border-red-300/30 bg-red-400/12 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.24)]")} title={label} aria-label={label}>
      <Icon className={cn("mx-auto transition-transform duration-200", large ? "h-5 w-5" : "h-3.5 w-3.5", feedback === "success" && "scale-110", busy && "animate-pulse")} />
      <span className="mt-1 block text-[10px]">{label}</span>
    </button>
  );
}

function IRRenderer({ device, state, runtime, busy, onPower, onCommand }: { device: AnyDevice; state: any; runtime?: Partial<DeviceRuntimeContract> | null; busy: boolean; onPower: (device: AnyDevice) => void; onCommand: (device: AnyDevice, command: Record<string, any>, optimisticPatch?: Record<string, any>) => void }) {
  const profile = learnedIrTemplate(device);
  if (profile === "ac") return <ACRenderer device={device} state={state} runtime={runtime} busy={busy} onCommand={onCommand} />;
  return <TVRenderer device={device} runtime={runtime} busy={busy} onPower={onPower} onCommand={onCommand} />;
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/34">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function RemoteKey({ icon: Icon, label, enabled, busy, onClick }: { icon: any; label: string; enabled: boolean; busy?: boolean; onClick?: () => void }) {
  const [feedback, setFeedback] = useState<"idle" | "success" | "failure">("idle");
  async function press() {
    if (!enabled || busy || !onClick) return;
    setFeedback("idle");
    try {
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      onClick();
      setFeedback("success");
    } catch {
      setFeedback("failure");
    } finally {
      window.setTimeout(() => setFeedback("idle"), 520);
    }
  }
  return (
    <button type="button" disabled={!enabled || busy || !onClick} onClick={press} className={cn("min-h-12 rounded-[16px] border px-2 py-2 text-center transition duration-200", enabled && onClick ? "border-sky-300/18 bg-sky-400/10 text-sky-100 active:scale-95 active:shadow-[0_0_22px_rgba(56,189,248,0.34)]" : "border-white/[0.08] bg-white/[0.04] text-white/56", busy && "animate-pulse", feedback === "success" && "border-emerald-300/30 bg-emerald-400/12 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.26)]", feedback === "failure" && "border-red-300/30 bg-red-400/12 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.24)]")} title={label}>
      <Icon className={cn("mx-auto h-3.5 w-3.5 transition-transform duration-200", feedback === "success" && "scale-110", busy && "animate-pulse")} />
      <span className="mt-1 block text-[10px]">{label}</span>
    </button>
  );
}

function DeviceToolSheet({ kind, device, runtime, executionHistory, busy, onClose, onTimer, onSchedule, onSettings }: { kind: DeviceTool; device: AnyDevice; runtime?: Partial<DeviceRuntimeContract> | null; executionHistory?: any[]; busy: boolean; onClose: () => void; onTimer: (command: Record<string, any>, patch?: Record<string, any>) => void; onSchedule: (input: { time: string; days: string[]; repeat: boolean; power: "on" | "off" }) => void; onSettings: (input: { favorite?: boolean; room: string }) => void }) {
  const timerCode = commandCodeFor(device, [/countdown/, /timer/]);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [timerAction, setTimerAction] = useState<"on" | "off">("off");
  const [time, setTime] = useState("19:00");
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [schedulePower, setSchedulePower] = useState<"on" | "off">("on");
  const [favorite, setFavorite] = useState(isFavoriteDevice(device));
  const [room, setRoom] = useState(pickRoomName(device) || "");
  const detailsRows = useMemo(() => friendlyStateRows(device, device?.state || {}, runtime), [device, runtime]);
  const timelineEntries = useMemo(() => buildDeviceTimelineEntries(device, executionHistory || [], runtime), [device, executionHistory, runtime]);
  const title = kind === "timer" ? "Timer" : kind === "schedule" ? "Schedule" : kind === "activity" ? "Device Activity" : "Settings";
  const dayOptions = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]] as const;

  function toggleDay(day: string) {
    setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md">
      <button className="absolute inset-0" onClick={onClose} aria-label={`Close ${title}`} />
      <section className="relative w-full max-w-[410px] rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-100/48">{title}</div>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em] text-white">{pickName(device)}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button>
        </div>

        {kind === "timer" && timerCode ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[5, 30, 60].map((mins) => <button key={mins} type="button" onClick={() => setTimerMinutes(mins)} className={cn("rounded-[16px] border px-3 py-3 text-sm font-semibold", timerMinutes === mins ? "border-sky-300/35 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.03] text-white/58")}>{mins < 60 ? `${mins}m` : "1h"}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["off", "on"] as const).map((value) => <button key={value} type="button" onClick={() => setTimerAction(value)} className={cn("rounded-full border px-3 py-2 text-xs font-semibold uppercase", timerAction === value ? "border-sky-300/45 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.03] text-white/54")}>Auto {value}</button>)}
            </div>
            <button type="button" disabled={busy} onClick={() => onTimer({ [timerCode]: timerMinutes * 60, timer_action: timerAction }, { [timerCode]: timerMinutes * 60 })} className="h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-45">{busy ? "Saving..." : `Turn ${timerAction} after ${timerMinutes < 60 ? `${timerMinutes} mins` : "1 hour"}`}</button>
          </div>
        ) : null}

        {kind === "schedule" ? (
          <div className="mt-4 space-y-3">
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-11 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-white outline-none" />
            <div className="grid grid-cols-7 gap-1.5">
              {dayOptions.map(([key, label]) => <button key={key} type="button" onClick={() => toggleDay(key)} className={cn("rounded-full border px-2 py-2 text-[11px] font-semibold", days.includes(key) ? "border-sky-300/35 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.03] text-white/48")}>{label}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["on", "off"] as const).map((value) => <button key={value} type="button" onClick={() => setSchedulePower(value)} className={cn("rounded-full border px-3 py-2 text-xs font-semibold uppercase", schedulePower === value ? "border-sky-300/45 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.03] text-white/54")}>{value}</button>)}
            </div>
            <button type="button" disabled={busy || !days.length} onClick={() => onSchedule({ time, days, repeat: true, power: schedulePower })} className="h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-45">{busy ? "Saving..." : "Save schedule"}</button>
          </div>
        ) : null}

        {kind === "activity" ? (
          <div className="mt-4 space-y-3">
            {timelineEntries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", entry.tone === "failed" ? "bg-rose-300" : entry.tone === "attention" ? "bg-amber-300" : "bg-emerald-300")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/88">{entry.title}</p>
                  {entry.subtitle ? <p className="mt-0.5 text-xs text-white/46">{entry.subtitle}</p> : null}
                  <p className="mt-0.5 text-[11px] text-white/34">{entry.time}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {kind === "settings" ? (
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-3 py-3">
              <span><span className="block text-sm font-semibold text-white">Favorite</span><span className="mt-0.5 block text-xs text-white/42">Show in Home quick controls.</span></span>
              <button type="button" onClick={() => setFavorite((value) => !value)} className={cn("h-7 w-12 rounded-full border p-0.5 transition", favorite ? "border-sky-300/35 bg-sky-400/30" : "border-white/[0.1] bg-white/[0.04]")}><span className={cn("block h-5 w-5 rounded-full bg-white transition", favorite && "translate-x-5")} /></button>
            </label>
            <input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Room name" className="h-11 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-white outline-none placeholder:text-white/34" />
            <div className="space-y-2">
              {detailsRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 rounded-[16px] border border-white/[0.05] bg-black/10 px-3 py-2.5">
                  <span className="text-xs text-white/42">{row.label}</span>
                  <span className="max-w-[58%] truncate text-right text-sm text-white/82">{row.value}</span>
                </div>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => onSettings({ favorite, room })} className="h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-45">{busy ? "Saving..." : "Save settings"}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DetailsModal({ title, meta, loading, onClose }: { title: string; meta: { rows?: Array<{ label: string; value: string }> } | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 px-5 backdrop-blur-md">
      <section className="w-full max-w-[360px] rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
        <div className="flex items-center justify-between gap-3"><h2 className="truncate text-lg font-semibold tracking-[-0.04em] text-white">{title}</h2><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 space-y-2">
          {loading ? <div className="text-sm text-white/54">Fetching state…</div> : (meta?.rows || []).map((row) => <div key={row.label} className="flex items-center justify-between gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"><span className="text-xs text-white/42">{row.label}</span><span className="truncate text-right text-sm font-medium capitalize text-white/84">{row.value}</span></div>)}
        </div>
        <p className="mt-3 text-center text-[11px] text-white/34">Developer payloads are hidden in Oyi Home.</p>
      </section>
    </div>
  );
}
