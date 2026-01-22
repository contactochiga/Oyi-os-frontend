"use client";

import { useEffect } from "react";
import { getSocket } from "@/services/socket";
import { useDeviceStateStore } from "@/store/useDeviceStateStore";
import useAuth from "@/hooks/useAuth";

export default function useSignalStream() {
  const { user } = useAuth();
  const upsertState = useDeviceStateStore((s) => s.upsertState);

  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();

    const estateId = (user as any)?.estate_id;
    socket.emit("subscribe:user", user.id);
    if (estateId) socket.emit("subscribe:estate", estateId);

    const onSignal = (signal: any) => {
      if (!signal?.type) return;

      // ✅ Confirmation path
      if (signal.type === "device.state.reported" && signal.deviceId && signal.state) {
        upsertState(signal.deviceId, signal.state);
      }
    };

    socket.on("signal", onSignal);

    return () => {
      socket.off("signal", onSignal);
    };
  }, [user?.id, (user as any)?.estate_id, upsertState]);
}
