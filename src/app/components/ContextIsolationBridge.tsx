"use client";

import { useEffect, useRef } from "react";
import useActiveContext from "@/hooks/useActiveContext";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useDeviceStateStore } from "@/store/useDeviceStateStore";

export default function ContextIsolationBridge() {
  const activeContext = useActiveContext();
  const clearNotifications = useNotificationStore((state) => state.clear);
  const clearDeviceStates = useDeviceStateStore((state) => state.clear);
  const lastContextKey = useRef(activeContext.contextKey);

  useEffect(() => {
    const clearScopedState = () => {
      clearNotifications();
      clearDeviceStates();
    };
    window.addEventListener("oyi:context-switch-start", clearScopedState);
    return () => window.removeEventListener("oyi:context-switch-start", clearScopedState);
  }, [clearNotifications, clearDeviceStates]);

  useEffect(() => {
    if (lastContextKey.current !== activeContext.contextKey) {
      clearNotifications();
      clearDeviceStates();
      lastContextKey.current = activeContext.contextKey;
    }
  }, [activeContext.contextKey, clearNotifications, clearDeviceStates]);

  return null;
}
