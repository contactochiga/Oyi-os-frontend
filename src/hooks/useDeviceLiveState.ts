// src/hooks/useDeviceLiveState.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deviceService } from "@/services/deviceService";
import type { DeviceRuntimeContract } from "@/lib/deviceRuntimeContract";
import { getSocket } from "@/services/socket";
import useActiveContext from "@/hooks/useActiveContext";
import { scopeMatches } from "@/lib/footerBadges";
import { extractRuntimeDeviceUpdate } from "@/lib/runtimeSignal";

type LiveState = {
  state: Record<string, any> | null;
  runtime: DeviceRuntimeContract | null;
  lastSeen?: string | null;
  loading: boolean;
  error: string | null;
};

export function useDeviceLiveState(deviceId?: string, estateId?: string | null) {
  const activeContext = useActiveContext();
  const [data, setData] = useState<LiveState>({
    state: null,
    runtime: null,
    lastSeen: null,
    loading: false,
    error: null,
  });

  const canUse = useMemo(() => !!deviceId, [deviceId]);

  const estateJoinedRef = useRef<string | null>(null);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    if (inFlightRefreshRef.current) return inFlightRefreshRef.current;

    setData((s) => ({ ...s, loading: true, error: null }));
    const operation = (async () => {
      try {
        const resp = await deviceService.getDeviceState(deviceId, { view: "panel" });
        setData((s) => ({
          ...s,
          state: resp?.state ?? null,
          runtime: resp ?? null,
          lastSeen: resp?.lastSeen ?? null,
          loading: false,
        }));
      } catch (e: any) {
        setData((s) => ({
          ...s,
          loading: false,
          error: e?.message || "Failed to fetch device state",
        }));
      } finally {
        inFlightRefreshRef.current = null;
      }
    })();
    inFlightRefreshRef.current = operation;
    return operation;
  }, [deviceId]);

  // Initial fetch (and when device changes)
  useEffect(() => {
    if (!canUse) return;
    refresh();
    return () => {
      if (deviceId) void deviceService.releaseDeviceView(deviceId);
    };
  }, [canUse, deviceId, refresh]);

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
      if (activeContext.home_id) socket.emit("subscribe:home", activeContext.home_id);
    };

    const onUpdate = (payload: any) => {
      const update = extractRuntimeDeviceUpdate(payload);
      if (!update || update.deviceId !== deviceId) return;
      if ((payload?.estate_id || payload?.estateId || payload?.home_id || payload?.homeId) && !scopeMatches(
        { estateId: payload?.estate_id || payload?.estateId, homeId: payload?.home_id || payload?.homeId },
        { estateId: activeContext.estate_id, homeId: activeContext.home_id },
        { allowUnscoped: false },
      )) return;

      setData((s) => ({
        ...s,
        state: update.state ?? s.state,
        runtime: s.runtime
          ? {
              ...s.runtime,
              ...update,
              state: update.state ?? s.state,
              canonical_state: update.canonical_state ?? update.canonicalState ?? s.runtime.canonical_state,
              canonicalState: update.canonical_state ?? update.canonicalState ?? s.runtime.canonicalState,
              canonical_presentation: update.canonical_presentation ?? update.presentation ?? s.runtime.canonical_presentation,
              presentation: update.canonical_presentation ?? update.presentation ?? s.runtime.presentation,
            }
          : { ...(update as any), state: update.state ?? s.state },
        lastSeen: new Date().toISOString(),
        error: null,
      }));
    };

    socket.on("connect", onConnect);
    socket.on("signal", onUpdate);
    socket.on("device.status.updated", onUpdate);
    socket.on("device:update", onUpdate);

    // If already connected, join immediately (important when estateId arrives late)
    if (socket.connected) joinEstate();
    if (socket.connected && activeContext.home_id) socket.emit("subscribe:home", activeContext.home_id);

    return () => {
      socket.off("connect", onConnect);
      socket.off("signal", onUpdate);
      socket.off("device.status.updated", onUpdate);
      socket.off("device:update", onUpdate);
    };
  }, [deviceId, estateId, activeContext.contextKey]);

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
    if (activeContext.home_id) socket.emit("subscribe:home", activeContext.home_id);

  }, [estateId, deviceId, activeContext.home_id]);

  return { ...data, refresh };
}
