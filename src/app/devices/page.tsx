// src/app/devices/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";

type AnyDevice = Record<string, any>;

function pickId(d: AnyDevice) {
  return d.device_id || d.devId || d.external_id || d.externalId || d.id || d.uuid || null;
}

function pickName(d: AnyDevice) {
  return d.name || d.local_name || d.localName || d.alias || "Unnamed Device";
}

function pickType(d: AnyDevice) {
  const t =
    d.type ||
    d.category ||
    d.device_type ||
    d.product_name ||
    d.productName ||
    d.protocol ||
    "";
  return String(t || "").toLowerCase();
}

function pickRoom(d: AnyDevice) {
  return d.room?.name || d.room_name || d.roomName || d.metadata?.room || "Home";
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
  if (v === "on") return true;
  if (v === "off") return false;
  return null;
}

function guessIsOn(state: any): boolean | null {
  if (!state) return null;

  const direct =
    cleanBool(state?.on) ??
    cleanBool(state?.power) ??
    cleanBool(state?.switch);

  if (direct !== null) return direct;

  const dps = state.dps || state?.raw?.dps || null;
  if (dps && typeof dps === "object") {
    const candidates = ["1", "switch", "switch_1", "power"];
    for (const k of candidates) {
      const v = cleanBool(dps[k]);
      if (v !== null) return v;
    }
  }
  return null;
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
  for (let i = 1; i <= gangCount; i++) {
    out.push(cleanBool(state?.[`switch_${i}`]));
  }

  if (gangCount === 1 && out[0] === null) {
    const v = cleanBool(state?.switch) ?? cleanBool(state?.power) ?? cleanBool(state?.on);
    if (v !== null) out[0] = v;
  }
  return out;
}

function looksLikeSwitchCard(d: AnyDevice) {
  const t = pickType(d);
  // your AC switch + light switches must behave like switches
  return (
    t.includes("switch") ||
    t.includes("light") ||
    t.includes("bulb") ||
    t.includes("lamp") ||
    t.includes("ac")
  );
}

type CategoryKey = "favorites" | "lighting" | "climate" | "media" | "security" | "all";

function categorize(d: AnyDevice): CategoryKey {
  const t = pickType(d);

  if (t.includes("switch") || t.includes("light") || t.includes("lamp") || t.includes("bulb")) return "lighting";
  if (t.includes("ac") || t.includes("air") || t.includes("hvac") || t.includes("therm")) return "climate";
  if (t.includes("tv") || t.includes("media") || t.includes("ir") || t.includes("remote")) return "media";
  if (t.includes("camera") || t.includes("lock") || t.includes("door") || t.includes("alarm") || t.includes("sensor"))
    return "security";

  return "all";
}

function statusText(online: boolean | null) {
  if (online === null) return "—";
  return online ? "Online" : "Offline";
}

function PowerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 2h2v10h-2V2zm6.36 3.64 1.41 1.41A9 9 0 1 1 5.22 5.05l1.41 1.41A7 7 0 1 0 17.36 5.64z"
      />
    </svg>
  );
}

/**
 * MASTER ring style:
 * - offline/unknown -> dim
 * - online + any gang ON -> blue
 * - online + all OFF -> red
 */
function masterRingClasses(online: boolean | null, masterOn: boolean | null) {
  if (online !== true) return "border-white/15 text-white/35 bg-white/5";
  if (masterOn === true)
    return "border-sky-400/80 text-sky-200 bg-sky-400/10 shadow-[0_0_16px_rgba(56,189,248,0.28)]";
  // online but OFF => red idle
  return "border-red-400/80 text-red-200 bg-red-400/5 shadow-[0_0_14px_rgba(248,113,113,0.18)]";
}

/**
 * MasterOn means: any gang is ON (so master ring should be blue)
 * If all off => red
 */
function computeMasterOn(
  sid: string,
  gangCount: 1 | 2 | 3,
  cachedState: any,
  onMap: Record<string, boolean | null>
): boolean | null {
  if (cachedState && Object.keys(cachedState).length) {
    const vals = readGangValues(gangCount, cachedState);
    const anyKnown = vals.some((v) => v !== null);
    if (!anyKnown) return onMap[sid] ?? null;
    return vals.some((v) => v === true);
  }
  return onMap[sid] ?? null;
}

export default function DevicesPage() {
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user]
  );

  const [items, setItems] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // quick caches
  const [onMap, setOnMap] = useState<Record<string, boolean | null>>({});
  const [stateMap, setStateMap] = useState<Record<string, any>>({});

  const [tab, setTab] = useState<CategoryKey>("favorites");

  // Controls modal (tap card -> open this)
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [ctrlDevice, setCtrlDevice] = useState<AnyDevice | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await deviceService.getDevices(estateId || undefined);
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);

      const next: Record<string, boolean | null> = {};
      for (const d of arr) {
        const id = pickId(d);
        if (!id) continue;

        const listOn =
          cleanBool(d?.on) ??
          cleanBool(d?.power) ??
          cleanBool(d?.switch);

        if (listOn !== null) next[String(id)] = listOn;
      }
      if (Object.keys(next).length) setOnMap((prev) => ({ ...prev, ...next }));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load devices");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  async function warmState(device: AnyDevice) {
    const id = pickId(device);
    if (!id) return;
    const sid = String(id);

    if (stateMap[sid]) return;

    try {
      const res = await deviceService.getDeviceState(sid);
      const state = res?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));

      const guessed = guessIsOn(state);
      if (guessed !== null) setOnMap((p) => ({ ...p, [sid]: guessed }));
    } catch {}
  }

  // ✅ TAP CARD -> OPEN CONTROLS (1/2/3 rings)
  async function openControls(device: AnyDevice) {
    setCtrlDevice(device);
    setCtrlOpen(true);
    warmState(device);
  }

  // ✅ TOP-RIGHT RING -> MASTER toggle ALL gangs
  async function toggleMaster(device: AnyDevice) {
    const id = pickId(device);
    if (!id) return;
    const sid = String(id);

    setBusyId(sid);
    setErr(null);

    try {
      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);

      const masterOn = computeMasterOn(sid, gangCount, cached, onMap);
      const next = masterOn === true ? false : true;

      if (gangCount === 1) {
        await deviceService.commandDevice(sid, { switch: next });
        setStateMap((p) => ({
          ...p,
          [sid]: { ...(p[sid] || {}), switch: next, power: next, on: next },
        }));
        setOnMap((p) => ({ ...p, [sid]: next }));
      } else {
        const cmd: Record<string, any> = {};
        for (let i = 1; i <= gangCount; i++) cmd[`switch_${i}`] = next;

        await deviceService.commandDevice(sid, cmd);

        setStateMap((p) => {
          const prev = p[sid] || {};
          const patched: any = { ...prev };
          for (let i = 1; i <= gangCount; i++) patched[`switch_${i}`] = next;
          return { ...p, [sid]: patched };
        });

        setOnMap((p) => ({ ...p, [sid]: next }));
      }
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  // inside controls modal: toggle individual gang ring
  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const id = pickId(device);
    if (!id) return;

    const sid = String(id);
    setBusyId(sid);
    setErr(null);

    try {
      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);
      const code = gangCount === 1 ? "switch" : `switch_${gangIndex + 1}`;

      await deviceService.commandDevice(sid, { [code]: next });

      setStateMap((p) => {
        const prev = p[sid] || {};
        if (gangCount === 1) return { ...p, [sid]: { ...prev, switch: next, power: next, on: next } };
        return { ...p, [sid]: { ...prev, [`switch_${gangIndex + 1}`]: next } };
      });

      setOnMap((p) => ({ ...p, [sid]: next }));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  const favorites = useMemo(() => items.slice(0, 4), [items]);

  const filtered = useMemo(() => {
    if (tab === "favorites") return favorites;
    if (tab === "all") return items;
    return items.filter((d) => categorize(d) === tab);
  }, [items, tab, favorites]);

  const title = "Smart";
  const subtitle = "Control • Comfort • Security";

  return (
    <ConsumerShell title={title} subtitle={subtitle} showBack backHref="/home">
      {/* Top bar */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
        <div className="text-xs text-white/50 truncate">
          {estateId ? "Home linked" : "No home linked"}
          {loading ? <span className="text-white/30"> • syncing…</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? "…" : "Refresh"}
          </button>

          <button
            type="button"
            className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
            onClick={() => setErr("Add devices flow (Discovery → Bind) is next.")}
          >
            +
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[
          ["favorites", "Favorites"],
          ["lighting", "Lighting"],
          ["climate", "Climate"],
          ["media", "Media"],
          ["security", "Security"],
          ["all", "All"],
        ].map(([k, label]) => {
          const active = tab === (k as CategoryKey);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as CategoryKey)}
              className={`shrink-0 rounded-2xl px-3 py-2 text-sm border transition
                ${active ? "bg-white text-black border-white/20" : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* Grid */}
      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {filtered.map((d) => {
            const id = pickId(d);
            const sid = id ? String(id) : "";
            const name = pickName(d);
            const room = pickRoom(d);
            const online = isOnline(d);

            const cachedState = sid ? stateMap[sid] : {};
            const gangCount = guessGangCount(d, cachedState);

            const isBusy = !!sid && busyId === sid;
            const isSwitchCard = looksLikeSwitchCard(d);

            const masterOn = sid ? computeMasterOn(sid, gangCount, cachedState, onMap) : null;

            return (
              <button
                key={String(id || name)}
                type="button"
                onClick={() => {
                  // ✅ card tap opens controls for switch cards
                  if (isSwitchCard) return openControls(d);
                  // non-switch cards: do nothing for now
                  return;
                }}
                className="text-left rounded-3xl border border-white/10 bg-white/5 hover:bg-white/7 transition px-4 py-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  {/* icon */}
                  <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <div className="h-5 w-6 rounded-md bg-white/80 opacity-90" />
                  </div>

                  {/* ✅ MASTER POWER RING (tap = toggle all) */}
                  {isSwitchCard ? (
                    <button
                      type="button"
                      disabled={!sid || isBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMaster(d);
                      }}
                      className={`h-11 w-11 rounded-full border-2 flex items-center justify-center transition disabled:opacity-50 ${masterRingClasses(
                        online,
                        masterOn
                      )}`}
                      aria-label={masterOn === true ? "Turn off all" : "Turn on all"}
                    >
                      <PowerIcon
                        className={`h-6 w-6 transition ${
                          online === true
                            ? masterOn === true
                              ? "opacity-100"
                              : "opacity-60"
                            : "opacity-30"
                        }`}
                      />
                    </button>
                  ) : (
                    <div className="h-11 w-11 rounded-full border border-white/10 bg-white/5" />
                  )}
                </div>

                {/* Title */}
                <div className="mt-4 text-[15px] leading-tight text-white font-semibold line-clamp-2">
                  {name}
                </div>

                {/* Room + dropdown (just visual; card tap already opens controls) */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-white/45 truncate">{room}</div>

                  {isSwitchCard ? (
                    <div className="h-7 w-10 rounded-xl bg-white/5 border border-white/10 text-white/35 flex items-center justify-center">
                      <span className="text-base leading-none">⌄</span>
                    </div>
                  ) : (
                    <div className="h-7 w-10" />
                  )}
                </div>

                <div className="mt-2 text-[11px] text-white/30">
                  {statusText(online)}
                  {isSwitchCard && gangCount > 1 ? ` • ${gangCount}-gang` : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* CONTROLS MODAL (tap card -> open 1/2/3 rings) */}
      {ctrlOpen && ctrlDevice && (
        <div className="fixed inset-0 z-[125]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCtrlOpen(false)} />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{pickName(ctrlDevice)}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">Switch controls</div>
                  </div>

                  <button
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setCtrlOpen(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4">
                  {(() => {
                    const id = pickId(ctrlDevice);
                    if (!id) return <div className="text-sm text-white/60">No device ID.</div>;
                    const sid = String(id);

                    const cachedState = stateMap[sid] || {};
                    const gangCount = guessGangCount(ctrlDevice, cachedState);
                    const online = isOnline(ctrlDevice);
                    const busy = busyId === sid;

                    const ringValues =
                      Object.keys(cachedState || {}).length > 0
                        ? readGangValues(gangCount, cachedState)
                        : Array.from({ length: gangCount }, () => null);

                    return (
                      <div className="flex flex-col items-center gap-4">
                        <div className="text-sm text-white/70">
                          {statusText(online)} • {gangCount}-gang
                        </div>

                        {/* ✅ This is the “Smart Life” style: 1/2/3 rings */}
                        <GangRingSwitch
                          gangCount={gangCount}
                          online={online}
                          values={ringValues}
                          busy={busy}
                          onToggleGang={(gangIndex, next) => toggleGang(ctrlDevice, gangIndex, next)}
                          size={82}
                        />

                        <div className="text-xs text-white/40 text-center">
                          Tap a ring to toggle that light channel.
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Tip: Use the top-right power ring on the card to toggle ALL channels at once.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
