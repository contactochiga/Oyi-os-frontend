"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

type Mode = "pad" | "numbers";

function pickBool(state: any, keys: string[], fallback: boolean) {
  for (const k of keys) {
    const v = state?.[k];
    if (typeof v === "boolean") return v;
    if (v === 1 || v === 0) return !!v;
    if (v === "on") return true;
    if (v === "off") return false;
  }
  return fallback;
}

export default function TvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();
  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading } = useDeviceLiveState(deviceId, estateId);
  const tvOn = useMemo(() => pickBool(state, ["power", "on", "tvOn"], true), [state]);

  const [mode, setMode] = useState<Mode>("pad");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pendingTimer = useRef<any>(null);

  function touch() {
    onInteraction?.();
  }

  async function sendAction(action: string) {
    if (!deviceId) return setErr("No TV linked.");

    setErr(null);
    touch();
    setPending(true);

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => setPending(false), 900);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "action",
        value: action,
        meta: { panel: "tv" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");
      setTimeout(() => setPending(false), 200);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      setPending(false);
    }
  }

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  const disabled = pending || !deviceId;

  const Btn = ({
    children,
    onClick,
    variant = "ghost",
    className = "",
    disabled: d,
  }: {
    children: any;
    onClick: () => void;
    variant?: "ghost" | "solid";
    className?: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!!d}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold border transition active:scale-[0.99] disabled:opacity-50
        ${
          variant === "solid"
            ? "bg-white text-black border-white/20"
            : "bg-white/5 text-white border-white/10 hover:bg-white/10"
        } ${className}`}
    >
      {children}
    </button>
  );

  const Square = ({
    children,
    onClick,
    disabled: d,
    solid,
  }: {
    children: any;
    onClick: () => void;
    disabled?: boolean;
    solid?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!!d}
      className={`h-12 w-12 rounded-2xl border text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50
        ${
          solid
            ? "bg-white text-black border-white/20"
            : "bg-white/5 text-white border-white/10 hover:bg-white/10"
        }`}
    >
      {children}
    </button>
  );

  return (
    <RemotePanel title="TV" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {!deviceId ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No TV linked yet.
        </div>
      ) : (
        <div className="space-y-4">
          {/* top strip */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-white/80">
              {tvOn ? "On" : "Off"}
              {(pending || loading) ? <span className="text-xs text-white/40"> • sending…</span> : null}
            </div>

            <div className="flex gap-2">
              <Btn onClick={() => sendAction("power")} disabled={disabled} variant="solid">
                Power
              </Btn>
              <Btn onClick={() => sendAction("mute")} disabled={disabled}>
                Mute
              </Btn>
            </div>
          </div>

          {/* vol / ch */}
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => sendAction("vol_up")} disabled={disabled}>Vol +</Btn>
            <Btn onClick={() => sendAction("ch_up")} disabled={disabled}>Ch +</Btn>
            <Btn onClick={() => sendAction("vol_down")} disabled={disabled}>Vol -</Btn>
            <Btn onClick={() => sendAction("ch_down")} disabled={disabled}>Ch -</Btn>
          </div>

          {/* center */}
          {mode === "pad" ? (
            <div className="flex flex-col items-center gap-2">
              <Square onClick={() => sendAction("up")} disabled={disabled}>↑</Square>

              <div className="flex items-center gap-2">
                <Square onClick={() => sendAction("left")} disabled={disabled}>←</Square>
                <Square onClick={() => sendAction("ok")} disabled={disabled} solid>
                  OK
                </Square>
                <Square onClick={() => sendAction("right")} disabled={disabled}>→</Square>
              </div>

              <Square onClick={() => sendAction("down")} disabled={disabled}>↓</Square>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9,0].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => sendAction(`num_${n}`)}
                  disabled={disabled}
                  className="py-3 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition font-semibold disabled:opacity-50"
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* bottom */}
          <div className="flex gap-2">
            <Btn onClick={() => sendAction("home")} disabled={disabled} className="flex-1">
              Home
            </Btn>
            <Btn
              onClick={() => setMode(mode === "pad" ? "numbers" : "pad")}
              disabled={disabled}
              className="w-[110px]"
            >
              {mode === "pad" ? "123" : "Pad"}
            </Btn>
          </div>
        </div>
      )}
    </RemotePanel>
  );
}
