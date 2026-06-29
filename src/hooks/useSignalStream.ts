"use client";

import { useEffect } from "react";
import { getSocket } from "@/services/socket";
import { useDeviceStateStore } from "@/store/useDeviceStateStore";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { scopeMatches } from "@/lib/footerBadges";
import { extractRuntimeDeviceUpdate } from "@/lib/runtimeSignal";
import { useRuntimeIntelligenceStore } from "@/store/useRuntimeIntelligenceStore";

export default function useSignalStream() {
  const { user } = useAuth();
  const activeContext = useActiveContext();
  const upsertState = useDeviceStateStore((s) => s.upsertState);
  const ingestRuntime = useRuntimeIntelligenceStore((state) => state.ingest);

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
      ingestRuntime({
        signal: signal?.operational_signal || signal || null,
        awareness: signal?.operational_awareness || null,
        insights: Array.isArray(signal?.operational_insights) ? signal.operational_insights : [],
        recommendations: Array.isArray(signal?.operational_recommendations) ? signal.operational_recommendations : [],
        automationPlans: Array.isArray(signal?.operational_automation_plans) ? signal.operational_automation_plans : [],
        execution: signal?.execution_record || signal?.execution || null,
      });
      if (!update) return;
      if ((signal.estate_id || signal.home_id) && !scopeMatches({ userId: signal.user_id, estateId: signal.estate_id || signal.estateId, homeId: signal.home_id || signal.homeId }, { userId: user.id, estateId: activeContext.estate_id, homeId: activeContext.home_id }, { allowUnscoped: false })) return;
      upsertState(update.deviceId, update.state);
    };

    socket.on("signal", onSignal);

    return () => {
      socket.off("signal", onSignal);
    };
  }, [user?.id, activeContext.ready, activeContext.contextKey, ingestRuntime, upsertState]);
}
