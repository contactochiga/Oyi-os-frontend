"use client";

import { useEffect, useRef } from "react";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";

export default function GeoFenceBridge() {
  const { token, ready, user } = useAuth();
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!ready || !token || !user?.home_id) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let watchId: number | null = null;
    let cancelled = false;

    async function sendPosition(lat: number, lng: number) {
      const now = Date.now();
      if (now - lastSentAt.current < 60_000) return;
      lastSentAt.current = now;

      await API.post("/geo/evaluate", {
        lat,
        lng,
        radius_meters: 120,
      }).catch(() => {});
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        void sendPosition(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 20_000,
      }
    );

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [ready, token, user?.home_id]);

  return null;
}
