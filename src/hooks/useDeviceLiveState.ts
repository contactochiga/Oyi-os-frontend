// src/hooks/useDeviceLiveState.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const estateJoinedRef = useRef<string | null>(null);

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

  // Initial fetch (and when device changes)
  useEffect(() => {
    if (!canUse) return;
    refresh();
  }, [canUse, refresh]);

  // Live updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !deviceId) return;

    const joinEstate = () => {
      if (!estateId) return;

      // avoid spam-joining the same estate on every render
      if (estateJoinedRef.current === estateId) return;

      socket.emit("subscribe:estate", estateId);
      estateJoinedRef.current = estateId;
    };

    const onConnect = () => {
      joinEstate();
    };

    const onUpdate = (payload: any) => {
      if (!payload?.deviceId || payload.deviceId !== deviceId) return;

      setData((s) => ({
        ...s,
        state: payload?.state ?? s.state,
        lastSeen: new Date().toISOString(),
        error: null,
      }));
    };

    socket.on("connect", onConnect);
    socket.on("device:update", onUpdate);

    // If already connected, join immediately (important when estateId arrives late)
    if (socket.connected) joinEstate();

    return () => {
      socket.off("connect", onConnect);
      socket.off("device:update", onUpdate);
    };
  }, [deviceId, estateId]);

  // If estateId becomes available AFTER mount, join and refresh once
  useEffect(() => {
    if (!deviceId) return;
    if (!estateId) return;

    const socket = getSocket();
    if (!socket) return;

    // join (if not already)
    if (estateJoinedRef.current !== estateId) {
      socket.emit("subscribe:estate", estateId);
      estateJoinedRef.current = estateId;
    }

    // optional: pull fresh state once when estate context becomes known
    refresh();
  }, [estateId, deviceId, refresh]);

  return { ...data, refresh };
}
