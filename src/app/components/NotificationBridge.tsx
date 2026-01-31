"use client";

import { useEffect } from "react";
import { listMyNotifications } from "@/services/notificationsService";
import { useSessionStore } from "@/store/useSessionStore";
import { useNotificationStore } from "@/store/useNotificationStore";

export default function NotificationBridge() {
  const token = useSessionStore((s) => s.token);
  const upsertMany = useNotificationStore((s) => s.upsertMany);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      const res: any = await listMyNotifications();
      if (cancelled) return;
      if (Array.isArray(res)) upsertMany(res);
    }

    load();
    const t = window.setInterval(load, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [token, upsertMany]);

  return null;
}
