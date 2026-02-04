"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";

type AnyDevice = Record<string, any>;

function pickId(d: AnyDevice) {
  return (
    d.device_id ||
    d.devId ||
    d.external_id ||
    d.externalId ||
    d.id ||
    d.uuid ||
    null
  );
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
  return online ? "bg-emerald-500" : "bg-red-500";
}

function prettyState(state: any) {
  try {
    return JSON.stringify(state ?? {}, null, 2);
  } catch {
    return String(state ?? "");
  }
}

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

  // state modal
  const [stateOpen, setStateOpen] = useState(false);
  const [stateTitle, setStateTitle] = useState<string>("Device State");
  const [stateBody, setStateBody] = useState<string>("{}");
  const [stateLoading, setStateLoading] = useState(false);

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

  async function quickToggle(device: AnyDevice, on: boolean) {
    const id = pickId(device);
    if (!id) return;

    setBusyId(String(id));
    setErr(null);

    try {
      // best-effort switch code for Tuya/others
      const meta = device.metadata || device.meta || {};
      const raw = meta?.raw || meta || {};

      const code =
        raw?.switch_code ||
        raw?.switch ||
        raw?.switch_1 ||
        "switch";

      await deviceService.commandDevice(String(id), { [code]: on });

      // Optional: you can optimistically flip local online/status later
    } catch (e: any) {
      setErr(
        e?.response?.data?.error ||
          e?.message ||
          "Command failed (device may be offline)"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function viewState(device: AnyDevice) {
    const id = pickId(device);
    if (!id) return;

    setStateTitle(pickName(device));
    setStateBody("{}");
    setStateOpen(true);
    setStateLoading(true);

    try {
      const res = await deviceService.getDeviceState(String(id));
      const state = res?.state ?? res ?? {};
      setStateBody(prettyState(state));
    } catch (e: any) {
      setStateBody(
        prettyState({
          error:
            e?.response?.data?.error ||
            e?.message ||
            "Failed to load device state",
        })
      );
    } finally {
      setStateLoading(false);
    }
  }

  const title = estateId ? "Devices" : "Devices (Discovery)";
  const subtitle = estateId
    ? "Estate device registry"
    : "Scanning devices available to connect";

  return (
    <ConsumerShell title={title} subtitle={subtitle}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-white/40 truncate">
          {estateId ? `Estate: ${estateId}` : "No estate linked • using discovery"}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading devices…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No devices found yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((d) => {
            const id = pickId(d);
            const name = pickName(d);
            const vendor = pickVendor(d);
            const online = isOnline(d);

            return (
              <div
                key={String(id || name)}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${statusDot(online)}`}
                        aria-hidden="true"
                      />
                      <div className="text-sm text-white font-semibold truncate">
                        {name}
                      </div>
                    </div>

                    <div className="text-xs text-white/40 mt-1 truncate">
                      {vendor}
                      {id ? ` • ${String(id)}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => viewState(d)}
                      className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm"
                    >
                      State
                    </button>

                    <button
                      disabled={!id || busyId === String(id)}
                      onClick={() => quickToggle(d, true)}
                      className="px-3 py-2 rounded-xl bg-[#E11D2E] text-white text-sm disabled:opacity-50"
                    >
                      On
                    </button>

                    <button
                      disabled={!id || busyId === String(id)}
                      onClick={() => quickToggle(d, false)}
                      className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
                    >
                      Off
                    </button>
                  </div>
                </div>

                {/* Optional capabilities */}
                {Array.isArray(d.capabilities) && d.capabilities.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.capabilities.slice(0, 6).map((c: any) => (
                      <span
                        key={String(c)}
                        className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60"
                      >
                        {String(c)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* STATE MODAL */}
      {stateOpen && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setStateOpen(false)}
          />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {stateTitle}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Live state snapshot
                    </div>
                  </div>

                  <button
                    className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setStateOpen(false)}
                    aria-label="Close"
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
                    <pre className="text-xs text-white/80 whitespace-pre-wrap break-words">
                      {stateBody}
                    </pre>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Source:{" "}
                  <span className="text-white/70">
                    GET /devices/:deviceId/state
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
