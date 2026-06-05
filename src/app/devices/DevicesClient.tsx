"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Fan,
  FastForward,
  Flame,
  Home,
  Minus,
  Moon,
  Pause,
  Play,
  Power,
  Plus,
  Rewind,
  Search,
  SlidersHorizontal,
  Snowflake,
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
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";
import { getDeviceFamily, getDeviceIcon, getDeviceIconTone, isSimplePowerDevice } from "@/lib/devicePresentation";

type AnyDevice = Record<string, any>;
type DiscoveryDevice = Record<string, any>;
type AddDeviceTab = "nearby" | "provider" | "manual";
type CategoryKey = "all" | "lights" | "climate" | "security" | "entertainment" | "sensors";

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

function pickDbId(d: AnyDevice) {
  return d?.id || null;
}

function pickExternalId(d: AnyDevice) {
  return d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.devId || d?.uuid || null;
}

function pickName(d: AnyDevice) {
  return d?.name || d?.local_name || d?.localName || d?.alias || "Unnamed Device";
}

function pickVendor(d: AnyDevice) {
  return d?.vendor || d?.adapter || d?.protocol || d?.brand || "device";
}

function pickRoomName(d: AnyDevice) {
  return d?.room_name || d?.room?.name || d?.metadata?.room_name || d?.metadata?.room || null;
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

function isOnline(d: AnyDevice): boolean | null {
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

function deviceIcon(device: AnyDevice) {
  return getDeviceIcon(device);
}

function iconTone(device: AnyDevice) {
  return getDeviceIconTone(device);
}

function guessGangCount(device: AnyDevice, state: any): 1 | 2 | 3 {
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

function readGangValues(gangCount: 1 | 2 | 3, state: any): Array<boolean | null> {
  const out: Array<boolean | null> = [];
  for (let i = 1; i <= gangCount; i += 1) {
    const k = `switch_${i}`;
    const v = state?.[k];
    out.push(typeof v === "boolean" ? v : null);
  }
  if (gangCount === 1 && out[0] === null) {
    const v = state?.switch ?? state?.power ?? state?.on;
    if (typeof v === "boolean") out[0] = v;
  }
  return out;
}

function normalizeCommandKey(gangCount: 1 | 2 | 3, gangIndex: number) {
  return gangCount === 1 ? "switch" : `switch_${gangIndex + 1}`;
}

function readPowerState(state: any): boolean | null {
  if (!state) return null;
  const v = state?.switch ?? state?.power ?? state?.on ?? null;
  if (typeof v === "boolean") return v;
  const keys = ["switch_1", "switch_2", "switch_3"];
  for (const k of keys) if (typeof state?.[k] === "boolean" && state[k] === true) return true;
  return keys.some((k) => typeof state?.[k] === "boolean") ? false : null;
}

function readTemperature(state: any): string | null {
  const raw = state?.temp_current ?? state?.temperature ?? state?.temp ?? state?.current_temperature;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const c = n > 80 ? Math.round(n / 10) : Math.round(n);
  return `${c}°C`;
}

function readLockState(device: AnyDevice, state: any): string | null {
  const family = inferFamily(device);
  if (family !== "lock") return null;
  const raw = String(state?.lock_state ?? state?.door_state ?? state?.status ?? "").toLowerCase();
  if (raw.includes("unlock") || raw === "open") return "Unlocked";
  if (raw.includes("lock") || raw === "closed") return "Locked";
  return null;
}

function displayState(device: AnyDevice, state: any) {
  const lock = readLockState(device, state);
  if (lock) return lock;
  const temp = readTemperature(state);
  if (temp) return temp;
  const family = inferFamily(device);
  if (family === "curtain") {
    const open = state?.open ?? state?.curtain_open ?? state?.position;
    if (typeof open === "boolean") return open ? "Open" : "Closed";
    if (typeof open === "number") return open > 0 ? "Open" : "Closed";
  }
  const power = readPowerState(state);
  if (power !== null) return power ? "On" : "Off";
  const online = isOnline(device);
  if (online === false) return "Offline";
  if (online === true) return "Online";
  return "Awaiting sync";
}

function isSimpleControlDevice(device: AnyDevice, state: any) {
  const gangCount = guessGangCount(device, state);
  return gangCount === 1 && canSwitchDevice(device);
}

function isFavoriteDevice(device: AnyDevice) {
  const meta = device?.metadata || {};
  return Boolean(device?.favorite || device?.is_favorite || device?.pinned || meta?.favorite || meta?.is_favorite || meta?.pinned);
}

function friendlyStateRows(device: AnyDevice, state: any) {
  const online = isOnline(device);
  const power = readPowerState(state);
  const rows = [
    { label: "State", value: displayState(device, state) },
    { label: "Connection", value: online === null ? "Unknown" : online ? "Online" : "Offline" },
    { label: "Room", value: pickRoomName(device) || "Unassigned" },
    { label: "Device type", value: inferFamily(device).replace("_", " ") },
  ];
  if (power !== null && rows[0].value !== (power ? "On" : "Off")) rows.push({ label: "Power", value: power ? "On" : "Off" });
  const lastSeen = state?.last_seen || state?.lastSeen || device?.last_seen || device?.lastSeen || device?.updated_at;
  if (lastSeen) rows.push({ label: "Last active", value: new Date(lastSeen).toLocaleString() });
  const caps = uiCapabilities(device);
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
  return rows;
}

function attentionReason(device: AnyDevice, state: any) {
  if (isOnline(device) === false) return "Connection lost";
  const battery = Number(state?.battery ?? state?.battery_percentage ?? device?.battery);
  if (Number.isFinite(battery) && battery > 0 && battery <= 20) return "Battery low";
  const status = String(device?.status || state?.status || "").toLowerCase();
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

function uiCapabilities(device: AnyDevice) {
  const ui = device?.ui_capabilities && typeof device.ui_capabilities === "object" ? device.ui_capabilities : {};
  const supported = Array.isArray(ui.supported_commands) ? ui.supported_commands.map((item: any) => String(item).toLowerCase()) : [];
  return {
    canSwitch: Boolean(ui.can_switch || supported.includes("switch") || friendlyCapabilities(device).includes("Power")),
    timer: Boolean(ui.timer || supported.includes("timer")),
    schedule: Boolean(ui.schedule || supported.includes("schedule")),
    cycle: Boolean(ui.cycle || supported.includes("cycle")),
    inching: Boolean(ui.inching || supported.includes("inching")),
    tv: Array.isArray(ui?.remote?.tv) ? ui.remote.tv.map((item: any) => String(item).toLowerCase()) : [],
    ac: Array.isArray(ui?.remote?.ac) ? ui.remote.ac.map((item: any) => String(item).toLowerCase()) : [],
  };
}

function canSwitchDevice(device: AnyDevice) {
  const caps = uiCapabilities(device);
  return caps.canSwitch || isSimplePowerDevice(device);
}

export default function DeviceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const estateId = useMemo(() => (user as any)?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null), [user]);
  const homeId = useMemo(() => (user as any)?.home_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null), [user]);

  const [items, setItems] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [stateMap, setStateMap] = useState<Record<string, any>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDevice, setSheetDevice] = useState<AnyDevice | null>(null);
  const [stateOpen, setStateOpen] = useState(false);
  const [stateTitle, setStateTitle] = useState("Device");
  const [stateMeta, setStateMeta] = useState<{ rows?: Array<{ label: string; value: string }> } | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
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

  async function hydrateStates(list: AnyDevice[]) {
    const jobs = list
      .map((d) => ({ sid: pickDbId(d) ? String(pickDbId(d)) : null }))
      .filter((x) => x.sid)
      .map(async ({ sid }) => {
        try {
          const res = await deviceService.getDeviceState(String(sid));
          return { sid: String(sid), state: (res as any)?.state ?? res ?? {} };
        } catch {
          return null;
        }
      });
    const settled = await Promise.allSettled(jobs);
    const patch: Record<string, any> = {};
    settled.forEach((s) => {
      if (s.status === "fulfilled" && s.value?.sid) patch[s.value.sid] = s.value.state;
    });
    if (Object.keys(patch).length) setStateMap((prev) => ({ ...prev, ...patch }));
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await deviceService.getRegistryDevices(estateId || undefined);
      const nextList = Array.isArray(list) ? list : [];
      setItems(nextList);
      await hydrateStates(nextList);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load devices");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

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
  }, [estateId]);

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
    if (!items.length) return;
    const t = window.setInterval(() => void hydrateStates(items), 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const selectedDiscoveryIds = useMemo(() => Object.keys(selectedDiscover).filter((k) => selectedDiscover[k]), [selectedDiscover]);
  const providerDevices = useMemo(() => items.filter((device) => !device?.home_id && String(device?.provider || device?.vendor || device?.adapter || "").toLowerCase() === "tuya"), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((d) => {
      const deviceCategory = categoryFor(d);
      const family = inferFamily(d);
      const categoryMatch = category === "all" || deviceCategory === category || (category === "lights" && family === "switch");
      if (!categoryMatch) return false;
      if (!term) return true;
      return [pickName(d), pickRoomName(d), displayState(d, stateMap[String(pickDbId(d))] || {})]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, q, category, stateMap]);

  const favorites = useMemo(() => items.filter((device) => Boolean(device?.home_id) && isFavoriteDevice(device)).slice(0, 8), [items]);

  const roomGroups = useMemo(() => {
    const map = new Map<string, { key: string; roomId: string; name: string; devices: AnyDevice[] }>();
    items.forEach((device) => {
      const roomId = pickRoomId(device);
      if (!device?.home_id || !roomId) return;
      const key = pickRoomKey(device);
      const name = pickRoomName(device) || "Room";
      const current = map.get(key) || { key, roomId: String(roomId), name, devices: [] as AnyDevice[] };
      current.devices.push(device);
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const attentionItems = useMemo(() => {
    return items
      .map((device) => ({ device, reason: attentionReason(device, stateMap[String(pickDbId(device))] || {}) }))
      .filter((item) => Boolean(item.reason));
  }, [items, stateMap]);

  async function warmState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;
    const sid = String(dbId);
    if (stateMap[sid]) return;
    try {
      const res = await deviceService.getDeviceState(sid);
      setStateMap((p) => ({ ...p, [sid]: (res as any)?.state ?? res ?? {} }));
    } catch {
      // silent warmup
    }
  }

  function buildPowerCommand(device: AnyDevice, state: any, next: boolean) {
    const gangCount = guessGangCount(device, state);
    if (gangCount === 1) return { switch: next };
    const out: Record<string, boolean> = {};
    for (let i = 1; i <= gangCount; i += 1) out[`switch_${i}`] = next;
    return out;
  }

  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    if (!canSwitchDevice(device)) return setErr(`${pickName(device)} does not expose a supported power command.`);
    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);
    try {
      await warmState(device);
      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);
      const code = normalizeCommandKey(gangCount, gangIndex);
      await deviceService.commandDevice(sid, { [code]: next });
      setStateMap((p) => ({ ...p, [sid]: { ...(p[sid] || {}), [code]: next, ...(gangCount === 1 ? { switch: next, power: next, on: next } : {}) } }));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMasterPower(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return setErr("This device is not assigned yet.");
    if (isOnline(device) === false) return setErr(`${pickName(device)} is offline.`);
    if (!canSwitchDevice(device)) return setErr(`${pickName(device)} does not expose a supported power command.`);
    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);
    try {
      await warmState(device);
      const cached = stateMap[sid] || {};
      const nowOn = readPowerState(cached);
      const next = nowOn === null ? true : !nowOn;
      const command = buildPowerCommand(device, cached, next);
      await deviceService.commandDevice(sid, command);
      setStateMap((p) => ({ ...p, [sid]: { ...(p[sid] || {}), ...command, switch: next, power: next, on: next } }));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
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
    void warmState(device);
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
    setStateMeta({ rows: friendlyStateRows(device, stateMap[sid] || {}) });
    setStateOpen(true);
    setStateLoading(true);
    try {
      const res = await deviceService.getDeviceState(sid);
      const state = (res as any)?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));
      setStateMeta({ rows: friendlyStateRows(device, state) });
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
                <p className="mt-2 text-[13px] leading-5 text-white/56">Control your connected home.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => router.push("/scenes?create=scene")} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-medium text-white/68 active:scale-[0.98]"><Moon className="h-3.5 w-3.5" /> Scenes</button>
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
                  {favorites.map((device) => <FavoriteCard key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} state={stateMap[String(pickDbId(device))] || {}} busy={busyId === String(pickDbId(device))} onOpen={openDevice} onPower={toggleMasterPower} />)}
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
                  {attentionItems.map(({ device, reason }) => <AttentionRow key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} reason={String(reason)} />)}
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
                {filtered.map((device, index) => <DeviceRow key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} state={stateMap[String(pickDbId(device))] || {}} busy={busyId === String(pickDbId(device))} bordered={index > 0} editingFavorites={editingFavorites} onOpen={openDevice} onPower={toggleMasterPower} onFavorite={toggleFavorite} />)}
              </div>
            </section>
          </div>
        </div>

        {addDeviceOpen ? <AddDeviceSheet tab={addDeviceTab} setTab={setAddDeviceTab} discovering={discovering} binding={binding} discovered={discovered} providerDevices={providerDevices} selectedDiscover={selectedDiscover} selectedCount={selectedDiscoveryIds.length} bindRoom={bindRoom} setBindRoom={setBindRoom} setSelectedDiscover={setSelectedDiscover} onClose={() => setAddDeviceOpen(false)} onScan={refreshDiscovery} onBind={bindSelectedDevices} /> : null}
        {assignDevice ? <UnassignedDeviceSheet device={assignDevice} room={assignRoom} setRoom={setAssignRoom} binding={binding} onClose={() => setAssignDevice(null)} onAssign={assignListedDevice} /> : null}
        {sheetOpen && sheetDevice ? <ControlSheet device={sheetDevice} state={stateMap[String(pickDbId(sheetDevice))] || {}} busy={busyId === String(pickDbId(sheetDevice))} onClose={() => setSheetOpen(false)} onDetails={viewFriendlyDetails} onToggleGang={toggleGang} onPower={toggleMasterPower} onCreateScene={(device) => router.push(`/scenes?create=scene&deviceId=${encodeURIComponent(String(pickDbId(device) || ""))}`)} /> : null}
        {stateOpen ? <DetailsModal title={stateTitle} meta={stateMeta} loading={stateLoading} onClose={() => setStateOpen(false)} /> : null}
        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}

function FavoriteCard({ device, state, busy, onOpen, onPower }: { device: AnyDevice; state: any; busy: boolean; onOpen: (device: AnyDevice) => void; onPower: (device: AnyDevice) => void }) {
  const Icon = deviceIcon(device);
  const stateText = busy ? "Working…" : displayState(device, state);
  return (
    <button type="button" onClick={() => onOpen(device)} className="relative min-h-[142px] w-[156px] shrink-0 snap-start overflow-hidden rounded-[26px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.052),rgba(255,255,255,0.014))] p-3.5 text-left shadow-[0_16px_48px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition active:scale-[0.985]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-400/12 blur-3xl" />
      <div className={cn("relative grid h-11 w-11 place-items-center rounded-full border", iconTone(device))}><Icon className="h-5 w-5" /></div>
      <div className="relative mt-5 text-[15px] font-semibold leading-5 tracking-[-0.035em] text-white line-clamp-2">{pickName(device)}</div>
      <div className="relative mt-1 truncate text-xs text-white/46">{pickRoomName(device) || "Unassigned"}</div>
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
  const capabilities = friendlyCapabilities(device);
  const suggestion = suggestedRoom(device);
  return (
    <div className="fixed inset-0 z-[135]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(14px+var(--sab))]">
        <section className="mx-auto max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", iconTone(device))}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">{pickName(device)}</h2><p className="mt-0.5 text-xs capitalize text-white/44">{providerLabel(device)} · {inferFamily(device)}</p></div>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4">
            <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between text-xs"><span className="text-white/42">Connection</span><span className={isOnline(device) === false ? "text-amber-200" : "text-emerald-200"}>{isOnline(device) === false ? "Offline" : isOnline(device) === true ? "Online" : "Awaiting sync"}</span></div>
              {capabilities.length ? <div className="mt-3 flex flex-wrap gap-1.5">{capabilities.map((capability) => <span key={capability} className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] text-white/56">{capability}</span>)}</div> : <p className="mt-3 text-xs text-white/42">Capabilities will appear after assignment and provider state sync.</p>}
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

function DeviceRow({ device, state, busy, bordered, editingFavorites, onOpen, onPower, onFavorite }: { device: AnyDevice; state: any; busy: boolean; bordered: boolean; editingFavorites: boolean; onOpen: (device: AnyDevice) => void; onPower: (device: AnyDevice) => void; onFavorite: (device: AnyDevice) => void }) {
  const Icon = deviceIcon(device);
  const simple = isSimpleControlDevice(device, state);
  const stateText = busy ? "Working…" : displayState(device, state);
  return (
    <div className={cn("flex w-full items-center gap-3 px-3.5 py-3 transition hover:bg-white/[0.035]", bordered && "border-t border-white/[0.055]")}>
      <button type="button" onClick={() => onOpen(device)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", iconTone(device))}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold tracking-[-0.025em] text-white">{pickName(device)}</span>
          <span className="mt-0.5 block truncate text-xs text-white/44">{pickRoomName(device) || "Unassigned"}</span>
        </span>
      </button>
      <span className="shrink-0 text-right text-[13px] font-medium text-white/72">{stateText}</span>
      {editingFavorites && device?.home_id ? <button type="button" onClick={() => void onFavorite(device)} className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border transition", isFavoriteDevice(device) ? "border-amber-300/35 bg-amber-300/12 text-amber-200" : "border-white/10 bg-white/[0.05] text-white/38")} aria-label={isFavoriteDevice(device) ? "Remove favorite" : "Add favorite"}><Star className={cn("h-4 w-4", isFavoriteDevice(device) && "fill-current")} /></button> : simple ? <button type="button" onClick={() => void onPower(device)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60" aria-label={`Toggle ${pickName(device)}`}><ChevronRight className="h-4 w-4" /></button> : <ChevronRight className="h-4 w-4 shrink-0 text-white/32" />}
    </div>
  );
}

function AttentionRow({ device, reason }: { device: AnyDevice; reason: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-amber-300/12 bg-amber-400/[0.055] px-3.5 py-3 text-left">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-amber-300/15 bg-amber-400/10 text-amber-200"><AlertTriangle className="h-4.5 w-4.5" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{pickName(device)}</span><span className="mt-0.5 block text-xs text-amber-100/66">{reason}</span></span>
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

function ControlSheet({ device, state, busy, onClose, onDetails, onToggleGang, onPower, onCreateScene }: { device: AnyDevice; state: any; busy: boolean; onClose: () => void; onDetails: (device: AnyDevice) => void; onToggleGang: (device: AnyDevice, gangIndex: number, next: boolean) => void; onPower: (device: AnyDevice) => void; onCreateScene: (device: AnyDevice) => void }) {
  const gangCount = guessGangCount(device, state);
  const values = Object.keys(state || {}).length ? readGangValues(gangCount, state) : Array.from({ length: gangCount }, () => null);
  const caps = uiCapabilities(device);
  const family = inferFamily(device);
  const template = family === "tv" || family === "remote" || caps.tv.length ? "tv" : family === "climate" || family === "thermostat" || caps.ac.length ? "ac" : "switch";
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(14px+var(--sab))]">
        <section className="mx-auto max-w-[430px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-white/18" /></div>
          <div className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-[-0.04em] text-white">{pickName(device)}</h2>
              <p className="mt-1 truncate text-xs text-white/46">{pickRoomName(device) || "Unassigned"} • {displayState(device, state)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onCreateScene(device)} className="grid h-8 w-8 place-items-center rounded-full border border-sky-300/14 bg-sky-400/10 text-sky-100" aria-label="Create scene with this device"><Star className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60" aria-label="Close device controls"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="max-h-[68vh] overflow-y-auto px-4 pb-4">
            {template === "tv" ? (
              <TvControlTemplate device={device} state={state} caps={caps} busy={busy} onPower={onPower} onDetails={onDetails} />
            ) : template === "ac" ? (
              <AcControlTemplate device={device} state={state} caps={caps} busy={busy} onPower={onPower} onDetails={onDetails} />
            ) : (
              <SwitchControlTemplate device={device} state={state} caps={caps} gangCount={gangCount} values={values} busy={busy} onToggleGang={onToggleGang} onDetails={onDetails} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SwitchControlTemplate({ device, state, caps, gangCount, values, busy, onToggleGang, onDetails }: { device: AnyDevice; state: any; caps: ReturnType<typeof uiCapabilities>; gangCount: number; values: Array<boolean | null>; busy: boolean; onToggleGang: (device: AnyDevice, gangIndex: number, next: boolean) => void; onDetails: (device: AnyDevice) => void }) {
  const safeGangCount = Math.min(3, Math.max(1, gangCount)) as 1 | 2 | 3;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-4">
        <div>
          <div className="text-sm font-semibold text-white">{gangCount > 1 ? `${gangCount} gang switch` : "Switch control"}</div>
          <div className="mt-1 text-xs text-white/42">{isOnline(device) === false ? "Offline" : caps.canSwitch ? "Ready" : "Power command unavailable"}</div>
        </div>
        {caps.canSwitch ? <GangRingSwitch gangCount={safeGangCount} online={isOnline(device)} values={values} busy={busy} onToggleGang={(gangIndex, next) => onToggleGang(device, gangIndex, next)} size={68} /> : <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/44">Unavailable</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CapabilityButton icon={Clock} label="Timer" enabled={caps.timer || caps.cycle || caps.inching} detail={caps.timer ? "Countdown / one-time" : caps.cycle || caps.inching ? "Provider timer mode" : "Unavailable"} onClick={() => onDetails(device)} />
        <CapabilityButton icon={CalendarClock} label="Schedule" enabled={caps.schedule} detail={caps.schedule ? "One-time / repeat" : "Unavailable"} onClick={() => onDetails(device)} />
        <CapabilityButton icon={SlidersHorizontal} label="Settings" enabled detail="Info and capability" onClick={() => onDetails(device)} />
      </div>
      <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-3 text-xs leading-5 text-white/44">
        {friendlyCapabilities(device).length ? friendlyCapabilities(device).slice(0, 4).join(" • ") : displayState(device, state)}
      </div>
    </div>
  );
}

function AcControlTemplate({ device, state, caps, busy, onPower, onDetails }: { device: AnyDevice; state: any; caps: ReturnType<typeof uiCapabilities>; busy: boolean; onPower: (device: AnyDevice) => void; onDetails: (device: AnyDevice) => void }) {
  const temp = readTemperature(state);
  const canPower = caps.canSwitch || caps.ac.includes("power");
  const modes = [
    ["cool", "Cool", Snowflake],
    ["heat", "Heat", Flame],
    ["dry", "Dry", Moon],
    ["fan", "Fan", Fan],
    ["auto", "Auto", Thermometer],
  ] as const;
  const fanSpeeds = ["Low", "Medium", "High", "Auto"];
  return (
    <div className="space-y-3">
      <div className="rounded-[28px] border border-sky-300/12 bg-[radial-gradient(circle_at_top,#0f3550_0%,rgba(6,12,22,0.74)_48%,rgba(255,255,255,0.035)_100%)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-sky-100/44">Climate</div>
            <div className="mt-1 text-4xl font-semibold tracking-[-0.08em] text-white">{temp || "—"}<span className="text-lg text-white/42">°C</span></div>
            <div className="mt-1 text-xs text-white/42">Supported range 16°C – 30°C</div>
          </div>
          <button type="button" disabled={!canPower || busy || isOnline(device) === false} onClick={() => onPower(device)} className={cn("grid h-14 w-14 place-items-center rounded-full border", canPower ? "border-sky-300/22 bg-sky-400/12 text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.18)]" : "border-white/[0.06] bg-white/[0.025] text-white/28")} aria-label="Power">
            <Power className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <RemoteKey icon={Minus} label="Temp -" enabled={false} />
          <div className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-2 text-center text-[11px] text-white/46">Temperature commands unavailable</div>
          <RemoteKey icon={Plus} label="Temp +" enabled={false} />
        </div>
      </div>
      <ControlGroup title="Mode">
        {modes.map(([key, label, Icon]) => <RemoteKey key={key} icon={Icon} label={label} enabled={caps.ac.includes(key)} />)}
      </ControlGroup>
      <ControlGroup title="Fan">
        {fanSpeeds.map((speed) => <RemoteKey key={speed} icon={Wind} label={speed} enabled={caps.ac.includes("fan")} />)}
      </ControlGroup>
      <ControlGroup title="Swing">
        <RemoteKey icon={ChevronUp} label="Vertical" enabled={caps.ac.includes("swing") || caps.ac.includes("swing_vertical")} />
        <RemoteKey icon={ChevronRight} label="Horizontal" enabled={caps.ac.includes("swing") || caps.ac.includes("swing_horizontal")} />
      </ControlGroup>
      <div className="grid grid-cols-3 gap-2">
        <CapabilityButton icon={Clock} label="Timer" enabled={caps.timer || caps.ac.includes("timer")} detail={caps.timer || caps.ac.includes("timer") ? "Provider timer" : "Unavailable"} onClick={() => onDetails(device)} />
        <CapabilityButton icon={CalendarClock} label="Schedule" enabled={caps.schedule} detail={caps.schedule ? "Device schedule" : "Unavailable"} onClick={() => onDetails(device)} />
        <CapabilityButton icon={SlidersHorizontal} label="Settings" enabled detail="Info and capability" onClick={() => onDetails(device)} />
      </div>
    </div>
  );
}

function TvControlTemplate({ device, state, caps, busy, onPower, onDetails }: { device: AnyDevice; state: any; caps: ReturnType<typeof uiCapabilities>; busy: boolean; onPower: (device: AnyDevice) => void; onDetails: (device: AnyDevice) => void }) {
  const tv = caps.tv;
  const canPower = caps.canSwitch || tv.includes("power");
  const providerButtons = ["netflix", "youtube", "prime"].filter((key) => tv.includes(key));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <RemoteKey icon={Power} label="Power" enabled={canPower && isOnline(device) !== false} busy={busy} onClick={() => onPower(device)} />
        <RemoteKey icon={VolumeX} label="Mute" enabled={tv.includes("mute")} />
        <RemoteKey icon={ChevronRight} label="Input" enabled={tv.includes("input")} />
      </div>
      <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.035] p-4">
        <div className="mb-3 text-center text-xs uppercase tracking-[0.22em] text-white/34">Navigation</div>
        <div className="mx-auto grid max-w-[230px] grid-cols-3 gap-2">
          <span />
          <RemoteKey icon={ChevronUp} label="Up" enabled={tv.includes("dpad") || tv.includes("up")} />
          <span />
          <RemoteKey icon={ChevronLeft} label="Left" enabled={tv.includes("dpad") || tv.includes("left")} />
          <RemoteKey icon={ChevronRight} label="OK" enabled={tv.includes("ok") || tv.includes("select")} />
          <RemoteKey icon={ChevronRight} label="Right" enabled={tv.includes("dpad") || tv.includes("right")} />
          <span />
          <RemoteKey icon={ChevronDown} label="Down" enabled={tv.includes("dpad") || tv.includes("down")} />
          <span />
        </div>
      </div>
      <ControlGroup title="System">
        <RemoteKey icon={Home} label="Home" enabled={tv.includes("home")} />
        <RemoteKey icon={ChevronLeft} label="Back" enabled={tv.includes("back")} />
        <RemoteKey icon={SlidersHorizontal} label="Menu" enabled={tv.includes("menu")} />
        <RemoteKey icon={SlidersHorizontal} label="Settings" enabled={tv.includes("settings")} />
      </ControlGroup>
      <ControlGroup title="Media">
        <RemoteKey icon={Play} label="Play" enabled={tv.includes("play")} />
        <RemoteKey icon={Pause} label="Pause" enabled={tv.includes("pause")} />
        <RemoteKey icon={Rewind} label="Rewind" enabled={tv.includes("rewind")} />
        <RemoteKey icon={FastForward} label="Forward" enabled={tv.includes("fast_forward") || tv.includes("forward")} />
      </ControlGroup>
      <div className="grid grid-cols-2 gap-2">
        <ControlGroup title="Volume">
          <RemoteKey icon={Plus} label="Vol +" enabled={tv.includes("volume")} />
          <RemoteKey icon={Minus} label="Vol -" enabled={tv.includes("volume")} />
        </ControlGroup>
        <ControlGroup title="Channel">
          <RemoteKey icon={Plus} label="Ch +" enabled={tv.includes("channel")} />
          <RemoteKey icon={Minus} label="Ch -" enabled={tv.includes("channel")} />
        </ControlGroup>
      </div>
      {providerButtons.length ? <ControlGroup title="Provider">
        {providerButtons.map((key) => <RemoteKey key={key} icon={Play} label={key === "prime" ? "Prime" : key[0].toUpperCase() + key.slice(1)} enabled />)}
      </ControlGroup> : null}
      <CapabilityButton icon={SlidersHorizontal} label="Settings" enabled detail="Info and capability" onClick={() => onDetails(device)} />
      <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-3 text-xs leading-5 text-white/42">Remote commands stay unavailable until the provider exposes a safe command mapping for this device.</div>
    </div>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/34">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function CapabilityButton({ icon: Icon, label, detail, enabled, onClick }: { icon: any; label: string; detail: string; enabled: boolean; onClick?: () => void }) {
  return (
    <button type="button" disabled={!enabled} onClick={onClick} className={cn("rounded-[18px] border px-2.5 py-2.5 text-left transition", enabled ? "border-sky-300/14 bg-sky-400/10 text-sky-100 active:scale-[0.98]" : "border-white/[0.06] bg-white/[0.025] text-white/34")}>
      <Icon className="h-4 w-4" />
      <span className="mt-1 block text-xs font-semibold">{label}</span>
      <span className="mt-0.5 block text-[10px] leading-4 opacity-65">{detail}</span>
    </button>
  );
}

function RemoteKey({ icon: Icon, label, enabled, busy, onClick }: { icon: any; label: string; enabled: boolean; busy?: boolean; onClick?: () => void }) {
  return (
    <button type="button" disabled={!enabled || busy || !onClick} onClick={onClick} className={cn("min-h-12 rounded-[16px] border px-2 py-2 text-center transition", enabled && onClick ? "border-sky-300/18 bg-sky-400/10 text-sky-100 active:scale-[0.98]" : enabled ? "border-white/[0.08] bg-white/[0.04] text-white/56" : "border-white/[0.045] bg-white/[0.018] text-white/24")} title={enabled && !onClick ? "Provider capability detected. Command UI is pending safe backend mapping." : enabled ? label : "Unavailable for this device"}>
      <Icon className="mx-auto h-3.5 w-3.5" />
      <span className="mt-1 block text-[10px]">{enabled ? label : "Unavailable"}</span>
    </button>
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
