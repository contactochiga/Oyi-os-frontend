"use client";

import { useEffect, useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
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

function proximityDiagnostic(event: string, detail: Record<string, any>) {
  if (typeof window === "undefined") return;
  const payload = {
    message: event,
    ...detail,
    at: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent("oyi:proximity-diagnostic", { detail: payload }));
  if (process.env.NODE_ENV !== "production") {
    console.info("[consumer.proximity]", payload);
  }
}

export default function GeoFenceBridge() {
  const { token, ready, user } = useAuth();
  const activeContext = useActiveContext();
  const lastSentAt = useRef(0);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const authUserId = String((user as any)?.id || "");

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
    if (!ready || !token || !activeContext.ready || !activeContext.home_id) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      proximityDiagnostic("proximity_monitor_failed", {
        reason: "geolocation_unavailable",
        estate_id: activeContext.estate_id || null,
        home_id: activeContext.home_id || null,
      });
      return;
    }

    let watchId: number | null = null;
    let cancelled = false;
    let settings: ProximitySettings | null = null;
    const userId = authUserId;
    const homeId = String(activeContext.home_id || "");
    const estateId = String(activeContext.estate_id || "");
    const key = stateKey(userId, homeId);
    const savedState = window.localStorage.getItem(key) as ProximityState | null;
    let lastState: ProximityState | null = savedState || null;

    async function sendPosition(lat: number, lng: number) {
      if (!settings?.enabled) return;
      const next = classifyState(settings, lat, lng, lastState);
      proximityDiagnostic("proximity_event_received", {
        estate_id: estateId || null,
        home_id: homeId || null,
        has_settings: Boolean(settings),
        previous_state: lastState,
        next_state: next?.state || null,
        distance_meters: next?.distance ?? null,
      });
      if (!next) {
        proximityDiagnostic("proximity_event_suppressed", { reason: "no_home_or_estate_coordinates", estate_id: estateId || null, home_id: homeId || null });
        return;
      }
      if (next.state === lastState && Date.now() - lastSentAt.current < 5 * 60_000) {
        proximityDiagnostic("proximity_event_suppressed", { reason: "state_unchanged", state: next.state, estate_id: estateId || null, home_id: homeId || null });
        return;
      }
      const now = Date.now();
      if (now - lastSentAt.current < 60_000) {
        proximityDiagnostic("proximity_event_suppressed", { reason: "rate_limited", state: next.state, estate_id: estateId || null, home_id: homeId || null });
        return;
      }
      lastSentAt.current = now;
      lastState = next.state;
      window.localStorage.setItem(key, next.state);

      await proximityService.recordEvent({
        state: next.state,
        distance_meters: next.distance,
        home_id: settings.home_id || homeId,
        estate_id: settings.estate_id || estateId || null,
        occurred_at: new Date().toISOString(),
      }).then(() => {
        proximityDiagnostic("proximity_notification_created", {
          state: next.state,
          estate_id: settings?.estate_id || estateId || null,
          home_id: settings?.home_id || homeId || null,
          distance_meters: next.distance,
        });
      }).catch((error) => {
        proximityDiagnostic("proximity_monitor_failed", {
          reason: "record_event_failed",
          estate_id: estateId || null,
          home_id: homeId || null,
          error: error?.response?.data?.code || error?.message || "unknown",
        });
      });
    }

    proximityDiagnostic("proximity_home_resolved", { user_id: userId, estate_id: estateId || null, home_id: homeId || null });

    proximityService.getSettings({ estate_id: estateId || null, home_id: homeId || null }).then((loaded) => {
      if (cancelled) return;
      proximityDiagnostic("proximity_permission_state", {
        estate_id: estateId || null,
        home_id: homeId || null,
        enabled: loaded.enabled === true,
        available: loaded.available !== false,
      });
      if (loaded.enabled !== true) return;
      settings = loaded;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          void sendPosition(pos.coords.latitude, pos.coords.longitude);
        },
        (error) => {
          proximityDiagnostic("proximity_monitor_failed", {
            reason: "geolocation_error",
            code: error.code,
            estate_id: estateId || null,
            home_id: homeId || null,
          });
        },
        {
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 20_000,
        }
      );
      proximityDiagnostic("proximity_monitor_started", { estate_id: estateId || null, home_id: homeId || null, watch_id: watchId });
    }).catch((error) => {
      proximityDiagnostic("proximity_monitor_failed", {
        reason: "settings_load_failed",
        estate_id: estateId || null,
        home_id: homeId || null,
        error: error?.response?.data?.code || error?.message || "unknown",
      });
    });

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [ready, token, authUserId, activeContext.ready, activeContext.contextKey, activeContext.estate_id, activeContext.home_id, settingsVersion]);

  return null;
}
