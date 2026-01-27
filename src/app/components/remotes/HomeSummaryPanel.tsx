// src/app/components/remotes/HomeSummaryPanel.tsx

"use client";

import { useCallback } from "react";
import RemotePanel from "./RemotePanel";
import DynamicSuggestionCard from "../DynamicSuggestionCard";
import InviteRequestCard from "../InviteRequestCard";
import { useEventStore } from "@/store/useEventStore";
import type { EstateEvent } from "@/types/events";

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  );
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`)
  );
  return m ? decodeURIComponent(m[1]) : "";
}

function getConsumerToken() {
  return getCookieValue("oyi_consumer_token");
}

export default function HomeSummaryPanel({
  lastUpdated,
}: {
  lastUpdated?: number;
}) {
  const { pushEvent } = useEventStore();

  // ✅ What happens when user taps a suggestion pill
  // You can later wire this to your command bar / AI input / quick actions.
  const handleSuggestionSend = useCallback(
    (text: string) => {
      pushEvent({
        id: `suggestion_ack_${Date.now()}`,
        type: "system",
        category: "system",
        title: "Queued",
        message: text,
        actionable: false,
        priority: "low",
        expiresAt: Date.now() + 2500,
      });
    },
    [pushEvent]
  );

  // ✅ Invite Accept
  const handleAcceptInvite = useCallback(
    async (inviteId: string, e: EstateEvent) => {
      const API = getApiBase();
      const token = getConsumerToken();

      if (!API) {
        pushEvent({
          id: `invite_err_${Date.now()}`,
          type: "system",
          category: "system",
          title: "Backend not set",
          message: "Missing NEXT_PUBLIC_API_URL",
          actionable: false,
          priority: "high",
          expiresAt: Date.now() + 4000,
        });
        return;
      }

      try {
        // ✅ Adjust endpoint to your backend route when you create it.
        // Recommended: POST /invites/accept  { inviteId }
        const res = await fetch(`${API}/invites/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ inviteId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || data?.message || "Failed to accept invite");
        }

        pushEvent({
          id: `invite_ok_${Date.now()}`,
          type: "system",
          category: "system",
          title: "Invite accepted",
          message: `You’ve joined ${e.payload?.estateName || "the estate"} successfully.`,
          actionable: false,
          priority: "medium",
          expiresAt: Date.now() + 3500,
        });

        // OPTIONAL: if your backend returns updated session/user/home,
        // you can trigger a refresh here or update your session store.
      } catch (err: any) {
        pushEvent({
          id: `invite_fail_${Date.now()}`,
          type: "system",
          category: "system",
          title: "Invite failed",
          message: err?.message || "Could not accept invite",
          actionable: false,
          priority: "high",
          expiresAt: Date.now() + 4500,
        });
      }
    },
    [pushEvent]
  );

  // ✅ Invite Decline
  const handleDeclineInvite = useCallback(
    async (inviteId: string) => {
      const API = getApiBase();
      const token = getConsumerToken();

      if (!API) return;

      try {
        // ✅ Adjust endpoint to your backend route when you create it.
        // Recommended: POST /invites/decline { inviteId }
        const res = await fetch(`${API}/invites/decline`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ inviteId }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || data?.message || "Failed to decline invite");

        pushEvent({
          id: `invite_declined_${Date.now()}`,
          type: "system",
          category: "system",
          title: "Invite declined",
          message: "No action taken.",
          actionable: false,
          priority: "low",
          expiresAt: Date.now() + 2500,
        });
      } catch (err: any) {
        pushEvent({
          id: `invite_decline_fail_${Date.now()}`,
          type: "system",
          category: "system",
          title: "Decline failed",
          message: err?.message || "Could not decline invite",
          actionable: false,
          priority: "high",
          expiresAt: Date.now() + 4500,
        });
      }
    },
    [pushEvent]
  );

  return (
    <RemotePanel title="Home Summary" lastUpdated={lastUpdated}>
      <div className="space-y-4">
        {/* ✅ INVITES (Accept / Decline) */}
        <InviteRequestCard onAccept={handleAcceptInvite} onDecline={handleDeclineInvite} />

        {/* ✅ SUGGESTIONS (tap-to-send pills) */}
        <DynamicSuggestionCard onSend={handleSuggestionSend} />

        {/* STATUS BLOCKS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Power</div>
            <div className="text-white font-medium">Active</div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Water</div>
            <div className="text-white font-medium">Available</div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Security</div>
            <div className="text-white font-medium">All doors locked</div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Active Devices</div>
            <div className="text-white font-medium">3 running</div>
          </div>
        </div>

        {/* QUICK INSIGHT */}
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-4 text-sm text-gray-300">
          No security alerts. Last visitor was approved 2 hours ago.
        </div>
      </div>
    </RemotePanel>
  );
}
