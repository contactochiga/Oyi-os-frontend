"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useActiveContext from "@/hooks/useActiveContext";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useDeviceStateStore } from "@/store/useDeviceStateStore";
import { useRuntimeIntelligenceStore } from "@/store/useRuntimeIntelligenceStore";
import { useEventStore } from "@/store/useEventStore";
import { replaceSocketScope } from "@/services/socket";

export default function ContextIsolationBridge() {
  const activeContext = useActiveContext();
  const queryClient = useQueryClient();
  const clearNotifications = useNotificationStore((state) => state.clear);
  const clearDeviceStates = useDeviceStateStore((state) => state.clear);
  const resetRuntimeIntelligence = useRuntimeIntelligenceStore((state) => state.reset);
  const clearEvents = useEventStore((state) => state.clearAll);
  const lastContextKey = useRef(activeContext.contextKey);

  useEffect(() => {
    const clearScopedState = () => {
      void queryClient.cancelQueries();
      queryClient.removeQueries();
      clearNotifications();
      clearDeviceStates();
      resetRuntimeIntelligence();
      clearEvents();
    };
    window.addEventListener("oyi:context-switch-start", clearScopedState);
    return () => window.removeEventListener("oyi:context-switch-start", clearScopedState);
  }, [clearEvents, clearNotifications, clearDeviceStates, queryClient, resetRuntimeIntelligence]);

  useEffect(() => {
    replaceSocketScope({ estate_id: activeContext.estate_id, home_id: activeContext.home_id });
    if (lastContextKey.current !== activeContext.contextKey) {
      void queryClient.cancelQueries();
      queryClient.removeQueries();
      clearNotifications();
      clearDeviceStates();
      resetRuntimeIntelligence();
      clearEvents();
      lastContextKey.current = activeContext.contextKey;
    }
  }, [activeContext.contextKey, activeContext.estate_id, activeContext.home_id, clearEvents, clearNotifications, clearDeviceStates, queryClient, resetRuntimeIntelligence]);

  return null;
}
