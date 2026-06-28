"use client";

import { useEffect } from "react";
import { getSocket } from "@/services/socket";
import { useDeviceStateStore } from "@/store/useDeviceStateStore";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { scopeMatches } from "@/lib/footerBadges";
import { extractRuntimeDeviceUpdate } from "@/lib/runtimeSignal";

export default function useSignalStream() {
  const { user } = useAuth();
  const activeContext = useActiveContext();
  const upsertState = useDeviceStateStore((s) => s.upsertState);

  useEffect(() => {
    if (!user?.id || !activeContext.ready) return;

    const socket = getSocket();
    if (!socket) return;

    const estateId = activeContext.estate_id;
    socket.emit("subscribe:user", user.id);
    if (estateId) socket.emit("subscribe:estate", estateId);
    if (activeContext.home_id) socket.emit("subscribe:home", activeContext.home_id);

    const onSignal = (signal: any) => {
      const update = extractRuntimeDeviceUpdate(signal);
      if (!update) return;
      if ((signal.estate_id || signal.home_id) && !scopeMatches({ userId: signal.user_id, estateId: signal.estate_id || signal.estateId, homeId: signal.home_id || signal.homeId }, { userId: user.id, estateId: activeContext.estate_id, homeId: activeContext.home_id }, { allowUnscoped: false })) return;
      upsertState(update.deviceId, update.state);
    };

    socket.on("signal", onSignal);

    return () => {
      socket.off("signal", onSignal);
    };
  }, [user?.id, activeContext.ready, activeContext.contextKey, upsertState]);
}
