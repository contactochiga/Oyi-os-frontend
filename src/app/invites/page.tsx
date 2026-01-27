// src/app/invites/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInvite,
  declineInvite,
  listMyInvites,
  HomeInvite,
} from "@/services/invitesService";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie } from "@/lib/auth";

export default function InvitesPage() {
  const router = useRouter();

  const { hydrate, setSession } = useSessionStore();

  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [invites, setInvites] = useState<HomeInvite[]>([]);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const res: any = await listMyInvites();
      if (res?.error) {
        setErr(res.error);
        setInvites([]);
      } else {
        setInvites(res?.invites || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    hydrate();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAccept(id: string) {
    if (actingId) return;

    setErr(null);
    setActingId(id);

    try {
      const res: any = await acceptInvite(id);
      if (res?.error) {
        setErr(res.error);
        return;
      }

      // ✅ NEW: backend returns a fresh token after accept
      // { ok: true, token, user, membership? }
      if (res?.token) {
        setCookie("oyi_consumer_token", res.token, 30);
        setSession(res.token);

        // go straight into the app
        router.replace("/home");
        return;
      }

      // fallback if token not returned (shouldn't happen now)
      await refresh();
    } finally {
      setActingId(null);
    }
  }

  async function onDecline(id: string) {
    if (actingId) return;

    setErr(null);
    setActingId(id);

    try {
      const res: any = await declineInvite(id);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      await refresh();
    } finally {
      setActingId(null);
    }
  }

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-gray-400 mt-1">
          Accept or decline home invites.
        </p>

        {err && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-gray-400">No pending invites.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((inv) => {
                const busy = actingId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="text-sm text-gray-300">
                      You were invited to join a home
                    </div>

                    <div className="mt-2 text-xs text-gray-400">
                      Estate:{" "}
                      <span className="text-gray-200">{inv.estate_id}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Home: <span className="text-gray-200">{inv.home_id}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Role: <span className="text-gray-200">{inv.role}</span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => onAccept(inv.id)}
                        disabled={!!actingId}
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        type="button"
                      >
                        {busy ? "Accepting…" : "Accept"}
                      </button>

                      <button
                        onClick={() => onDecline(inv.id)}
                        disabled={!!actingId}
                        className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 transition py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        type="button"
                      >
                        {busy ? "Working…" : "Decline"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={refresh}
          className="mt-6 text-sm text-gray-300 underline underline-offset-4 hover:text-white"
          type="button"
          disabled={loading || !!actingId}
        >
          Refresh
        </button>
      </div>
    </main>
  );
}
