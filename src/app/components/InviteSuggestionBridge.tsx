// src/app/components/InviteSuggestionBridge.tsx
"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { useEventStore } from "@/store/useEventStore";
import { listMyInvites, HomeInvite } from "@/services/invitesService";

function makeEventId(inviteId: string) {
  return `invite:${inviteId}`;
}

/**
 * Drops "You’ve been invited..." pills into DynamicSuggestionCard
 * - safe dedupe
 * - polls lightly (30s) to simulate push until we add websockets/mobile push
 */
export default function InviteSuggestionBridge() {
  const { token, user, hydrate } = useSessionStore();
  const pushEvent = useEventStore((s) => s.pushEvent);

  useEffect(() => {
    hydrate(); // safe no-op if already hydrated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      const res: any = await listMyInvites();
      if (cancelled) return;

      const invites: HomeInvite[] = res?.invites || [];
      const pending = invites.filter((i) => i.status === "pending");

      for (const inv of pending) {
        const id = makeEventId(inv.id);

        // ✅ dedupe (since pushEvent doesn't dedupe internally)
        const existing = useEventStore.getState().events.some((e) => e.id === id);
        if (existing) continue;

        // expiry: use backend expires_at if present, else 24h
        const expiresAt = inv.expires_at
          ? new Date(inv.expires_at).getTime()
          : Date.now() + 24 * 60 * 60 * 1000;

        pushEvent({
          id,
          category: "invite",
          priority: "high",
          title: "Home invite",
          message: "__OPEN_INVITES__", // ✅ sentinel action
          actionable: true,
          expiresAt,
          meta: {
            inviteId: inv.id,
            estate_id: inv.estate_id,
            home_id: inv.home_id,
            invited_email: inv.invited_email,
            role: inv.role,
          },
        } as any);
      }
    }

    load();

    // light poll (until real push/websocket)
    const t = window.setInterval(load, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [token, user?.email, pushEvent]);

  return null;
}
