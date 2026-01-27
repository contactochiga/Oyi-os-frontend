// src/app/invites/page.tsx
"use client";

import { useEffect, useState } from "react";
import { acceptInvite, declineInvite, listMyInvites, HomeInvite } from "@/services/invitesService";
import { useSessionStore } from "@/store/useSessionStore";

export default function InvitesPage() {
  const { hydrate } = useSessionStore();
  const [loading, setLoading] = useState(true);
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
    setErr(null);
    const res: any = await acceptInvite(id);
    if (res?.error) return setErr(res.error);
    await refresh();
    // later: trigger /me refresh or rehydrate token if backend returns updated token
  }

  async function onDecline(id: string) {
    setErr(null);
    const res: any = await declineInvite(id);
    if (res?.error) return setErr(res.error);
    await refresh();
  }

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-gray-400 mt-1">Accept or decline home invites.</p>

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
              {pending.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-sm text-gray-300">You were invited to join a home</div>
                  <div className="mt-2 text-xs text-gray-400">
                    Estate: <span className="text-gray-200">{inv.estate_id}</span>
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
                      className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition py-2 text-sm font-medium"
                      type="button"
                    >
                      Accept
                    </button>

                    <button
                      onClick={() => onDecline(inv.id)}
                      className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 transition py-2 text-sm font-medium"
                      type="button"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={refresh}
          className="mt-6 text-sm text-gray-300 underline underline-offset-4 hover:text-white"
          type="button"
        >
          Refresh
        </button>
      </div>
    </main>
  );
}
