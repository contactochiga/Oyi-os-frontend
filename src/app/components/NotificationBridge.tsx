"use client";

import { useEffect } from "react";
import { listMyNotifications } from "@/services/notificationsService";
import { useNotificationStore } from "@/store/useNotificationStore";
import useAuth from "@/hooks/useAuth";

/**
 * Pull notifications into zustand store.
 * - polls lightly (15s)
 * - updates unread badge
 */
export default function NotificationsBridge() {
  const { token } = useAuth();
  const upsertMany = useNotificationStore((s) => s.upsertMany);
  const setItems = useNotificationStore((s) => s.setItems);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const res: any = await listMyNotifications();
      if (cancelled) return;

      // notificationsService returns array OR {error}
      if (Array.isArray(res)) {
        upsertMany(res);
      }
    }

    load();
    const t = window.setInterval(load, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [token, upsertMany, setItems]);

  return null;
}
