"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConsumerShell from "@/app/components/ConsumerShell";
import useActiveContext from "@/hooks/useActiveContext";
import { roomsService, RoomDTO } from "@/services/roomsService";
import { deviceService, type DeviceRuntimeSummary } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";
import { getDeviceFamily, getDeviceIcon } from "@/lib/devicePresentation";

type AnyDevice = Record<string, any>;

function pickId(d: AnyDevice) {
  return d.id || d.device_id || d.devId || d.uuid || d.external_id || d.externalId || null;
}
function pickName(d: AnyDevice) {
  return d.name || d.local_name || d.localName || d.alias || "Unnamed Device";
}
function pickVendor(d: AnyDevice) {
  return d.vendor || d.adapter || d.protocol || d.brand || "device";
}
function isOnline(d: AnyDevice, runtime?: Partial<DeviceRuntimeSummary> | null): boolean | null {
  const normalized = runtime?.normalized_state || d?.normalized_state || {};
  if (typeof normalized?.online === "boolean") return normalized.online;
  if (runtime?.primary_state && /offline|unavailable/i.test(String(runtime.primary_state))) return false;
  if (runtime?.health_status && /offline|unavailable/i.test(String(runtime.health_status))) return false;
  if (typeof d.online === "boolean") return d.online;
  if (typeof d.isOnline === "boolean") return d.isOnline;
  if (typeof d.connected === "boolean") return d.connected;
  return null;
}
function cleanBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return !!v;
  if (v === "on") return true;
  if (v === "off") return false;
  return null;
}

function switchCodes(device: AnyDevice, runtime: Partial<DeviceRuntimeSummary> | null | undefined, state: any) {
  const channels = Array.isArray(runtime?.channel_definitions) ? runtime.channel_definitions : Array.isArray(device?.channel_definitions) ? device.channel_definitions : [];
  const channelCodes = channels.filter((channel: any) => channel?.controllable !== false && channel?.code).map((channel: any) => String(channel.code));
  if (channelCodes.length) return channelCodes.slice(0, 3);
  const codes = [
    ...(Array.isArray(runtime?.capability_codes) ? runtime.capability_codes : []),
    ...(Array.isArray(runtime?.supported_controls) ? runtime.supported_controls : []),
    ...(Array.isArray(device?.capability_codes) ? device.capability_codes : []),
    ...(Array.isArray(device?.supported_controls) ? device.supported_controls : []),
    ...Object.keys(state || {}),
  ].map((code) => String(code));
  return Array.from(new Set(codes.filter((code) => code === "switch" || code === "power" || /^switch_\d+$/i.test(code)))).slice(0, 3);
}

function canPowerControl(device: AnyDevice, runtime: Partial<DeviceRuntimeSummary> | null | undefined, state: any) {
  const family = getDeviceFamily(runtime ? { ...device, ...runtime } : device);
  if (!["switch", "plug", "light"].includes(family)) return false;
  return switchCodes(device, runtime, state).length > 0;
}

function guessGangCount(device: AnyDevice, state: any, runtime?: Partial<DeviceRuntimeSummary> | null): 1 | 2 | 3 {
  const runtimeCodes = switchCodes(device, runtime, state).filter((code) => /^switch_\d+$/i.test(code));
  if (runtimeCodes.length >= 3) return 3;
  if (runtimeCodes.length === 2) return 2;
  const raw = (device?.metadata?.raw ?? device?.metadata ?? device?.meta ?? {}) as any;

  const rawKeys = Object.keys(raw || {});
  const has2 = rawKeys.some(
    (k) => k === "switch_2" || k === "switch_2_code" || k === "switch2" || k === "switch2_code"
  );
  const has3 = rawKeys.some(
    (k) => k === "switch_3" || k === "switch_3_code" || k === "switch3" || k === "switch3_code"
  );
  if (has3) return 3;
  if (has2) return 2;

  const keys = Object.keys(state || {});
  if (keys.includes("switch_3") || keys.includes("switch3")) return 3;
  if (keys.includes("switch_2") || keys.includes("switch2")) return 2;

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
  for (let i = 1; i <= gangCount; i++) {
    out.push(cleanBool(state?.[`switch_${i}`]) ?? cleanBool(state?.[`switch${i}`]) ?? null);
  }
  if (gangCount === 1 && out[0] === null) {
    const v = cleanBool(state?.switch) ?? cleanBool(state?.power) ?? cleanBool(state?.on);
    if (v !== null) out[0] = v;
  }
  return out;
}

function resolveGangCode(device: AnyDevice, runtime: Partial<DeviceRuntimeSummary> | null | undefined, state: any, gangIndex: number) {
  const codes = switchCodes(device, runtime, state);
  if (codes[gangIndex]) return codes[gangIndex];
  return codes[0] || (gangIndex === 0 ? "switch" : `switch_${gangIndex + 1}`);
}

export default function RoomClient() {
  const router = useRouter();
  const params = useSearchParams();
  const activeContext = useActiveContext();

  const roomId = useMemo(() => params.get("roomId") || "", [params]);
  const homeId = activeContext.home_id;
  const contextReady = activeContext.ready;
  const activeContextKeyRef = useRef(activeContext.contextKey);

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [devices, setDevices] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [stateMap, setStateMap] = useState<Record<string, any>>({});
  const [runtimeMap, setRuntimeMap] = useState<Record<string, DeviceRuntimeSummary>>({});
  const [onMap, setOnMap] = useState<Record<string, boolean | null>>({});

  async function loadRoom() {
    if (!contextReady || !roomId || !homeId) return;
    const loadContextKey = activeContext.contextKey;

    setLoading(true);
    setErr(null);

    try {
      const list = await roomsService.getRooms(homeId);
      if (loadContextKey !== activeContextKeyRef.current) return;
      const found = (list || []).find((r: any) => String(r?.id) === String(roomId));

      if (!found) {
        setRoom(null);
        setDevices([]);
        setErr("Room not found in this home.");
        return;
      }

      setRoom(found);

      const devs = Array.isArray((found as any).devices) ? (found as any).devices : [];
      setDevices(devs);
      const runtimeRows = await deviceService.getRuntimeDevices(homeId);
      if (loadContextKey !== activeContextKeyRef.current) return;
      const runtimeById = new Map(runtimeRows.map((row) => [String(row.device_id), row]));

      const next: Record<string, boolean | null> = {};
      const runtimeNext: Record<string, DeviceRuntimeSummary> = {};
      const stateNext: Record<string, any> = {};
      for (const d of devs) {
        const id = pickId(d);
        if (!id) continue;
        const runtime = runtimeById.get(String((d as any).id || (d as any).device_id || id));
        const sid = String(id);
        if (runtime) {
          runtimeNext[sid] = runtime;
          stateNext[sid] = runtime.state || {};
        }
        const listOn =
          cleanBool(runtime?.state?.on) ??
          cleanBool(runtime?.state?.power) ??
          cleanBool(runtime?.state?.switch) ??
          cleanBool(d?.on) ??
          cleanBool(d?.power) ??
          cleanBool(d?.switch);
        if (listOn !== null) next[String(id)] = listOn;
      }
      setRuntimeMap(runtimeNext);
      setStateMap(stateNext);
      if (Object.keys(next).length) setOnMap((p) => ({ ...p, ...next }));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load room");
      setRoom(null);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, contextReady, activeContext.contextKey]);

  useEffect(() => {
    activeContextKeyRef.current = activeContext.contextKey;
    setRoom(null);
    setDevices([]);
    setStateMap({});
    setRuntimeMap({});
    setOnMap({});
  }, [activeContext.contextKey]);

  async function warmState(device: AnyDevice) {
    const id = pickId(device);
    if (!id) return;
    const sid = String(id);

    if (stateMap[sid]) return;

    try {
      const res = await deviceService.getDeviceState(sid);
      const st = (res as any)?.state ?? {};
      setStateMap((p) => ({ ...p, [sid]: st }));
      setRuntimeMap((p) => ({ ...p, [sid]: { ...(p[sid] || {}), ...(res as any), device_id: sid } }));

      const one = cleanBool(st?.switch) ?? cleanBool(st?.power) ?? cleanBool(st?.on);
      if (one !== null) setOnMap((p) => ({ ...p, [sid]: one }));
    } catch {}
  }

  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const id = pickId(device);
    if (!id) return;
    const sid = String(id);
    const runtime = runtimeMap[sid] || null;
    const cached = stateMap[sid] || {};
    if (!canPowerControl(device, runtime, cached)) {
      setErr("This device does not expose a simple power control.");
      return;
    }

    setBusyId(sid);
    setErr(null);

    try {
      const gangCount = guessGangCount(device, cached, runtime);
      const code = resolveGangCode(device, runtime, cached, gangIndex);

      // optimistic patch
      setStateMap((p) => {
        const prev = p[sid] || {};
        const patched: any = { ...prev };
        if (gangCount === 1) {
          patched.switch = next;
          patched.power = next;
          patched.on = next;
        } else {
          patched[`switch_${gangIndex + 1}`] = next;
        }
        return { ...p, [sid]: patched };
      });
      setOnMap((p) => ({ ...p, [sid]: next }));

      await deviceService.commandDevice(sid, { [code]: next });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAll(next: boolean) {
    setErr(null);

    const list = devices
      .map((d) => ({ d, id: pickId(d) }))
      .filter((x) => {
        if (!x.id) return false;
        const sid = String(x.id);
        return canPowerControl(x.d, runtimeMap[sid], stateMap[sid] || {});
      }) as Array<{ d: AnyDevice; id: string }>;

    if (!list.length) return;

    setBusyId("room-all");

    try {
      for (const { d, id } of list) {
        const sid = String(id);
        const cached = stateMap[sid] || {};
        const runtime = runtimeMap[sid] || null;
        const gangCount = guessGangCount(d, cached, runtime);

        // optimistic patch
        setStateMap((p) => {
          const prev = p[sid] || {};
          const patched: any = { ...prev };
          if (gangCount === 1) {
            patched.switch = next;
            patched.power = next;
            patched.on = next;
          } else {
            for (let i = 1; i <= gangCount; i++) patched[`switch_${i}`] = next;
          }
          return { ...p, [sid]: patched };
        });
        setOnMap((p) => ({ ...p, [sid]: next }));

        const cmd: Record<string, any> = {};
        for (let gi = 0; gi < gangCount; gi++) cmd[resolveGangCode(d, runtime, cached, gi)] = next;

        await deviceService.commandDevice(sid, cmd);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Room command failed");
    } finally {
      setBusyId(null);
    }
  }

  const summary = useMemo(() => {
    let online = 0;
    let offline = 0;

    for (const d of devices) {
      const id = pickId(d);
      const o = isOnline(d, id ? runtimeMap[String(id)] : null);
      if (o === true) online++;
      else if (o === false) offline++;
    }

    let anyOn = 0;
    for (const d of devices) {
      const id = pickId(d);
      if (!id) continue;
      const sid = String(id);
      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(d, cached, runtimeMap[sid]);
      const vals = Object.keys(cached).length ? readGangValues(gangCount, cached) : [onMap[sid] ?? null];
      if (vals.some((v) => v === true)) anyOn++;
    }

    return { online, offline, anyOn, total: devices.length };
  }, [devices, runtimeMap, stateMap, onMap]);

  const controllableDevices = useMemo(
    () =>
      devices.filter((device) => {
        const id = pickId(device);
        const sid = id ? String(id) : "";
        return canPowerControl(device, runtimeMap[sid], stateMap[sid] || {});
      }),
    [devices, runtimeMap, stateMap]
  );

  const title = room?.name ? room.name : "Room";
  const subtitle = "Room command center";

  return (
    <ConsumerShell title={title} subtitle={subtitle}>
      {!roomId ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Missing roomId.
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
        <div className="text-xs text-white/55 truncate">
          {loading ? "Syncing room…" : `${summary.total} devices • ${summary.online} online • ${summary.anyOn} active`}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAll(true)}
            disabled={busyId === "room-all" || loading || !controllableDevices.length}
            className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
            type="button"
          >
            All ON
          </button>

          <button
            onClick={() => toggleAll(false)}
            disabled={busyId === "room-all" || loading || !controllableDevices.length}
            className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition disabled:opacity-50"
            type="button"
          >
            All OFF
          </button>

          <button
            onClick={loadRoom}
            disabled={loading}
            className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition disabled:opacity-50"
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {!loading && devices.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          No devices in this room yet.
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 transition"
              onClick={() => router.push("/devices")}
            >
              Add devices
            </button>
            <button
              type="button"
              className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
              onClick={() => router.push("/rooms")}
            >
              Back to rooms
            </button>
          </div>
        </div>
      ) : null}

      {devices.length > 0 ? (
        <div className="mt-4 space-y-3">
          {devices.map((d) => {
            const id = pickId(d);
            const sid = id ? String(id) : "";
            const runtime = runtimeMap[sid] || null;
            const name = pickName(d);
            const vendor = pickVendor(d);
            const online = isOnline(d, runtime);
            const Icon = getDeviceIcon(runtime ? { ...d, ...runtime } : d);

            const cachedState = sid ? stateMap[sid] : {};
            const gangCount = guessGangCount(d, cachedState, runtime);
            const controllable = canPowerControl(d, runtime, cachedState);

            const isBusy = busyId === sid || busyId === "room-all";

            const ringValues =
              Object.keys(cachedState || {}).length > 0
                ? readGangValues(gangCount, cachedState)
                : gangCount === 1
                ? [onMap[sid] ?? null]
                : Array.from({ length: gangCount }, () => null);

            return (
              <div
                key={String(id || name)}
                className="rounded-3xl border border-white/10 bg-white/5 hover:bg-white/7 transition p-4"
                onMouseEnter={() => warmState(d)}
                onFocus={() => warmState(d)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border `}><Icon className="h-4.5 w-4.5" /></span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{name}</div>
                        <div className="mt-0.5 text-[11px] text-white/35">{online === false ? "Offline" : "Ready"}</div>
                      </div>
                    </div>

                    <div className="text-xs text-white/40 mt-1 truncate">
                      {vendor}
                      {online === null ? "" : online ? " • online" : " • offline"}
                      {gangCount > 1 ? ` • ${gangCount}-gang` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {controllable ? (
                      <GangRingSwitch
                        gangCount={gangCount}
                        online={online}
                        values={ringValues}
                        busy={isBusy}
                        onToggleGang={(gangIndex, next) => toggleGang(d, gangIndex, next)}
                        size={64}
                      />
                    ) : (
                      <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] text-white/45">
                        View only
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </ConsumerShell>
  );
}
