"use client";

import { useEffect } from "react";
import useAuth from "@/hooks/useAuth";
import { startPresenceHeartbeat } from "@/services/presenceService";

export default function PresenceBridge() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (!ready || !token || typeof window === "undefined") return;

    const subscription = startPresenceHeartbeat();
    return () => subscription.stop();
  }, [ready, token]);

  return null;
}
