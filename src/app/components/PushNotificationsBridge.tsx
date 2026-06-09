"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Device } from "@capacitor/device";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";
import { useNotificationStore } from "@/store/useNotificationStore";

const PUSH_TOKEN_CACHE_KEY = "oyi:push:native-token:v1";
const OYI_IOS_BUNDLE_ID = "com.ochiga.oyios";

function pushEnvironment() {
  const explicit = String(process.env.NEXT_PUBLIC_PUSH_ENVIRONMENT || process.env.NEXT_PUBLIC_APP_ENV || "").toLowerCase();
  return explicit === "production" ? "production" : "sandbox";
}

export default function PushNotificationsBridge() {
  const { token, ready } = useAuth();
  const upsert = useNotificationStore((s) => s.upsert);
  const [mounted, setMounted] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!ready || !token) return;
    if (typeof window === "undefined") return;
    if (!mounted || !isNative) return;

    let unmounted = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    function updateStatus(next: string, nextDetail = "") {
      if (unmounted) return;
      try {
        localStorage.setItem("oyi_push_debug", JSON.stringify({ status: next, detail: nextDetail, at: new Date().toISOString() }));
      } catch {}
      console.log("[push]", next, nextDetail);
    }

    function cacheNativeToken(rawToken: string) {
      const cleanToken = String(rawToken || "").trim();
      if (!cleanToken) return;
      try {
        localStorage.setItem(PUSH_TOKEN_CACHE_KEY, JSON.stringify({ value: cleanToken, platform: Capacitor.getPlatform(), cached_at: new Date().toISOString() }));
      } catch {}
    }

    function readCachedNativeToken() {
      try {
        const parsed = JSON.parse(localStorage.getItem(PUSH_TOKEN_CACHE_KEY) || "null");
        return String(parsed?.value || "").trim();
      } catch {
        return "";
      }
    }

    async function init() {

      async function registerToken(rawToken: string) {
        const cleanToken = String(rawToken || "").trim();
        if (!cleanToken) return;
        cacheNativeToken(cleanToken);
        updateStatus("token-sending-to-backend", cleanToken.slice(0, 12));
        let deviceInfo: any = null;
        try {
          deviceInfo = await Device.getInfo();
        } catch {}

        const platform = Capacitor.getPlatform();
        await API.post("/push/register", {
          token: cleanToken,
          platform,
          provider: platform === "ios" ? "apns" : "fcm",
          environment: platform === "ios" ? pushEnvironment() : null,
          app_bundle: platform === "ios" ? OYI_IOS_BUNDLE_ID : null,
          device_id: deviceInfo?.identifier || deviceInfo?.model || null,
          app_version: deviceInfo?.appVersion || null,
        })
          .then(() => updateStatus("backend-token-registration-success", cleanToken.slice(0, 12)))
          .catch((err) => {
            const msg = err?.response?.data?.error || err?.message || "Failed to POST /push/register";
            updateStatus("register-api-failed", String(msg));
          });
      }

      async function presentForegroundNotification(notification: any) {
        const title = String(notification?.title || notification?.data?.title || "Oyi");
        const body = String(notification?.body || notification?.data?.body || "");
        if (!title && !body) return;
        try {
          await LocalNotifications.schedule({ notifications: [{ id: Date.now(), title, body, schedule: { at: new Date(Date.now() + 250) }, sound: "default" }] });
        } catch {}
        try {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch {}
      }

      try {
        updateStatus("requesting-permission");
        const localPerms = await LocalNotifications.requestPermissions().catch(() => null);
        const pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive !== "granted") {
          updateStatus("permission-denied", String(pushPerms.receive || "not-granted"));
          return;
        }
        if (localPerms && localPerms.display !== "granted") {
          // fail soft: remote push can still work
        }
        updateStatus("push-permission-granted");

        const cachedToken = readCachedNativeToken();
        if (cachedToken) {
          updateStatus("cached-token-resend-started", cachedToken.slice(0, 12));
          void registerToken(cachedToken);
        }

        listeners.push(await PushNotifications.addListener("registration", (tokenInfo: any) => {
          if (unmounted) return;
          const value = String(tokenInfo?.value || "");
          updateStatus("apns-token-received", value.slice(0, 12));
          void registerToken(value);
        }));

        listeners.push(await PushNotifications.addListener("registrationError", (error: any) => {
          updateStatus("registration-error", String(error?.error || error?.message || "unknown"));
        }));

        listeners.push(await PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
          if (unmounted) return;
          const payload = notification?.data || {};
          if (payload?.id) upsert(payload);
          void presentForegroundNotification(notification);
        }));

        listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
          if (unmounted) return;
          const payload = action?.notification?.data || {};
          if (payload?.id) upsert(payload);
        }));

        updateStatus("push-registration-started");
        await PushNotifications.register();
      } catch {
        updateStatus("bridge-failed", "Push initialization crashed");
      }
    }

    void init();

    return () => {
      unmounted = true;
      for (const listener of listeners) listener.remove().catch(() => {});
    };
  }, [ready, token, upsert, mounted, isNative]);

  return null;
}
