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

function prettyState(state: any) {
  try {
    return JSON.stringify(state ?? {}, null, 2);
  } catch {
    return String(state ?? "");
  }
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
    const v = cleanBool(state?.[`switch_${i}`]);
    out.push(v);
  }

  if (gangCount === 1 && out[0] === null) {
    const v = cleanBool(state?.switch) ?? cleanBool(state?.power) ?? cleanBool(state?.on);
    if (v !== null) out[0] = v;
  }

  return out;
}

function looksLikeSwitch(d: AnyDevice) {
  const t = pickType(d);
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

function powerRingClasses(online: boolean | null, isOn: boolean | null) {
  if (online !== true) return "border-white/15 text-white/35 bg-white/5";
  if (isOn === true)
    return "border-sky-400/80 text-sky-200 bg-sky-400/10 shadow-[0_0_16px_rgba(56,189,248,0.30)]";
  return "border-red-400/80 text-red-200 bg-red-400/5 shadow-[0_0_14px_rgba(248,113,113,0.18)]";
}

function computeMasterOn(
  sid: string,
  gangCount: 1 | 2 | 3,
  cachedState: any,
  onMap: Record<string, boolean | null>
): boolean | null {
  if (cachedState && Object.keys(cachedState).length) {
    const vals = readGangValues(gangCount, cachedState);
    if (vals.every((v) => v === null)) return onMap[sid] ?? null;
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

  // local quick cache
  const [onMap, setOnMap] = useState<Record<string, boolean | null>>({});
  const [stateMap, setStateMap] = useState<Record<string, any>>({});

  // tabs
  const [tab, setTab] = useState<CategoryKey>("favorites");

  // controls modal (multi-gang / single-gang view)
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [ctrlDevice, setCtrlDevice] = useState<AnyDevice | null>(null);

  // device info modal (hidden for end users, only via “Device info” button)
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState<string>("Device");
  const [infoId, setInfoId] = useState<string>("");
  const [infoBody, setInfoBody] = useState<string>("{}");
  const [infoLoading, setInfoLoading] = useState(false);

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

  async function openControls(device: AnyDevice) {
    // ✅ user flow:
    // - 1-gang -> just toggle (no modal)
    // - 2/3-gang -> open controls modal
    const id = pickId(device);
    if (!id) return;

    const sid = String(id);
    const cached = stateMap[sid] || {};
    const gangCount = guessGangCount(device, cached);

    if (gangCount === 1) {
      await toggleMaster(device);
      return;
    }

    setCtrlDevice(device);
    setCtrlOpen(true);
    warmState(device);
  }

  async function openInfo(device: AnyDevice) {
    const id = pickId(device);
    if (!id) return;

    const sid = String(id);

    setInfoTitle(pickName(device));
    setInfoId(sid);
    setInfoBody("{}");
    setInfoOpen(true);
    setInfoLoading(true);

    try {
      const res = await deviceService.getDeviceState(sid);
      const state = res?.state ?? res ?? {};
      setInfoBody(prettyState(state));
      setStateMap((p) => ({ ...p, [sid]: state }));

      const guessed = guessIsOn(state);
      if (guessed !== null) setOnMap((p) => ({ ...p, [sid]: guessed }));
    } catch (e: any) {
      setInfoBody(
        prettyState({
          error: e?.response?.data?.error || e?.message || "Failed to load device state",
        })
      );
    } finally {
      setInfoLoading(false);
    }
  }

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
      const nextMaster = masterOn === true ? false : true;

      if (gangCount === 1) {
        await deviceService.commandDevice(sid, { switch: nextMaster });
        setStateMap((p) => ({
          ...p,
          [sid]: { ...(p[sid] || {}), switch: nextMaster, power: nextMaster, on: nextMaster },
        }));
        setOnMap((p) => ({ ...p, [sid]: nextMaster }));
      } else {
        const cmd: Record<string, any> = {};
        for (let i = 1; i <= gangCount; i++) cmd[`switch_${i}`] = nextMaster;

        await deviceService.commandDevice(sid, cmd);

        setStateMap((p) => {
          const prev = p[sid] || {};
          const patched: any = { ...prev };
          for (let i = 1; i <= gangCount; i++) patched[`switch_${i}`] = nextMaster;
          return { ...p, [sid]: patched };
        });

        setOnMap((p) => ({ ...p, [sid]: nextMaster }));
      }
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
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

  function copy(text?: string | null) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch {}
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

      {/* Empty */}
      {!loading && items.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-white font-semibold">No devices yet</div>
          <div className="mt-2 text-sm text-white/60">
            Add your first device to start controlling lights, climate, media and security.
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-2xl px-4 py-2 text-sm bg-white text-black hover:opacity-90 transition"
              onClick={() => setErr("Next: open Discovery → select → Bind to account.")}
            >
              Add devices
            </button>

            <button
              type="button"
              className="rounded-2xl px-4 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
              onClick={load}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

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
            const isSwitchCard = looksLikeSwitch(d);

            const masterOn = sid ? computeMasterOn(sid, gangCount, cachedState, onMap) : null;
            const isBusy = !!sid && busyId === sid;

            // values for modal rings
            const ringValues =
              Object.keys(cachedState || {}).length > 0
                ? readGangValues(gangCount, cachedState)
                : gangCount === 1
                  ? [onMap[sid] ?? null]
                  : Array.from({ length: gangCount }, () => null);

            return (
              <button
                key={String(id || name)}
                type="button"
                onClick={() => {
                  // ✅ Card tap opens controls (not state)
                  if (isSwitchCard) return openControls(d);
                  // non-switch devices: keep simple for now
                  setErr("This device opens a custom remote panel soon (IR/TV/AC).");
                }}
                className="text-left rounded-3xl border border-white/10 bg-white/5 hover:bg-white/7 transition px-4 py-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  {/* icon */}
                  <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <div className="h-5 w-6 rounded-md bg-white/80 opacity-90" />
                  </div>

                  {/* ✅ power ring: toggle (1-gang) OR open controls (2/3-gang) */}
                  {isSwitchCard ? (
                    <button
                      type="button"
                      disabled={!sid || isBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (gangCount === 1) return toggleMaster(d);
                        return openControls(d);
                      }}
                      className={`h-11 w-11 rounded-full border-2 flex items-center justify-center transition disabled:opacity-50 ${powerRingClasses(
                        online,
                        masterOn
                      )}`}
                      aria-label={masterOn === true ? "Turn off" : "Turn on"}
                    >
                      <PowerIcon
                        className={`h-6 w-6 transition ${
                          online === true
                            ? masterOn === true
                              ? "opacity-100"
                              : "opacity-55"
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

                {/* Room + dropdown */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-white/45 truncate">{room}</div>

                  {/* ✅ dropdown lives here */}
                  {isSwitchCard && gangCount > 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // open multi-gang controls
                        setCtrlDevice(d);
                        setCtrlOpen(true);
                        warmState(d);
                      }}
                      className="h-7 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/55 flex items-center justify-center"
                      aria-label="Open controls"
                    >
                      <span className="text-base leading-none">⌄</span>
                    </button>
                  ) : (
                    <div className="h-7 w-10" />
                  )}
                </div>

                <div className="mt-2 text-[11px] text-white/30">
                  {statusText(online)}
                  {isSwitchCard && gangCount > 1 ? ` • ${gangCount}-gang` : ""}
                </div>

                {/* hidden usage so TS doesn't complain */}
                <div className="hidden" aria-hidden="true">
                  {ringValues.length}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* CONTROLS MODAL (2/3-gang) */}
      {ctrlOpen && ctrlDevice && (
        <div className="fixed inset-0 z-[125]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCtrlOpen(false)} />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{pickName(ctrlDevice)}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">Controls</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* ✅ device state only accessible here (not on card) */}
                    <button
                      type="button"
                      className="rounded-xl px-3 py-1.5 text-xs bg-white/10 text-white hover:bg-white/15 border border-white/10"
                      onClick={() => openInfo(ctrlDevice)}
                    >
                      Device info
                    </button>

                    <button
                      className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                      onClick={() => setCtrlOpen(false)}
                      aria-label="Close"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {(() => {
                    const id = pickId(ctrlDevice);
                    if (!id) return <div className="text-sm text-white/60">No device ID.</div>;
                    const sid = String(id);

                    const cachedState = stateMap[sid] || {};
                    const gangCount = guessGangCount(ctrlDevice, cachedState);
                    const online = isOnline(ctrlDevice);

                    const ringValues =
                      Object.keys(cachedState || {}).length > 0
                        ? readGangValues(gangCount, cachedState)
                        : Array.from({ length: gangCount }, () => null);

                    const busy = busyId === sid;

                    return (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm text-white/70">
                            {statusText(online)} • {gangCount}-gang
                          </div>

                          <GangRingSwitch
                            gangCount={gangCount}
                            online={online}
                            values={ringValues}
                            busy={busy}
                            onToggleGang={(gangIndex, next) => toggleGang(ctrlDevice, gangIndex, next)}
                            size={78}
                          />
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs text-white/70">Master</div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => toggleMaster(ctrlDevice)}
                              className="rounded-2xl px-4 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
                            >
                              Toggle all
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setCtrlOpen(false)}
                              className="rounded-2xl px-4 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Tap a ring to control that gang.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE INFO (DEBUG) MODAL */}
      {infoOpen && (
        <div className="fixed inset-0 z-[130]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{infoTitle}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">Device state (debug)</div>

                    {infoId ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-white/35">ID:</span>
                        <span className="text-[11px] text-white/70 font-mono truncate">{infoId}</span>
                        <button
                          onClick={() => copy(infoId)}
                          className="text-[11px] text-white/60 hover:text-white underline"
                          type="button"
                        >
                          Copy
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setInfoOpen(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4">
                  {infoLoading ? (
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Fetching…
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => copy(infoBody)}
                          className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
                          type="button"
                        >
                          Copy JSON
                        </button>
                      </div>

                      <pre className="text-xs text-white/80 whitespace-pre-wrap break-words font-mono">
                        {infoBody}
                      </pre>
                    </>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Source: <span className="text-white/70">GET /devices/:deviceId/state</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
