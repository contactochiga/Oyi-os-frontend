"use client";

import { useState } from "react";
import { acceptInvite, declineInvite, HomeInvite } from "@/services/invitesService";

export default function InviteRequestCard({
  invite,
  onDone,
}: {
  invite: HomeInvite;
  onDone?: () => void;
}) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onAccept() {
    setErr(null);
    setLoading("accept");
    const res: any = await acceptInvite(invite.id);
    setLoading(null);
    if (res?.error) return setErr(res.error);
    onDone?.();
  }

  async function onDecline() {
    setErr(null);
    setLoading("decline");
    const res: any = await declineInvite(invite.id);
    setLoading(null);
    if (res?.error) return setErr(res.error);
    onDone?.();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white">Home invite</div>
      <div className="mt-1 text-xs text-gray-300">
        You’ve been invited to join a home as <span className="text-white">{invite.role}</span>
      </div>

      <div className="mt-3 text-xs text-gray-400 space-y-1">
        <div>
          Estate: <span className="text-gray-200">{invite.estate_id}</span>
        </div>
        <div>
          Home: <span className="text-gray-200">{invite.home_id}</span>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={!!loading}
          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading === "accept" ? "Accepting..." : "Accept"}
        </button>

        <button
          type="button"
          onClick={onDecline}
          disabled={!!loading}
          className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 transition py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </button>
      </div>
    </div>
  );
}
