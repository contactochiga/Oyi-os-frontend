// src/app/devices/DeviceClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";

type AnyDevice = Record<string, any>;

function pickDbId(d: AnyDevice) {
  return d?.id || null; // ✅ DB uuid
}

function pickExternalId(d: AnyDevice) {
  return (
    d?.external_id ||
    d?.externalId ||
    d?.device_id ||
    d?.dev_id ||
    d?.devId ||
    d?.uuid ||
    null
  );
}

function pickName(d: AnyDevice) {
  return d?.name || d?.local_name || d?.localName || d?.alias || "Unnamed Device";
}

function pickVendor(d: AnyDevice) {
  return d?.vendor || d?.adapter || d?.protocol || d?.brand || "device";
}

function pickRoomName(d: AnyDevice) {
  return d?.room_name || d?.room?.name || d?.metadata?.room_name || null;
}

function isOnline(d: AnyDevice): boolean | null {
  if (typeof d?.online === "boolean") return d.online;
  if (typeof d?.isOnline === "boolean") return d.isOnline;
  if (typeof d?.connected === "boolean") return d.connected;

  if (typeof d?.status === "string") {
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

function normalizeCommandKey(gangCount: 1 | 2 | 3, gangIndex: number) {
  return gangCount === 1 ? "switch" : `switch_${gangIndex + 1}`;
}

function powerButtonClass(isOn: boolean | null) {
  if (isOn === null) return "bg-white/10 text-white/70 border-white/10";
  return isOn
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/20"
    : "bg-white/10 text-white/70 border-white/10";
}

export default function DeviceClient() {
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

  const [q, setQ] = useState("");

  // device state cache (by DB id)
  const [stateMap, setStateMap] = useState<Record<string, any>>({});

  // details modal
  const [stateOpen, setStateOpen] = useState(false);
  const [stateTitle, setStateTitle] = useState<string>("Device");
  const [stateMeta, setStateMeta] = useState<{ id?: string; vendor?: string; external_id?: string } | null>(null);
  const [stateBody, setStateBody] = useState<string>("{}");
  const [stateLoading, setStateLoading] = useState(false);

  // bottom sheet for controls
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDevice, setSheetDevice] = useState<AnyDevice | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await deviceService.getDevices(estateId || undefined);
      setItems(Array.isArray(list) ? list : []);
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

  const filtered = useMemo(() => {
    const t = (q || "").trim().toLowerCase();
    if (!t) return items;

    return items.filter((d) => {
      const name = String(pickName(d)).toLowerCase();
      const vendor = String(pickVendor(d)).toLowerCase();
      const room = String(pickRoomName(d) ?? "").toLowerCase();
      const ext = String(pickExternalId(d) ?? "").toLowerCase();
      return name.includes(t) || vendor.includes(t) || room.includes(t) || ext.includes(t);
    });
  }, [q, items]);

  async function warmState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;

    const sid = String(dbId);
    if (stateMap[sid]) return;

    try {
      const res = await deviceService.getDeviceState(sid);
      const state = (res as any)?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));
    } catch {
      // silent
    }
  }

  function currentIsOn(device: AnyDevice, state: any): boolean | null {
    if (!state) return null;

    // prefer dp-like switches first if present
    const v =
      state?.switch ??
      state?.power ??
      state?.on ??
      null;

    if (typeof v === "boolean") return v;

    // fallback: if any switch_i is true, treat as "on"
    const keys = ["switch_1", "switch_2", "switch_3"];
    for (const k of keys) {
      if (typeof state?.[k] === "boolean" && state[k] === true) return true;
    }
    // if we can see them but all false
    const hasAny = keys.some((k) => typeof state?.[k] === "boolean");
    if (hasAny) return false;

    return null;
  }

  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const dbId = pickDbId(device);
    if (!dbId) {
      setErr("This device has no DB id yet. Bind/assign it first.");
      return;
    }

    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);

    try {
      await warmState(device);

      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);
      const code = normalizeCommandKey(gangCount, gangIndex);

      await deviceService.commandDevice(sid, { [code]: next });

      // optimistic UI
      setStateMap((p) => {
        const prev = p[sid] || {};
        if (gangCount === 1) {
          return { ...p, [sid]: { ...prev, switch: next, power: next, on: next } };
        }
        return { ...p, [sid]: { ...prev, [`switch_${gangIndex + 1}`]: next } };
      });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  // ✅ card power button: full ON/OFF
  // - 1-gang => switch
  // - multi-gang => switch_1..switch_n all together
  async function toggleMasterPower(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) {
      setErr("This device has no DB id yet. Bind/assign it first.");
      return;
    }

    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);

    try {
      await warmState(device);

      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);
      const nowOn = currentIsOn(device, cached);
      const next = nowOn === null ? true : !nowOn;

      const command: Record<string, any> = {};

      if (gangCount === 1) {
        command["switch"] = next;
      } else {
        for (let i = 1; i <= gangCount; i++) {
          command[`switch_${i}`] = next;
        }
      }

      await deviceService.commandDevice(sid, command);

      // optimistic UI
      setStateMap((p) => {
        const prev = p[sid] || {};
        if (gangCount === 1) {
          return { ...p, [sid]: { ...prev, switch: next, power: next, on: next } };
        }
        const patch: any = {};
        for (let i = 1; i <= gangCount; i++) patch[`switch_${i}`] = next;
        return { ...p, [sid]: { ...prev, ...patch } };
      });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  function openSheet(device: AnyDevice) {
    setSheetDevice(device);
    setSheetOpen(true);
    // warm quickly so ring state shows immediately
    warmState(device);
  }

  async function viewState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;

    const sid = String(dbId);
    const ext = pickExternalId(device);

    setStateTitle(pickName(device));
    setStateMeta({ id: sid, vendor: pickVendor(device), external_id: ext ? String(ext) : undefined });
    setStateBody("{}");
    setStateOpen(true);
    setStateLoading(true);

    try {
      const res = await deviceService.getDeviceState(sid);
      const state = (res as any)?.state ?? res ?? {};
      setStateBody(prettyState(state));
      setStateMap((p) => ({ ...p, [sid]: state }));
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

  function copy(text?: string | null) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  return (
    <ConsumerShell title="Devices" subtitle="Command Center" showBack backHref="/home">
      {/* header */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-white/45 truncate">
            {estateId ? "Estate linked" : "No estate linked"}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search devices…"
            className="
              w-full rounded-2xl
              bg-white/5 border border-white/10
              px-4 py-3
              text-sm text-white/90 placeholder:text-white/35
              outline-none focus:border-white/20
            "
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-white/45">
          <span>{filtered.length} device{filtered.length === 1 ? "" : "s"}</span>
          <span className="text-white/30">Tap card for controls • Power button for full on/off</span>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* grid */}
      {loading && filtered.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading devices…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          No devices found.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((d) => {
            const dbId = pickDbId(d);
            const sid = dbId ? String(dbId) : "";
            const name = pickName(d);
            const roomName = pickRoomName(d);
            const vendor = pickVendor(d);
            const online = isOnline(d);

            const cached = sid ? stateMap[sid] : {};
            const gangCount = guessGangCount(d, cached);
            const nowOn = currentIsOn(d, cached);

            const busy = sid && busyId === sid;

            return (
              <button
                key={sid || String(pickExternalId(d) || name)}
                type="button"
                onClick={() => openSheet(d)}
                className="
                  text-left rounded-3xl
                  border border-white/10
                  bg-white/5 hover:bg-white/8
                  transition
                  p-4
                  relative
                  overflow-hidden
                "
              >
                {/* top row: icon + power */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${statusDot(online)}`} />
                    <div className="text-[11px] text-white/45 truncate">{vendor}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMasterPower(d);
                    }}
                    disabled={busy}
                    className={`
                      h-9 w-9 rounded-full border
                      flex items-center justify-center
                      transition active:scale-[0.99]
                      ${powerButtonClass(nowOn)}
                      ${busy ? "opacity-60" : ""}
                    `}
                    aria-label="Power"
                    title="Power"
                  >
                    {/* power icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2v10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7.5 4.5C5 6.3 3.5 9 3.5 12c0 4.7 3.8 8.5 8.5 8.5S20.5 16.7 20.5 12c0-3-1.5-5.7-4-7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* name */}
                <div className="mt-3">
                  <div className="text-[14px] text-white/95 font-semibold leading-snug line-clamp-2">
                    {name}
                  </div>
                  <div className="mt-1 text-[12px] text-white/45 truncate">
                    {roomName || "Unassigned"}
                  </div>
                </div>

                {/* bottom hint */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[11px] text-white/35">
                    {gangCount > 1 ? `${gangCount}-gang` : "1-gang"}
                  </div>

                  <div className="text-[11px] text-white/35">
                    {busy ? "Working…" : "Open"}
                  </div>
                </div>

                {/* subtle background glow */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* BOTTOM SHEET (card tap) */}
      {sheetOpen && sheetDevice && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />

          <div className="absolute left-0 right-0 bottom-0 px-3 pb-[calc(12px+var(--sab))]">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-t-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                {/* grabber */}
                <div className="pt-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-white/15" />
                </div>

                {/* header */}
                <div className="px-4 pt-3 pb-4 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white truncate">
                      {pickName(sheetDevice)}
                    </div>
                    <div className="text-xs text-white/45 mt-1 truncate">
                      {pickRoomName(sheetDevice) || "Unassigned"} • {pickVendor(sheetDevice)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => viewState(sheetDevice)}
                      className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
                    >
                      Details
                    </button>

                    <button
                      className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                      onClick={() => setSheetOpen(false)}
                      aria-label="Close"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* controls */}
                <div className="p-4">
                  {(() => {
                    const dbId = pickDbId(sheetDevice);
                    const sid = dbId ? String(dbId) : "";
                    const cached = sid ? stateMap[sid] : {};
                    const gangCount = guessGangCount(sheetDevice, cached);
                    const ringValues = Object.keys(cached || {}).length
                      ? readGangValues(gangCount, cached)
                      : Array.from({ length: gangCount }, () => null);

                    const busy = sid && busyId === sid;
                    const online = isOnline(sheetDevice);

                    return (
                      <div className="grid gap-4">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                          <div className="text-sm text-white/75">
                            Controls
                            <div className="text-xs text-white/40 mt-1">
                              {gangCount > 1 ? `Switch groups: ${gangCount}` : "Switch"}
                            </div>
                          </div>

                          <GangRingSwitch
                            gangCount={gangCount}
                            online={online}
                            values={ringValues}
                            busy={busy}
                            onToggleGang={(gangIndex, next) => toggleGang(sheetDevice, gangIndex, next)}
                            size={64}
                          />
                        </div>

                        <div className="text-[11px] text-white/45">
                          Tip: Use the power button on the card for full on/off. Use rings here for per-gang control.
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* footer */}
                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Device:{" "}
                  <span className="text-white/70 font-mono">
                    {String(pickExternalId(sheetDevice) || "—")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {stateOpen && (
        <div className="fixed inset-0 z-[140]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setStateOpen(false)} />
          <div className="absolute left-0 right-0 top-16 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{stateTitle}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">
                      {stateMeta?.vendor ? `${stateMeta.vendor} • ` : ""}Live state snapshot
                    </div>

                    {stateMeta?.external_id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-white/35">External:</span>
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
                        <span className="text-[11px] text-white/35">Device:</span>
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
