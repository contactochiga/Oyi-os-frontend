// src/app/components/remotes/CommunityPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { communityService, type CommunityPost } from "@/services/communityService";

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommunityPanel({
  limit = 3,
  lastUpdated: _lastUpdated,
  onInteraction: _onInteraction,
}: {
  limit?: number;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const estateId = useMemo(() => {
    return (
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null)
    );
  }, [user]);

  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!estateId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const list = await communityService.listByEstate(String(estateId));
      const arr = Array.isArray(list) ? list : [];
      setItems(arr.slice(0, Math.max(1, limit)));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-white/70 font-semibold">Community</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading || !estateId}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] text-white/80 border border-white/10 disabled:opacity-50"
          >
            {loading ? "…" : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/community")}
            className="px-2.5 py-1.5 rounded-xl bg-white text-black text-[11px] font-semibold"
          >
            View all
          </button>
        </div>
      </div>

      {!estateId ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
          No estate linked.
        </div>
      ) : loading && items.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
          No updates yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((p: any) => (
            <button
              key={String(p?.id)}
              type="button"
              onClick={() => router.push("/community")}
              className="w-full text-left rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition px-3 py-2"
            >
              <div className="text-[13px] text-white/90 font-semibold truncate">
                {p?.title || "Update"}
              </div>
              <div className="text-[11px] text-white/40 mt-1">
                {when(p?.created_at)}
              </div>
              {p?.body ? (
                <div className="text-[12px] text-white/65 mt-2 line-clamp-2">
                  {String(p.body)}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
