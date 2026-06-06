"use client";

import { useEffect, useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import { proximityService, type ProximitySettings, type ProximityState } from "@/services/proximityService";

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadius = 6371000;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function finiteCoord(value: any) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function stateKey(userId: string, homeId?: string | null) {
  return `oyi_proximity_state:${userId}:${homeId || "home"}`;
}

function classifyState(settings: ProximitySettings, lat: number, lng: number, previous: ProximityState | null) {
  const radius = Number(settings.radius_meters || 100);
  const homeLat = finiteCoord(settings.home_lat);
  const homeLng = finiteCoord(settings.home_lng);
  const estateLat = finiteCoord(settings.estate_lat);
  const estateLng = finiteCoord(settings.estate_lng);

  const homeDistance = homeLat !== null && homeLng !== null ? distanceMeters(lat, lng, homeLat, homeLng) : null;
  const estateDistance = estateLat !== null && estateLng !== null ? distanceMeters(lat, lng, estateLat, estateLng) : null;

  if (homeDistance !== null && homeDistance <= radius) return { state: "near_home" as const, distance: homeDistance };
  if (previous === "near_home" && homeDistance !== null && homeDistance > radius) return { state: "leaving_home" as const, distance: homeDistance };
  if (estateDistance !== null && estateDistance <= Math.max(radius, 500)) return { state: "approaching_estate" as const, distance: estateDistance };
  if (homeDistance !== null) return { state: "away" as const, distance: homeDistance };
  return null;
}

export default function GeoFenceBridge() {
  const { token, ready, user } = useAuth();
  const lastSentAt = useRef(0);
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setSettingsVersion((value) => value + 1);
    window.addEventListener("oyi:proximity-settings-changed", handler);
    window.addEventListener("oyi:context-changed", handler);
    return () => {
      window.removeEventListener("oyi:proximity-settings-changed", handler);
      window.removeEventListener("oyi:context-changed", handler);
    };
  }, []);

  useEffect(() => {
    if (!ready || !token || !user?.home_id) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let watchId: number | null = null;
    let cancelled = false;
    let settings: ProximitySettings | null = null;
    const userId = String((user as any)?.id || "");
    const homeId = String(user.home_id || "");
    const estateId = String((user as any)?.estate_id || "");
    const key = stateKey(userId, user.home_id);
    const savedState = window.localStorage.getItem(key) as ProximityState | null;
    let lastState: ProximityState | null = savedState || null;

    async function sendPosition(lat: number, lng: number) {
      if (!settings?.enabled) return;
      const next = classifyState(settings, lat, lng, lastState);
      if (!next) return;
      if (next.state === lastState && Date.now() - lastSentAt.current < 5 * 60_000) return;
      const now = Date.now();
      if (now - lastSentAt.current < 60_000) return;
      lastSentAt.current = now;
      lastState = next.state;
      window.localStorage.setItem(key, next.state);

      await proximityService.recordEvent({
        state: next.state,
        distance_meters: next.distance,
        home_id: settings.home_id || homeId,
        estate_id: settings.estate_id || estateId || null,
        occurred_at: new Date().toISOString(),
      }).catch(() => {});
    }

    proximityService.getSettings().then((loaded) => {
      if (cancelled || loaded.enabled !== true) return;
      settings = loaded;
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
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [ready, token, user?.home_id, user?.estate_id, user?.id, settingsVersion]);

  return null;
}
