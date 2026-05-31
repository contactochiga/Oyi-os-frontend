"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Armchair,
  BedDouble,
  ChevronRight,
  Expand,
  Fan,
  Grid2X2,
  Home,
  Layers3,
  Leaf,
  Lightbulb,
  LoaderCircle,
  Monitor,
  Moon,
  PanelTop,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Tv,
  Utensils,
  Waves,
  X,
} from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import BottomNav from "@/app/components/BottomNav";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import { deviceService } from "@/services/deviceService";
import { sceneService, type ConsumerScene } from "@/services/sceneService";
import { getDeviceFamily, getDeviceIcon } from "@/lib/devicePresentation";

type AnyDevice = Record<string, any>;
type TwinRoom = {
  id: string;
  name: string;
  room: RoomDTO;
  x: number;
  y: number;
  w: number;
  h: number;
  Icon: any;
};

const TWIN_SLOTS = [
  { x: 10, y: 10, w: 29, h: 27 }, // Kitchen
  { x: 61, y: 10, w: 29, h: 27 }, // Master
  { x: 33, y: 32, w: 34, h: 32 }, // Living
  { x: 10, y: 61, w: 29, h: 28 }, // Office
  { x: 61, y: 61, w: 29, h: 28 }, // Bedroom 2
  { x: 38, y: 73, w: 24, h: 19 }, // Outdoor
  { x: 38, y: 10, w: 24, h: 20 },
  { x: 10, y: 39, w: 22, h: 17 },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function pickId(d: AnyDevice) {
  return d.device_id || d.devId || d.external_id || d.externalId || d.id || d.uuid || null;
}
function pickName(d: AnyDevice) {
  return d.name || d.local_name || d.localName || d.alias || "Unnamed Device";
}
function pickType(d: AnyDevice) {
  return String(d.category || d.type || d.device_type || d.product_name || d.name || "device").toLowerCase();
}
function isOnline(d: AnyDevice): boolean | null {
  if (typeof d.online === "boolean") return d.online;
  if (typeof d.isOnline === "boolean") return d.isOnline;
  if (typeof d.connected === "boolean") return d.connected;
  return null;
}
function cleanBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return !!v;
  if (String(v).toLowerCase() === "on") return true;
  if (String(v).toLowerCase() === "off") return false;
  return null;
}
function deviceFamily(device: AnyDevice) {
  return getDeviceFamily(device);
}
function iconForDevice(device: AnyDevice) {
  return getDeviceIcon(device);
}
function roomIcon(name: string, index: number) {
  const text = name.toLowerCase();
  if (/living|lounge|sitting/.test(text)) return Armchair;
  if (/kitchen|dining/.test(text)) return Utensils;
  if (/master|bed/.test(text)) return BedDouble;
  if (/office|study|work/.test(text)) return Monitor;
  if (/outdoor|balcony|garden|yard|patio/.test(text)) return Leaf;
  return [Utensils, BedDouble, Armchair, Monitor, BedDouble, Leaf, Home][index % 7];
}
function shortRoomName(name: string) {
  return name.replace(/ room$/i, "").replace(/bedroom/i, "Bedroom").trim() || "Space";
}
function normalizeCommand(device: AnyDevice, next: boolean) {
  if (deviceFamily(device) === "curtain") return { open: next };
  return { switch: next };
}
function readOnState(device: AnyDevice, state: any) {
  return cleanBool(state?.switch) ?? cleanBool(state?.power) ?? cleanBool(state?.on) ?? cleanBool(device?.switch) ?? cleanBool(device?.power) ?? cleanBool(device?.on);
}
function deviceSubtitle(device: AnyDevice, state: any) {
  if (["climate", "thermostat", "fan", "purifier", "heater"].includes(deviceFamily(device))) {
    const temp = state?.temp_current ?? state?.temperature ?? device?.temperature;
    return temp ? `${temp}°` : "Climate";
  }
  if (deviceFamily(device) === "curtain") return readOnState(device, state) ? "Open" : "Closed";
  return isOnline(device) === false ? "Offline" : "Ready";
}
function when(value?: string | null) {
  if (!value) return "Not synced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function RoomsClient() {
  const router = useRouter();
  const { user } = useAuth();
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const estateId = useMemo(() => user?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null), [user?.estate_id]);
  const homeId = useMemo(() => (user as any)?.home_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null), [user]);

  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [selectedId, setSelectedId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [stateMap, setStateMap] = useState<Record<string, any>>({});
  const [onMap, setOnMap] = useState<Record<string, boolean | null>>({});
  const [configuredScenes, setConfiguredScenes] = useState<ConsumerScene[]>([]);

  async function loadRooms() {
    if (!homeId) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await roomsService.getRooms(homeId);
      const next = Array.isArray(list) ? list : [];
      setRooms(next);
      setSelectedId((current) => (current !== "all" && !next.some((room) => String(room.id) === current) ? "all" : current));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load spaces");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!homeId) return;
    void loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  useEffect(() => {
    let cancelled = false;
    sceneService.listScenes()
      .then((items) => { if (!cancelled) setConfiguredScenes(items); })
      .catch(() => { if (!cancelled) setConfiguredScenes([]); });
    return () => { cancelled = true; };
  }, [estateId, homeId]);

  const allDevices = useMemo(() => rooms.flatMap((room) => (Array.isArray(room.devices) ? room.devices.map((device) => ({ ...device, __roomId: room.id, __roomName: room.name })) : [])), [rooms]);
  const selectedRoom = useMemo(() => rooms.find((room) => String(room.id) === selectedId) || null, [rooms, selectedId]);
  const selectedDevices = useMemo(() => {
    if (selectedRoom) return Array.isArray(selectedRoom.devices) ? selectedRoom.devices.map((device) => ({ ...device, __roomId: selectedRoom.id, __roomName: selectedRoom.name })) : [];
    return allDevices;
  }, [allDevices, selectedRoom]);

  const twinRooms = useMemo<TwinRoom[]>(() => rooms.map((room, index) => ({ id: String(room.id), name: room.name || `Space ${index + 1}`, room, Icon: roomIcon(room.name || "", index), ...TWIN_SLOTS[index % TWIN_SLOTS.length] })), [rooms]);

  const summary = useMemo(() => {
    const devices = selectedDevices;
    const online = devices.filter((d) => isOnline(d) === true).length;
    const knownOffline = devices.filter((d) => isOnline(d) === false).length;
    let active = 0;
    let lastSync: string | null = null;
    for (const device of devices) {
      const id = pickId(device);
      const sid = id ? String(id) : "";
      const st = stateMap[sid] || {};
      if (readOnState(device, st) === true || onMap[sid] === true) active += 1;
      const candidate = st?.lastSeen || st?.last_seen || device?.last_seen || device?.updated_at;
      if (candidate && (!lastSync || new Date(candidate).getTime() > new Date(lastSync).getTime())) lastSync = candidate;
    }
    const temp = selectedRoom?.ai_profile?.temperature ?? selectedRoom?.ai_profile?.temp ?? null;
    const occupancy = selectedRoom ? (devices.length ? "Responsive" : "No devices") : rooms.length ? `${rooms.length} spaces` : "Not mapped";
    const ambience = active ? "Active" : devices.length ? "Calm" : "Unavailable";
    return { total: devices.length, online, knownOffline, active, temp, occupancy, ambience, lastSync };
  }, [onMap, rooms.length, selectedDevices, selectedRoom, stateMap]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const targets = selectedDevices.slice(0, 8);
      const updates: Record<string, any> = {};
      const nextOn: Record<string, boolean | null> = {};
      await Promise.all(targets.map(async (device) => {
        const id = pickId(device);
        if (!id) return;
        const sid = String(id);
        if (stateMap[sid]) return;
        const res = await deviceService.getDeviceState(sid);
        updates[sid] = res?.state || {};
        nextOn[sid] = readOnState(device, updates[sid]);
      }));
      if (cancelled) return;
      if (Object.keys(updates).length) setStateMap((prev) => ({ ...prev, ...updates }));
      if (Object.keys(nextOn).length) setOnMap((prev) => ({ ...prev, ...nextOn }));
    }
    void hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedDevices.length]);

  function focusSpace(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => chipRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
  }

  async function createRoom() {
    if (!estateId) return setErr("No estate context found for this user.");
    if (!homeId) return setErr("No home context found for this user.");
    const name = newSpaceName.trim();
    if (!name) {
      setCreateOpen(true);
      return setErr("Enter a space name.");
    }
    setLoading(true);
    setErr(null);
    try {
      await roomsService.createRoom({ estate_id: estateId, home_id: homeId, name, type: null, ai_profile: null });
      setNewSpaceName("");
      setCreateOpen(false);
      await loadRooms();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to create space");
    } finally {
      setLoading(false);
    }
  }

  async function toggleDevice(device: AnyDevice, next: boolean) {
    const id = pickId(device);
    if (!id || isOnline(device) === false) return;
    const sid = String(id);
    setBusyId(sid);
    setErr(null);
    const command = normalizeCommand(device, next);
    setOnMap((prev) => ({ ...prev, [sid]: next }));
    setStateMap((prev) => ({ ...prev, [sid]: { ...(prev[sid] || {}), ...command } }));
    try {
      await deviceService.commandDevice(sid, command);
      const res = await deviceService.getDeviceState(sid);
      setStateMap((prev) => ({ ...prev, [sid]: res?.state || prev[sid] || {} }));
      setOnMap((prev) => ({ ...prev, [sid]: readOnState(device, res?.state || {}) ?? next }));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      setOnMap((prev) => ({ ...prev, [sid]: !next }));
    } finally {
      setBusyId(null);
    }
  }

  const favoriteControls = selectedDevices.filter((device) => !["camera", "lock", "security"].includes(deviceFamily(device))).slice(0, 6);
  const scenes = useMemo(() => {
    const allow = new Set(selectedDevices.map((device) => String(pickId(device) || "")).filter(Boolean));
    return configuredScenes.filter((scene) => !selectedRoom || !scene.actions?.length || scene.actions.some((action) => allow.has(String(action.device_id))));
  }, [configuredScenes, selectedDevices, selectedRoom]);

  const chips = [{ id: "all", label: "All Spaces", Icon: Grid2X2 }, ...rooms.map((room, index) => ({ id: String(room.id), label: shortRoomName(room.name || `Space ${index + 1}`), Icon: roomIcon(room.name || "", index) }))];
  const selectedLabel = selectedRoom?.name || "All Spaces";

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="relative z-10 h-full overflow-y-auto px-4 pb-[calc(118px+var(--sab))] pt-[calc(14px+var(--sat))]">
          <div className="mx-auto w-full max-w-[860px] space-y-3.5">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <HamburgerMenu />
                <div>
                  <h1 className="text-[31px] font-semibold leading-none tracking-[-0.055em] text-white">Spaces</h1>
                  <p className="mt-2 text-[13px] leading-5 text-white/54">Your home&apos;s living environment.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessagesInboxButton />
                <button type="button" onClick={() => router.push("/ai")} className="hidden h-11 w-11 place-items-center rounded-full border border-sky-300/25 bg-sky-400/10 text-sky-200 shadow-[0_0_22px_rgba(56,189,248,0.16)] sm:grid" aria-label="Open Oyi AI">
                  <Waves className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map(({ id, label, Icon }) => {
                const active = selectedId === id;
                return (
                  <button key={id} ref={(node) => { chipRefs.current[id] = node; }} type="button" onClick={() => focusSpace(id)} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-all duration-300", active ? "border-blue-400/70 bg-blue-500/12 text-sky-200 shadow-[0_0_16px_rgba(0,122,255,0.18)]" : "border-white/[0.075] bg-white/[0.025] text-white/62")}>
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {err ? <div className="rounded-[16px] border border-red-300/15 bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-100">{err}</div> : null}
            {!homeId ? <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-4 text-[12px] text-white/58">No home selected yet. Join or choose a home to view spaces.</div> : null}

            <section className="relative overflow-hidden rounded-[32px] border border-white/[0.075] bg-[#030914]/90 p-3 shadow-[0_24px_86px_rgba(0,0,0,0.50)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_43%,rgba(0,122,255,0.24),transparent_39%),radial-gradient(circle_at_22%_24%,rgba(14,165,233,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),transparent)]" />
              <div className="absolute inset-3 rounded-[26px] border border-white/[0.045] bg-[#020812]/58" />
              <div className="absolute inset-3 opacity-[0.14] [background-image:linear-gradient(rgba(59,130,246,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,.45)_1px,transparent_1px)] [background-size:30px_30px]" />

              <div className="relative z-10 grid gap-3 md:min-h-[536px] md:grid-cols-[minmax(162px,30%)_minmax(0,1fr)_42px]">
                <RoomSummaryPanel selectedLabel={selectedLabel} selectedRoom={selectedRoom} summary={summary} onDetails={() => setDetailsOpen(true)} />

                <div className="relative h-[390px] min-w-0 overflow-hidden rounded-[26px] border border-white/[0.035] bg-black/10 md:h-auto">
                {loading ? <div className="absolute inset-0 z-20 grid place-items-center bg-black/20 text-[12px] text-white/58"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> Syncing spaces...</div> : null}
                {twinRooms.length ? (
                  <div className="absolute inset-3 transition-transform duration-500 ease-out">
                    <div className="pointer-events-none absolute left-[36%] top-[38%] h-[22%] w-[28%] rounded-[20px] border border-sky-300/10 bg-sky-400/[0.025]" />
                    <div className="pointer-events-none absolute left-[24%] top-[30%] h-[1px] w-[52%] bg-sky-300/15" />
                    <div className="pointer-events-none absolute left-[24%] top-[63%] h-[1px] w-[52%] bg-sky-300/15" />
                    <div className="pointer-events-none absolute left-[49%] top-[25%] h-[52%] w-[1px] bg-sky-300/15" />
                    <div className="pointer-events-none absolute left-[50%] top-[58%] h-[17%] w-[1px] bg-sky-300/16" />

                    {twinRooms.map((space) => {
                      const active = selectedId === "all" || selectedId === space.id;
                      const RoomIcon = space.Icon;
                      return (
                        <button key={space.id} type="button" onClick={() => focusSpace(space.id)} className={cn("absolute rounded-[16px] border text-left transition-all duration-500 ease-out", active ? "z-10 scale-[1.035] border-sky-300/85 bg-sky-400/[0.13] shadow-[0_0_38px_rgba(0,122,255,0.58),inset_0_0_32px_rgba(0,122,255,0.22)]" : "scale-[0.985] border-slate-400/18 bg-white/[0.03] opacity-56 hover:scale-[1.01] hover:opacity-90")} style={{ left: `${space.x}%`, top: `${space.y}%`, width: `${space.w}%`, height: `${space.h}%` }}>
                          <div className="relative flex h-full flex-col items-center justify-center gap-1.5 px-1 text-center">
                            {active ? <span className="pointer-events-none absolute inset-1 rounded-[14px] border border-sky-200/30 animate-pulse" /> : null}
                            {active && selectedId !== "all" ? <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-emerald-300/12 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">{summary.occupancy}</span> : null}
                            <span className={cn("grid h-10 w-10 place-items-center rounded-full border transition-all duration-500", active ? "border-sky-300/30 bg-sky-400/18 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.32)]" : "border-white/10 bg-white/[0.04] text-white/42")}><RoomIcon className="h-4 w-4" /></span>
                            <span className="max-w-full truncate text-[11px] font-semibold text-white/88">{shortRoomName(space.name)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-6 text-center">
                    <div>
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-sky-300/15 bg-sky-400/10 text-sky-200"><Home className="h-5 w-5" /></div>
                      <div className="mt-3 text-sm font-semibold text-white">No spaces mapped yet.</div>
                      <div className="mt-1 text-xs text-white/45">Add your first room to build the living environment map.</div>
                      <button type="button" onClick={() => setCreateOpen(true)} disabled={loading || !homeId} className="mt-4 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black disabled:opacity-50">Add Space</button>
                    </div>
                  </div>
                )}
                </div>

                <div className="relative z-20 flex flex-row gap-2 md:flex-col">
                  <TwinControl label="2D" active Icon={Grid2X2} />
                  <TwinControl label="Layers" Icon={Layers3} />
                  <TwinControl label="Expand" Icon={Expand} />
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Favorite Controls</h2>
                <button type="button" onClick={loadRooms} disabled={loading || !homeId} className="text-[11px] font-medium text-sky-300/76">Refresh</button>
              </div>
              {favoriteControls.length ? (
                <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {favoriteControls.map((device) => {
                    const id = pickId(device);
                    const sid = id ? String(id) : "";
                    const state = stateMap[sid] || {};
                    const on = onMap[sid] ?? readOnState(device, state);
                    const Icon = iconForDevice(device);
                    const online = isOnline(device);
                    return (
                      <button key={sid || pickName(device)} type="button" disabled={!sid || online === false || busyId === sid} onClick={() => void toggleDevice(device, !(on === true))} className="min-h-[78px] w-[142px] shrink-0 snap-start rounded-[18px] border border-white/[0.065] bg-white/[0.03] p-2.5 text-left transition hover:bg-white/[0.052] disabled:opacity-45">
                        <div className="flex h-full flex-col justify-between">
                          <div>
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-sky-300/12 bg-sky-400/10 text-sky-200"><Icon className="h-3.5 w-3.5" /></span>
                            <div className="mt-2 line-clamp-1 text-[12px] font-semibold leading-4 text-white">{pickName(device)}</div>
                            <div className="mt-0.5 text-[10px] text-white/42">{device.__roomName || selectedLabel}</div>
                          </div>
                          <div className="mt-2 flex items-end justify-between gap-2">
                            <div className={cn("text-[10px] font-semibold", on === true ? "text-emerald-300" : "text-white/52")}>{on === true ? "ON" : deviceSubtitle(device, state)}</div>
                            <span className={cn("h-4 w-8 rounded-full p-0.5 transition", on === true ? "bg-blue-500" : "bg-white/18")}><span className={cn("block h-3 w-3 rounded-full bg-white transition", on === true && "translate-x-4")} /></span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : <EmptyPanel title="No favorite controls yet." body="Assigned room controls will appear here when devices are mapped." />}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Active Scenes</h2>
                <button type="button" onClick={() => router.push("/scenes")} className="text-[11px] font-medium text-sky-300/76">Manage</button>
              </div>
              {scenes.length ? (
                <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {scenes.slice(0, 6).map((scene, index) => {
                    const Icon = [Moon, Lightbulb, Home, ShieldCheck, Leaf][index % 5];
                    return (
                      <button key={scene.id} type="button" onClick={() => router.push("/scenes")} className="w-[112px] shrink-0 snap-start rounded-[18px] border border-sky-300/24 bg-sky-400/[0.04] p-3 text-center shadow-[0_0_16px_rgba(0,122,255,0.12)]">
                        <span className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-sky-300/12 bg-sky-400/10 text-sky-200"><Icon className="h-3.5 w-3.5" /></span>
                        <div className="mt-2 truncate text-[12px] font-semibold text-white">{scene.name}</div>
                        <div className="mt-1 text-[10px] text-emerald-300">Configured</div>
                      </button>
                    );
                  })}
                </div>
              ) : <EmptyPanel title="No active scenes yet." body="Scenes will appear after they are configured from your real device setup." />}
            </section>
          </div>
        </div>
        <BottomNav />
        {detailsOpen ? <RoomDetailsSheet roomName={selectedLabel} summary={summary} onClose={() => setDetailsOpen(false)} /> : null}
        {createOpen ? (
          <CreateSpaceSheet
            value={newSpaceName}
            loading={loading}
            onChange={setNewSpaceName}
            onClose={() => { setCreateOpen(false); setErr(null); }}
            onCreate={createRoom}
          />
        ) : null}
      </main>
    </LayoutWrapper>
  );
}

function CreateSpaceSheet({ value, loading, onChange, onClose, onCreate }: { value: string; loading?: boolean; onChange: (value: string) => void; onClose: () => void; onCreate: () => void }) {
  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 px-4 pb-[calc(18px+var(--sab))] backdrop-blur-md sm:items-center sm:pb-4">
      <button type="button" className="absolute inset-0" aria-label="Close create space" onClick={onClose} />
      <form
        className="relative w-full max-w-[380px] rounded-[30px] border border-white/[0.09] bg-[#050a12]/94 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl"
        onSubmit={(event) => { event.preventDefault(); onCreate(); }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-sky-100/48">Living environment</div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-white">Add a space</h2>
            <p className="mt-1 text-xs text-white/45">Name the room exactly as residents should see it.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/50 transition hover:bg-white/[0.1]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
          placeholder="Living Room"
          className="mt-4 w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30"
        />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-[16px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white/68">Cancel</button>
          <button type="submit" disabled={loading || !value.trim()} className="flex-1 rounded-[16px] bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-45">{loading ? "Creating..." : "Create"}</button>
        </div>
      </form>
    </div>
  );
}

function TwinControl({ label, Icon, active }: { label: string; Icon: any; active?: boolean }) {
  return <button type="button" aria-label={label} className={cn("grid h-10 w-10 place-items-center rounded-[15px] border text-[11px] transition", active ? "border-sky-300/55 bg-sky-400/14 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.20)]" : "border-white/[0.07] bg-black/25 text-white/48 backdrop-blur-xl")}><Icon className="h-4 w-4" /></button>;
}

function RoomSummaryPanel({ selectedLabel, selectedRoom, summary, onDetails }: { selectedLabel: string; selectedRoom: RoomDTO | null; summary: any; onDetails: () => void }) {
  return (
    <div className="relative z-20 rounded-[22px] border border-white/[0.055] bg-[#050b14]/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_50px_rgba(0,0,0,0.30)] backdrop-blur-xl">
      <h2 className="line-clamp-2 text-[21px] font-semibold leading-6 tracking-[-0.05em] text-white">{selectedLabel}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:mt-4 md:block md:space-y-3.5">
        <MiniMetric Icon={Waves} label="Occupancy" value={summary.occupancy} tone="text-emerald-300" />
        <MiniMetric Icon={Thermometer} label="Environment" value={summary.temp ? `${summary.temp}°C` : "Unavailable"} tone="text-cyan-300" />
        <MiniMetric Icon={Leaf} label="Ambience" value={summary.ambience} tone="text-amber-300" />
        <MiniMetric Icon={Layers3} label="Active Scene" value={selectedRoom?.ai_profile?.active_scene || "Not configured"} tone="text-violet-300" />
      </div>
      <button type="button" onClick={onDetails} className="mt-3 inline-flex h-9 items-center gap-2 rounded-full md:mt-4 bg-sky-400/12 px-3.5 text-[12px] font-semibold text-sky-200 transition hover:bg-sky-400/18">View Details <ChevronRight className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function MiniMetric({ Icon, label, value, tone }: { Icon: any; label: string; value: string; tone: string }) {
  return <div className="flex items-start gap-2.5"><Icon className={cn("mt-0.5 h-4 w-4", tone)} /><div><div className="text-[10px] text-white/38">{label}</div><div className="mt-0.5 text-[13px] font-semibold text-white/86">{value}</div></div></div>;
}
function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="rounded-[18px] border border-white/[0.065] bg-white/[0.03] px-4 py-4 text-center"><div className="text-[13px] font-semibold text-white/82">{title}</div><div className="mt-1 text-[11px] leading-5 text-white/42">{body}</div></div>;
}
function RoomDetailsSheet({ roomName, summary, onClose }: { roomName: string; summary: any; onClose: () => void }) {
  const items = [
    { label: "Occupancy", value: summary.occupancy, detail: summary.total ? `${summary.total} assigned devices` : "No mapped devices", Icon: Waves, tone: "text-emerald-300" },
    { label: "Environment", value: summary.temp ? `${summary.temp}°C` : "Unavailable", detail: "Source not configured", Icon: Thermometer, tone: "text-cyan-300" },
    { label: "Air Quality", value: "Unavailable", detail: "Sensor not configured", Icon: Fan, tone: "text-emerald-300" },
    { label: "Energy Usage", value: "Unavailable", detail: "Meter not configured", Icon: Lightbulb, tone: "text-amber-300" },
    { label: "Devices Online", value: `${summary.online}/${summary.total}`, detail: summary.knownOffline ? `${summary.knownOffline} offline` : "Known devices responsive", Icon: Layers3, tone: "text-sky-300" },
    { label: "Active Scene", value: "Not configured", detail: "No scene binding", Icon: Moon, tone: "text-violet-300" },
    { label: "Security State", value: "Unavailable", detail: "Security source not configured", Icon: ShieldCheck, tone: "text-emerald-300" },
    { label: "Last Sync", value: when(summary.lastSync), detail: summary.lastSync ? "Device state source" : "No sync timestamp", Icon: RefreshCw, tone: "text-sky-300" },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-[110] px-4 pb-[calc(10px+var(--sab))]">
      <div className="mx-auto max-w-[820px] rounded-[28px] border border-white/[0.075] bg-[#050b14]/96 p-4 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/35" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold tracking-[-0.045em] text-white">{roomName} Details</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/66"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(({ label, value, detail, Icon, tone }) => (
            <div key={label} className="rounded-[18px] border border-white/[0.055] bg-white/[0.026] p-3">
              <Icon className={cn("h-4 w-4", tone)} />
              <div className="mt-2 text-[11px] text-white/42">{label}</div>
              <div className="mt-1 text-[13px] font-semibold text-white/88">{value}</div>
              <div className="mt-1 text-[10px] leading-4 text-white/34">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
