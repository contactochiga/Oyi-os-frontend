"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Fan,
  Home,
  Plus,
  Search,
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
    if (s.includes("offline") || s.includes("lost")) return false;
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
  return gangCount === 1 && isSimplePowerDevice(device);
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

export default function DeviceClient() {
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
  const [discovering, setDiscovering] = useState(false);
  const [binding, setBinding] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveryDevice[]>([]);
  const [selectedDiscover, setSelectedDiscover] = useState<Record<string, boolean>>({});
  const [bindRoom, setBindRoom] = useState("");

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
      const list = await deviceService.getDevices(estateId || undefined);
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
    if (!items.length) return;
    const t = window.setInterval(() => void hydrateStates(items), 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const selectedDiscoveryIds = useMemo(() => Object.keys(selectedDiscover).filter((k) => selectedDiscover[k]), [selectedDiscover]);

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

  const favorites = useMemo(() => items.filter(isFavoriteDevice).slice(0, 8), [items]);

  const roomGroups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; devices: AnyDevice[] }>();
    items.forEach((device) => {
      const key = pickRoomKey(device);
      const name = pickRoomName(device) || "Unassigned";
      const current = map.get(key) || { key, name, devices: [] as AnyDevice[] };
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
    const sid = String(pickDbId(device) || "");
    const cached = sid ? stateMap[sid] : {};
    if (isSimpleControlDevice(device, cached)) void toggleMasterPower(device);
    else {
      setSheetDevice(device);
      setSheetOpen(true);
      void warmState(device);
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

  async function refreshDiscovery() {
    setDiscovering(true);
    setErr(null);
    try {
      const found = await deviceService.discoverDevices();
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
    setSelectedDiscover({});
    await refreshDiscovery();
  }

  async function bindSelectedDevices() {
    if (!selectedDiscoveryIds.length) return;
    setBinding(true);
    setErr(null);
    try {
      const targets = discovered.filter((d) => {
        const ext = pickDiscoveryExternalId(d);
        return ext ? selectedDiscover[String(ext)] : false;
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
              <button type="button" onClick={openAddDevice} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100 shadow-[0_0_18px_rgba(0,132,255,0.14)] active:scale-[0.98]">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </header>

            {err ? <div className="mt-4 rounded-[18px] border border-red-300/16 bg-red-500/10 px-3.5 py-3 text-xs text-red-100">{err}</div> : null}

            <section className="mt-5">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Favorite Controls</h2>
                <button type="button" onClick={load} disabled={loading} className="text-xs text-sky-200/76 disabled:text-white/30">{loading ? "Syncing" : "Refresh"}</button>
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
                <a href="/activity" className="inline-flex items-center gap-1 text-xs text-sky-200/80">View Activity <ChevronRight className="h-3.5 w-3.5" /></a>
              </div>
              <label className="flex h-11 items-center gap-2 rounded-full border border-white/[0.075] bg-white/[0.035] px-4 text-white/70 shadow-[0_12px_34px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus-within:border-sky-300/25 focus-within:bg-sky-400/[0.045]">
                <Search className="h-4 w-4 text-white/36" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search devices" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/34" />
              </label>

              <div className="mt-3 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] shadow-[0_14px_48px_rgba(0,0,0,0.29)] backdrop-blur-2xl">
                {loading && !filtered.length ? <div className="px-4 py-5 text-sm text-white/50">Loading devices…</div> : null}
                {!loading && !filtered.length ? <div className="px-4 py-5 text-sm text-white/50">No devices available.</div> : null}
                {filtered.map((device, index) => <DeviceRow key={String(pickDbId(device) || pickExternalId(device) || pickName(device))} device={device} state={stateMap[String(pickDbId(device))] || {}} busy={busyId === String(pickDbId(device))} bordered={index > 0} onOpen={openDevice} onPower={toggleMasterPower} />)}
              </div>
            </section>
          </div>
        </div>

        {addDeviceOpen ? <AddDeviceSheet discovering={discovering} binding={binding} discovered={discovered} selectedDiscover={selectedDiscover} selectedCount={selectedDiscoveryIds.length} bindRoom={bindRoom} setBindRoom={setBindRoom} setSelectedDiscover={setSelectedDiscover} onClose={() => setAddDeviceOpen(false)} onScan={refreshDiscovery} onBind={bindSelectedDevices} /> : null}
        {sheetOpen && sheetDevice ? <ControlSheet device={sheetDevice} state={stateMap[String(pickDbId(sheetDevice))] || {}} busy={busyId === String(pickDbId(sheetDevice))} onClose={() => setSheetOpen(false)} onDetails={viewFriendlyDetails} onToggleGang={toggleGang} /> : null}
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

function RoomCard({ room }: { room: { key: string; name: string; devices: AnyDevice[] } }) {
  return (
    <a href={`/rooms?room=${encodeURIComponent(room.name)}`} className="rounded-[22px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition active:scale-[0.985]">
      <div className="grid h-9 w-9 place-items-center rounded-full border border-sky-300/14 bg-sky-400/10 text-sky-200"><Home className="h-4.5 w-4.5" /></div>
      <div className="mt-3 truncate text-[15px] font-semibold tracking-[-0.035em] text-white">{room.name}</div>
      <div className="mt-1 text-xs text-white/48">{room.devices.length} device{room.devices.length === 1 ? "" : "s"}</div>
    </a>
  );
}

function DeviceRow({ device, state, busy, bordered, onOpen, onPower }: { device: AnyDevice; state: any; busy: boolean; bordered: boolean; onOpen: (device: AnyDevice) => void; onPower: (device: AnyDevice) => void }) {
  const Icon = deviceIcon(device);
  const simple = isSimpleControlDevice(device, state);
  const stateText = busy ? "Working…" : displayState(device, state);
  return (
    <button type="button" onClick={() => onOpen(device)} className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.035]", bordered && "border-t border-white/[0.055]")}>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", iconTone(device))}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.025em] text-white">{pickName(device)}</span>
        <span className="mt-0.5 block truncate text-xs text-white/44">{pickRoomName(device) || "Unassigned"}</span>
      </span>
      <span className="shrink-0 text-right text-[13px] font-medium text-white/72">{stateText}</span>
      {simple ? <span onClick={(e) => { e.stopPropagation(); void onPower(device); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60"><ChevronRight className="h-4 w-4" /></span> : <ChevronRight className="h-4 w-4 shrink-0 text-white/32" />}
    </button>
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

function AddDeviceSheet({ discovering, binding, discovered, selectedDiscover, selectedCount, bindRoom, setBindRoom, setSelectedDiscover, onClose, onScan, onBind }: any) {
  return (
    <div className="fixed inset-0 z-[130]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(14px+var(--sab))]">
        <section className="mx-auto max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <div><h2 className="text-base font-semibold tracking-[-0.035em] text-white">Add Devices</h2><p className="mt-0.5 text-xs text-white/44">Scan and connect available home devices.</p></div>
            <div className="flex items-center gap-2"><button type="button" onClick={onScan} disabled={discovering || binding} className="rounded-full border border-sky-300/16 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-50">{discovering ? "Scanning" : "Scan"}</button><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button></div>
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-4">
            {discovering ? <div className="text-sm text-white/56">Scanning for devices…</div> : null}
            {!discovering && !discovered.length ? <AmbientEmpty title="No devices found" body="Awaiting device sync." /> : null}
            <div className="space-y-2">
              {discovered.map((d: DiscoveryDevice, index: number) => {
                const ext = pickDiscoveryExternalId(d);
                const key = ext ? String(ext) : `tmp-${index}`;
                const selected = ext ? Boolean(selectedDiscover[String(ext)]) : false;
                return <button key={key} type="button" disabled={!ext || binding} onClick={() => ext && setSelectedDiscover((prev: Record<string, boolean>) => ({ ...prev, [String(ext)]: !prev[String(ext)] }))} className={cn("flex w-full items-center justify-between gap-3 rounded-[18px] border px-3 py-2.5 text-left", selected ? "border-sky-300/25 bg-sky-400/10" : "border-white/[0.07] bg-white/[0.035]", !ext && "opacity-50")}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{d?.name || d?.type || "Device"}</span><span className="mt-0.5 block truncate text-xs text-white/42">{d?.protocol || d?.adapter || d?.vendor || "device"}</span></span><span className="text-xs text-white/50">{selected ? "Selected" : typeof d?.online === "boolean" ? (d.online ? "Online" : "Offline") : "Found"}</span></button>;
              })}
            </div>
            {selectedCount ? <div className="mt-3 rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-3"><input value={bindRoom} onChange={(e) => setBindRoom(e.target.value)} placeholder="Room name (optional)" className="h-10 w-full rounded-full border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/34" disabled={binding} /><button type="button" onClick={onBind} disabled={binding} className="mt-2 h-10 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50">{binding ? "Adding…" : `Add ${selectedCount} device${selectedCount === 1 ? "" : "s"}`}</button></div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function ControlSheet({ device, state, busy, onClose, onDetails, onToggleGang }: { device: AnyDevice; state: any; busy: boolean; onClose: () => void; onDetails: (device: AnyDevice) => void; onToggleGang: (device: AnyDevice, gangIndex: number, next: boolean) => void }) {
  const gangCount = guessGangCount(device, state);
  const values = Object.keys(state || {}).length ? readGangValues(gangCount, state) : Array.from({ length: gangCount }, () => null);
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(14px+var(--sab))]">
        <section className="mx-auto max-w-[430px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
          <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-white/18" /></div>
          <div className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-[-0.04em] text-white">{pickName(device)}</h2><p className="mt-1 truncate text-xs text-white/46">{pickRoomName(device) || "Unassigned"} • {displayState(device, state)}</p></div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/60"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-4">
              <div><div className="text-sm font-semibold text-white">Controls</div><div className="mt-1 text-xs text-white/42">{gangCount > 1 ? `${gangCount} switches` : "One-tap control"}</div></div>
              <GangRingSwitch gangCount={gangCount} online={isOnline(device)} values={values} busy={busy} onToggleGang={(gangIndex, next) => onToggleGang(device, gangIndex, next)} size={64} />
            </div>
            <button type="button" onClick={() => onDetails(device)} className="mt-3 h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.045] text-sm font-medium text-white/76">View simple details</button>
          </div>
        </section>
      </div>
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
