// src/app/devices/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";

type AnyDevice = Record<string, any>;

/**
 * ✅ KEY FIX:
 * - Use DB UUID (devices.id) for all state + command calls
 * - external_id is ONLY for display / Tuya mapping
 */
function pickDbId(d: AnyDevice) {
  return d.id || null; // <-- DB UUID (public.devices.id)
}

function pickExternalId(d: AnyDevice) {
  return (
    d.external_id ||
    d.externalId ||
    d.device_id ||
    d.dev_id ||
    d.devId ||
    d.uuid ||
    null
  );
}

// React list key
function pickKey(d: AnyDevice) {
  return pickDbId(d) || pickExternalId(d) || d.name || Math.random().toString(36).slice(2);
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

  // fallback: status field
  if (typeof d.status === "string") {
    const s = d.status.toLowerCase();
    if (s.includes("online")) return true;
    if (s.includes("offline")) return false;
  }

  return null;
}

function statusDot(online: boolean | null) {
  if (online === null) return "bg-white/20";
  return online ? "bg-emerald-500" : "bg-white/25";
}

function prettyState(state: any) {
  try {
    return JSON.stringify(state ?? {}, null, 2);
  } catch {
    return String(state ?? "");
  }
}

function guessIsOn(state: any): boolean | null {
  if (!state) return null;

  if (typeof state.on === "boolean") return state.on;
  if (typeof state.power === "boolean") return state.power;
  if (typeof state.switch === "boolean") return state.switch;

  const dps = state.dps || state?.raw?.dps || null;
  if (dps && typeof dps === "object") {
    const candidates = ["1", "switch", "switch_1", "power"];
    for (const k of candidates) {
      if (typeof dps[k] === "boolean") return dps[k];
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

/**
 * ✅ DEMO DEVICES (for App Store screenshots)
 * Only used when Demo Mode is ON.
 */
const DEMO: AnyDevice[] = [
  { id: "demo-1", name: "Living Room Lights", vendor: "tuya", status: "online", metadata: { room_name: "Living Room", raw: { switch_1_code: true } } },
  { id: "demo-2", name: "Bedroom Lights", vendor: "tuya", status: "online", metadata: { room_name: "Bedroom", raw: { switch_1_code: true } } },
  { id: "demo-3", name: "AC Switch", vendor: "tuya", status: "online", metadata: { room_name: "Bedroom", raw: { switch_1_code: true, switch_2_code: true } } },
  { id: "demo-4", name: "Smart TV", vendor: "tuya", status: "online", metadata: { room_name: "Living Room", raw: { switch_1_code: true } } },
];

export default function DevicesPage() {
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      (user as any)?.estate_id ??
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null),
    [user]
  );

  const [items, setItems] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ✅ screenshot helpers
  const [demoMode, setDemoMode] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState(true);

  // state modal
  const [stateOpen, setStateOpen] = useState(false);
  const [stateTitle, setStateTitle] = useState<string>("Device");
  const [stateMeta, setStateMeta] = useState<{ id?: string; vendor?: string; external_id?: string } | null>(null);
  const [stateBody, setStateBody] = useState<string>("{}");
  const [stateLoading, setStateLoading] = useState(false);

  // local on/off cache
  const [onMap, setOnMap] = useState<Record<string, boolean | null>>({});

  // per-device state cache
  const [stateMap, setStateMap] = useState<Record<string, any>>({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      if (demoMode) {
        setItems(DEMO);
        setLoading(false);
        return;
      }

      const list = await deviceService.getDevices(estateId || undefined);
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);

      // prefill onMap from list fields (if present)
      const next: Record<string, boolean | null> = {};
      for (const d of arr) {
        const dbId = pickDbId(d);
        if (!dbId) continue;
        const sid = String(dbId);

        const listOn =
          typeof d.on === "boolean"
            ? d.on
            : typeof d.power === "boolean"
            ? d.power
            : typeof d.switch === "boolean"
            ? d.switch
            : null;

        if (listOn !== null) next[sid] = listOn;
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
  }, [estateId, demoMode]);

  // ✅ Warm state before first toggle so gangCount + keys are correct
  async function warmState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;
    const sid = String(dbId);

    if (stateMap[sid]) return;

    try {
      const res = await deviceService.getDeviceState(sid); // ✅ DB ID
      const state = (res as any)?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));

      const guessed = guessIsOn(state);
      if (guessed !== null) setOnMap((p) => ({ ...p, [sid]: guessed }));
    } catch {
      // silent
    }
  }

  async function viewState(device: AnyDevice) {
    const dbId = pickDbId(device);
    const ext = pickExternalId(device);

    if (!dbId) return;

    const sid = String(dbId);

    setStateTitle(pickName(device));
    setStateMeta({ id: sid, vendor: pickVendor(device), external_id: ext ? String(ext) : undefined });
    setStateBody("{}");
    setStateOpen(true);
    setStateLoading(true);

    try {
      const res = await deviceService.getDeviceState(sid); // ✅ DB ID
      const state = (res as any)?.state ?? res ?? {};
      setStateBody(prettyState(state));

      setStateMap((p) => ({ ...p, [sid]: state }));

      const guessed = guessIsOn(state);
      if (guessed !== null) setOnMap((p) => ({ ...p, [sid]: guessed }));
    } catch (e: any) {
      setStateBody(
        prettyState({
          error: e?.response?.data?.error || e?.message || "Failed to load device state",
        })
      );
    } finally {
      setStateLoading(false);
    }
  }

  /**
   * ✅ WORKING COMMAND LOGIC
   * - Always command using DB device UUID
   * - Uses switch for 1-gang, switch_1 / switch_2 / switch_3 for multi-gang
   * - In screenshotMode we keep UI optimistic even if backend fails
   */
  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const dbId = pickDbId(device);
    if (!dbId) return;

    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);

    try {
      await warmState(device);

      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);

      const code = gangCount === 1 ? "switch" : `switch_${gangIndex + 1}`;

      if (!demoMode) {
        await deviceService.commandDevice(sid, { [code]: next }); // ✅ DB ID
      }

      // optimistic UI (instant ring flip)
      setStateMap((p) => {
        const prev = p[sid] || {};
        if (gangCount === 1) {
          return { ...p, [sid]: { ...prev, switch: next, power: next, on: next } };
        }
        return { ...p, [sid]: { ...prev, [`switch_${gangIndex + 1}`]: next } };
      });

      setOnMap((p) => ({ ...p, [sid]: next }));
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Command failed (device may be offline)";
      if (!screenshotMode) setErr(msg);
      // screenshotMode: keep it looking smooth
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

  const title = "Devices";
  const subtitle = "Device Command Center";

  return (
    <ConsumerShell title={title} subtitle={subtitle} showBack backHref="/home">
      {/* top row */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
        <div className="text-xs text-white/45 truncate">
          {demoMode ? "Demo Mode ON • clean App Store screenshot data" : estateId ? "Estate linked • DB devices" : "No estate linked"}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScreenshotMode((v) => !v)}
            className="rounded-2xl px-3 py-2 text-xs bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
            type="button"
          >
            {screenshotMode ? "Screenshot: ON" : "Screenshot: OFF"}
          </button>

          <button
            onClick={() => setDemoMode((v) => !v)}
            className="rounded-2xl px-3 py-2 text-xs bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
            type="button"
          >
            {demoMode ? "Demo: ON" : "Demo: OFF"}
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* error */}
      {!screenshotMode && err && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* list */}
      {loading && items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading devices…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          No devices found yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((d) => {
            const key = pickKey(d);
            const dbId = pickDbId(d);
            const ext = pickExternalId(d);

            const name = pickName(d);
            const vendor = pickVendor(d);
            const online = isOnline(d);

            const sid = dbId ? String(dbId) : "";
            const isBusy = !!sid && busyId === sid;

            const cachedState = sid ? stateMap[sid] : {};
            const gangCount = guessGangCount(d, cachedState);

            const ringValues =
              Object.keys(cachedState || {}).length > 0
                ? readGangValues(gangCount, cachedState)
                : gangCount === 1
                ? [sid ? onMap[sid] ?? null : null]
                : Array.from({ length: gangCount }, () => null);

            return (
              <div
                key={String(key)}
                className="rounded-3xl border border-white/10 bg-white/5 hover:bg-white/7 transition p-4"
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

                    {/* small id hint (safe for screenshots) */}
                    <div className="mt-2 text-[11px] text-white/35 truncate">
                      {ext ? `Tuya id: ${String(ext)}` : "Tuya id: —"}
                      {"  "}
                      <span className="text-white/25">•</span>
                      {"  "}
                      DB id hidden (open Details)
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => viewState(d)}
                      className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
                      type="button"
                    >
                      Details
                    </button>

                    <GangRingSwitch
                      gangCount={gangCount}
                      online={online}
                      values={ringValues}
                      busy={isBusy}
                      onToggleGang={(gangIndex, next) => toggleGang(d, gangIndex, next)}
                      size={54}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STATE MODAL */}
      {stateOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setStateOpen(false)} />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{stateTitle}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">
                      {stateMeta?.vendor ? `${stateMeta.vendor} • ` : ""}Live state snapshot
                    </div>

                    {stateMeta?.external_id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-white/35">Tuya:</span>
                        <span className="text-[11px] text-white/70 font-mono truncate">{stateMeta.external_id}</span>
                        <button
                          onClick={() => copy(stateMeta.external_id)}
                          className="text-[11px] text-white/60 hover:text-white underline"
                          type="button"
                        >
                          Copy
                        </button>
                      </div>
                    ) : null}

                    {stateMeta?.id ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-white/35">DB:</span>
                        <span className="text-[11px] text-white/70 font-mono truncate">{stateMeta.id}</span>
                        <button
                          onClick={() => copy(stateMeta.id)}
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
                    onClick={() => setStateOpen(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4">
                  {stateLoading ? (
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Fetching state…
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => copy(stateBody)}
                          className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
                          type="button"
                        >
                          Copy JSON
                        </button>
                      </div>

                      <pre className="text-xs text-white/80 whitespace-pre-wrap break-words font-mono">
                        {stateBody}
                      </pre>
                    </>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Source: <span className="text-white/70">GET /devices/:deviceId/state</span> (deviceId = DB UUID)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
