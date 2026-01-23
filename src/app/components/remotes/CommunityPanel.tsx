"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { communityService } from "@/services/estateOpsService";

type CommunityItem = {
  id: string;
  title: string;
  content?: string;
  created_at?: string;
  poll?: any;
};

export default function CommunityPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CommunityItem[]>([]);

  function touch() {
    onInteraction?.();
  }

  async function load() {
    if (!estateId) {
      setErr("No estate linked yet.");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const posts = await communityService.listPostsForEstate(estateId);
      setItems(posts || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load community posts");
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
    <RemotePanel title="Community" lastUpdated={lastUpdated}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">{loading ? "Syncing…" : "Estate posts"}</div>
        <button
          onClick={load}
          disabled={loading}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            loading ? "bg-gray-700 text-gray-400" : "bg-[#E11D2E] text-white"
          }`}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="space-y-3">
        {items.map((p) => (
          <div key={p.id} className="rounded-xl border border-gray-800 bg-gray-800 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">
                POST
              </span>
              <span className="text-xs text-gray-400">
                {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
              </span>
            </div>

            <div className="text-sm text-white font-medium mb-1">{p.title}</div>
            <div className="text-sm text-gray-300">{p.content || ""}</div>

            {p.poll && (
              <button
                onClick={touch}
                className="mt-3 w-full py-2 rounded-lg bg-gray-700 text-sm text-white"
              >
                View Poll
              </button>
            )}
          </div>
        ))}

        {!loading && !items.length && (
          <div className="text-sm text-gray-500 text-center py-6">
            No community posts yet.
          </div>
        )}
      </div>
    </RemotePanel>
  );
}
