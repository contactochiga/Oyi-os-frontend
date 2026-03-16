"use client";

import { useEffect, useMemo, useState } from "react";
import { acceptInvite, declineInvite, HomeInvite } from "@/services/invitesService";
import useAuth from "@/hooks/useAuth";
import { setCookie } from "@/lib/auth";

type ActionState =
  | { status: "idle" }
  | { status: "loading"; action: "accept" | "decline" }
  | { status: "success"; action: "accept" | "decline" }
  | { status: "error"; message: string };

export default function InviteRequestCard({
  invite,
  onDone,
  autoCloseMs = 1200,
  readOnly = false,
}: {
  invite: HomeInvite;
  onDone?: () => void;
  autoCloseMs?: number;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<ActionState>({ status: "idle" });

  const { setSession } = useAuth();

  const estateName = useMemo(
    () => invite.estate?.name || invite.estate_id || "—",
    [invite]
  );

  const homeName = useMemo(
    () => invite.home_label || invite.home_id || "—",
    [invite]
  );

  const busy = state.status === "loading";
  const passiveState = String((invite as any)?.status || "").toLowerCase();
  const isPassive = readOnly || passiveState === "accepted" || passiveState === "active" || passiveState === "declined";
  const isSuccess = state.status === "success" || isPassive;

  // Auto close after success (so the notification list clears cleanly)
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => onDone?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [isSuccess, onDone, autoCloseMs]);

  async function onAccept() {
    if (busy || isPassive) return;
    setState({ status: "loading", action: "accept" });

    try {
      const res: any = await acceptInvite(invite.id);

      if (res?.error) {
        setState({ status: "error", message: String(res.error) });
        return;
      }

      // ✅ persist session if backend returns token+user
      if (res?.token) {
        try {
          setCookie("oyi_consumer_token", res.token, 30);
        } catch {}
        setSession(res.token, res.user || null);
      }

      setState({ status: "success", action: "accept" });
      // onDone() will be called by autoClose effect
    } catch (e: any) {
      setState({ status: "error", message: e?.message || "Failed to accept invite" });
    }
  }

  async function onDecline() {
    if (busy || isPassive) return;
    setState({ status: "loading", action: "decline" });

    try {
      const res: any = await declineInvite(invite.id);

      if (res?.error) {
        setState({ status: "error", message: String(res.error) });
        return;
      }

      setState({ status: "success", action: "decline" });
      // onDone() will be called by autoClose effect
    } catch (e: any) {
      setState({ status: "error", message: e?.message || "Failed to decline invite" });
    }
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        isSuccess
          ? "border-emerald-500/20 bg-emerald-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {isSuccess ? "Invite updated" : "Home invite"}
          </div>

          <div className="mt-1 text-xs text-white/60">
            You’ve been invited to join a home as{" "}
            <span className="text-white/85">{invite.role}</span>
          </div>
        </div>

        {isSuccess ? (
          <div className="shrink-0 text-emerald-200 text-sm font-semibold">✓</div>
        ) : null}
      </div>

      <div className="mt-3 text-xs text-white/55 space-y-1">
        <div>
          Estate: <span className="text-white/80">{estateName}</span>
        </div>
        <div>
          Home: <span className="text-white/80">{homeName}</span>
        </div>
      </div>

      {state.status === "error" && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {state.message}
        </div>
      )}

      {/* Actions */}
      {!isPassive ? <div className="mt-4 flex gap-2">
        {/* Accept */}
        <button
          type="button"
          onClick={onAccept}
          disabled={busy || isSuccess}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-60
            ${
              isSuccess
                ? "bg-white/10 text-white/60"
                : "bg-white text-black hover:bg-white/90"
            }`}
        >
          {state.status === "loading" && state.action === "accept"
            ? "Accepting…"
            : state.status === "success" && state.action === "accept"
            ? "Joined ✓"
            : "Accept"}
        </button>

        {/* Decline */}
        <button
          type="button"
          onClick={onDecline}
          disabled={busy || isSuccess}
          className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 transition py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {state.status === "loading" && state.action === "decline"
            ? "Declining…"
            : state.status === "success" && state.action === "decline"
            ? "Declined ✓"
            : "Decline"}
        </button>
      </div> : null}

      {/* success hint (optional) */}
      {isSuccess && (
        <div className="mt-3 text-[11px] text-emerald-200/80">
          {passiveState === "declined" ? "Invite already declined." : "Invite already processed."}
        </div>
      )}
    </div>
  );
}
