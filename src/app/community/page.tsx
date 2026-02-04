// src/app/community/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import ConsumerShell from "@/app/components/ConsumerShell";
import Button from "@/components/ui/Button";
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

export default function CommunityPage() {
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CommunityPost[]>([]);

  // modal
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null);

  async function load() {
    if (!estateId) return;

    setLoading(true);
    setErr(null);
    try {
      const posts = await communityService.listByEstate(estateId);
      setItems(posts || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load community");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!estateId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  return (
    <ConsumerShell
      title="Community"
      subtitle="Estate broadcasts • announcements • live updates"
    >
      {/* Header actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-white/40">
          {estateId ? `Estate: ${estateId}` : "No estate linked"}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={load} disabled={!estateId || loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {!estateId ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No estate linked yet. Join/choose an estate to view broadcasts.
        </div>
      ) : loading && items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading community…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No community posts yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPost(p)}
              className="w-full text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/5 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {p.title || "Announcement"}
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {when((p as any).created_at)}{" "}
                    {(p as any).status ? `• ${(p as any).status}` : ""}
                  </div>

                  {/* Preview */}
                  {(p as any).message || (p as any).body ? (
                    <div className="text-sm text-white/70 mt-2 line-clamp-2">
                      {(p as any).message || (p as any).body}
                    </div>
                  ) : null}
                </div>

                <div className="text-xs text-white/40 shrink-0">Open →</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Post modal */}
      {openPost && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpenPost(null)}
          />

          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {openPost.title || "Announcement"}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      {when((openPost as any).created_at)}{" "}
                      {(openPost as any).status ? `• ${(openPost as any).status}` : ""}
                    </div>
                  </div>

                  <button
                    className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setOpenPost(null)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 text-sm text-white/80 whitespace-pre-wrap">
                  {(openPost as any).message ||
                    (openPost as any).body ||
                    "No details provided."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
