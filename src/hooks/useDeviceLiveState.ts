// src/hooks/useDeviceLiveState.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deviceService } from "@/services/deviceService";
import { getSocket } from "@/services/socket";

type LiveState = {
  state: Record<string, any> | null;
  lastSeen?: string | null;
  loading: boolean;
  error: string | null;
};

export function useDeviceLiveState(deviceId?: string, estateId?: string | null) {
  const [data, setData] = useState<LiveState>({
    state: null,
    lastSeen: null,
    loading: false,
    error: null,
  });

  const canUse = useMemo(() => !!deviceId, [deviceId]);

  const refresh = useCallback(async () => {
    if (!deviceId) return;

    setData((s) => ({ ...s, loading: true, error: null }));
    try {
      const resp = await deviceService.getDeviceState(deviceId);
      setData((s) => ({
        ...s,
        state: resp?.state ?? null,
        lastSeen: resp?.lastSeen ?? null,
        loading: false,
      }));
    } catch (e: any) {
      setData((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to fetch device state",
      }));
    }
  }, [deviceId]);

  useEffect(() => {
    if (!canUse) return;
    refresh();
  }, [canUse, refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !deviceId) return;

    const onConnect = () => {
      if (estateId) socket.emit("subscribe:estate", estateId);
    };

    const onUpdate = (payload: any) => {
      if (!payload?.deviceId || payload.deviceId !== deviceId) return;
      setData((s) => ({
        ...s,
        state: payload?.state ?? s.state,
        // backend sends state + topic; lastSeen is in DB, but this is still "fresh"
        lastSeen: new Date().toISOString(),
        error: null,
      }));
    };

    socket.on("connect", onConnect);
    socket.on("device:update", onUpdate);

    // If already connected, join immediately
    if (socket.connected && estateId) socket.emit("subscribe:estate", estateId);

    return () => {
      socket.off("connect", onConnect);
      socket.off("device:update", onUpdate);
    };
  }, [deviceId, estateId]);

  return { ...data, refresh };
}
