"use client";

import { useEffect } from "react";
import useAuth from "@/hooks/useAuth";
import messagesService from "@/services/messagesService";

export default function PresenceBridge() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (!ready || !token || typeof window === "undefined") return;

    let cancelled = false;

    async function ping() {
      if (cancelled) return;
      await messagesService.pingPresence();
    }

    void ping();
    const interval = window.setInterval(() => {
      void ping();
    }, 45_000);

    const onFocus = () => {
      void ping();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void ping();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, token]);

  return null;
}
