"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { communityService, type CommunityPost } from "@/services/communityService";

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function CommunityPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CommunityPost[]>([]);

  function touch() {
    onInteraction?.();
  }

  async function load() {
    if (!estateId) return setErr("No estate linked yet.");
    setLoading(true);
    setErr(null);
    try {
      const list = await communityService.listByEstate(String(estateId));
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load community");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  const top = useMemo(() => items.slice(0, 3), [items]);

  return (
    <RemotePanel title="Community" lastUpdated={lastUpdated}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-white/45">
          {loading ? "Syncing…" : top.length ? `${items.length} updates` : "No updates"}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 disabled:opacity-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              touch();
              router.push("/community");
            }}
            className="px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold border border-white/20"
          >
            View all
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="space-y-2">
        {top.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              touch();
              router.push("/community");
            }}
            className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white/90 truncate">
                  {p.title || "Announcement"}
                </div>
                <div className="text-[11px] text-white/45 mt-1">
                  {when(p.created_at)} {p.status ? `• ${p.status}` : ""}
                </div>
              </div>
              <div className="text-[11px] text-white/35 shrink-0">→</div>
            </div>

            {p.body ? (
              <div className="text-[12px] text-white/65 mt-2 line-clamp-2">
                {p.body}
              </div>
            ) : null}
          </button>
        ))}

        {!loading && estateId && !items.length && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No posts yet.
          </div>
        )}
      </div>
    </RemotePanel>
  );
}
