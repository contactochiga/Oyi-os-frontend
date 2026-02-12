// src/app/room/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import { deviceService } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";

type AnyDevice = Record<string, any>;

function pickId(d: AnyDevice) {
  return d.device_id || d.devId || d.external_id || d.externalId || d.id || d.uuid || null;
}

function pickName(d: AnyDevice) {
  return d.name || d.local_name || d.localName || d.alias || "Unnamed Device";
}

function pickVendor(d: AnyDevice) {
  return d.vendor || d.adapter || d.protocol || d.brand || "device";
}

function isOnline(d: AnyDevice): boolean | null {
  if (typeof d.online === "boolean") return d.online;
  if (typeof d.isOnline === "boolean") return d.isOnline;
  if (typeof d.connected === "boolean") return d.connected;
  return null;
}

function statusDot(online: boolean | null) {
  if (online === null) return "bg-white/20";
  return online ? "bg-emerald-500" : "bg-white/25";
}

function cleanBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return !!v;
  if (v === "on") return true;
  if (v === "off") return false;
  return null;
}

function guessGangCount(device: AnyDevice, state: any): 1 | 2 | 3 {
  const raw = (device?.metadata?.raw ?? device?.metadata ?? device?.meta ?? {}) as any;

  const rawKeys = Object.keys(raw || {});
  const has2 = rawKeys.some((k) => k === "switch_2" || k === "switch_2_code" || k === "switch2" || k === "switch2_code");
  const has3 = rawKeys.some((k) => k === "switch_3" || k === "switch_3_code" || k === "switch3" || k === "switch3_code");
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

// IMPORTANT: keep command keys exactly like your working page
function resolveGangCode(gangCount: 1 | 2 | 3, gangIndex: number) {
  return gangCount === 1 ? "switch" : `switch_${gangIndex + 1}`;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const roomId = useMemo(() => params.get("roomId") || "", [params]);

  const homeId = useMemo(
    () =>
      (user as any)?.home_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null),
    [user]
  );

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [devices, setDevices] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // caches for rings
  const [stateMap, setStateMap] = useState<Record<string, any>>({});
  const [onMap, setOnMap] = useState<Record<string, boolean | null>>({});

  async function loadRoom() {
    if (!roomId || !homeId) return;

    setLoading(true);
    setErr(null);

    try {
      // We rely on your roomsService.getRooms(homeId) shape (RoomDTO includes devices)
      const list = await roomsService.getRooms(homeId);
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

      // seed onMap from list if possible
      const next: Record<string, boolean | null> = {};
      for (const d of devs) {
        const id = pickId(d);
        if (!id) continue;
        const listOn = cleanBool(d?.on) ?? cleanBool(d?.power) ?? cleanBool(d?.switch);
        if (listOn !== null) next[String(id)] = listOn;
      }
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
  }, [roomId, homeId]);

  async function warmState(device: AnyDevice) {
    const id = pickId(device);
    if (!id) return;
    const sid = String(id);

    if (stateMap[sid]) return;

    try {
      const res = await deviceService.getDeviceState(sid);
      const st = (res as any)?.state ?? {};
      setStateMap((p) => ({ ...p, [sid]: st }));

      // if it looks like a single switch, seed onMap
      const one = cleanBool(st?.switch) ?? cleanBool(st?.power) ?? cleanBool(st?.on);
      if (one !== null) setOnMap((p) => ({ ...p, [sid]: one }));
    } catch {}
  }

  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const id = pickId(device);
    if (!id) return;
    const sid = String(id);

    setBusyId(sid);
    setErr(null);

    try {
      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);
      const code = resolveGangCode(gangCount, gangIndex);

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

    // only send to devices with IDs
    const list = devices
      .map((d) => ({ d, id: pickId(d) }))
      .filter((x) => !!x.id) as Array<{ d: AnyDevice; id: string }>;

    if (!list.length) return;

    // small UX: show one busy at a time? we just set a pseudo busy
    setBusyId("room-all");

    try {
      for (const { d, id } of list) {
        const sid = String(id);
        const cached = stateMap[sid] || {};
        const gangCount = guessGangCount(d, cached);

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

        // command: set each gang
        const cmd: Record<string, any> = {};
        for (let gi = 0; gi < gangCount; gi++) {
          cmd[resolveGangCode(gangCount, gi)] = next;
        }

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
      const o = isOnline(d);
      if (o === true) online++;
      else if (o === false) offline++;
    }

    // estimate “on” count using cached states if available
    let anyOn = 0;
    for (const d of devices) {
      const id = pickId(d);
      if (!id) continue;
      const sid = String(id);
      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(d, cached);
      const vals = Object.keys(cached).length ? readGangValues(gangCount, cached) : [onMap[sid] ?? null];
      if (vals.some((v) => v === true)) anyOn++;
    }

    return { online, offline, anyOn, total: devices.length };
  }, [devices, stateMap, onMap]);

  const title = room?.name ? room.name : "Room";
  const subtitle = "Room command center";

  return (
    <ConsumerShell title={title} subtitle={subtitle} showBack backHref="/rooms">
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

      {/* Top actions */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
        <div className="text-xs text-white/55 truncate">
          {loading ? "Syncing room…" : `${summary.total} devices • ${summary.online} online • ${summary.anyOn} active`}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAll(true)}
            disabled={busyId === "room-all" || loading}
            className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
            type="button"
          >
            All ON
          </button>

          <button
            onClick={() => toggleAll(false)}
            disabled={busyId === "room-all" || loading}
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

      {/* Empty state */}
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

      {/* Device list */}
      {devices.length > 0 ? (
        <div className="mt-4 space-y-3">
          {devices.map((d) => {
            const id = pickId(d);
            const sid = id ? String(id) : "";
            const name = pickName(d);
            const vendor = pickVendor(d);
            const online = isOnline(d);

            const cachedState = sid ? stateMap[sid] : {};
            const gangCount = guessGangCount(d, cachedState);

            const isBusy = (busyId === sid) || (busyId === "room-all");

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
                      <span className={`h-2 w-2 rounded-full ${statusDot(online)}`} aria-hidden="true" />
                      <div className="text-sm text-white font-medium truncate">{name}</div>
                    </div>

                    <div className="text-xs text-white/40 mt-1 truncate">
                      {vendor}
                      {online === null ? "" : online ? " • online" : " • offline"}
                      {gangCount > 1 ? ` • ${gangCount}-gang` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <GangRingSwitch
                      gangCount={gangCount}
                      online={online}
                      values={ringValues}
                      busy={isBusy}
                      onToggleGang={(gangIndex, next) => toggleGang(d, gangIndex, next)}
                      size={64}
                    />
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
