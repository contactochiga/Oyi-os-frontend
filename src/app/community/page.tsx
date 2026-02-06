"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import ConsumerShell from "@/app/components/ConsumerShell";
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
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<CommunityPost[]>([]);
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    if (!estateId) return;

    setLoading(true);
    setErr(null);
    try {
      const list = await communityService.listByEstate(String(estateId));
      setItems(list || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load community");
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

  async function createPost() {
    if (!title.trim()) return setErr("Title is required.");
    if (!estateId) return setErr("No estate linked.");

    setPosting(true);
    setErr(null);
    try {
      const res: any = await communityService.createPost({
        title: title.trim(),
        body: body.trim() ? body.trim() : null,
        estateId: String(estateId),
      });

      if (res?.error) {
        setErr(String(res.error));
        return;
      }

      setComposerOpen(false);
      setTitle("");
      setBody("");

      // Optimistic insert
      setItems((prev) => [res as CommunityPost, ...prev]);
    } catch (e: any) {
      setErr(e?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  }

  function openComposer() {
    if (!estateId) {
      setErr("No estate linked yet. Join/choose an estate to post.");
      return;
    }
    setErr(null);
    setComposerOpen(true);
  }

  return (
    <ConsumerShell
      title="Community"
      subtitle="Estate broadcasts • announcements • live updates"
    >
      {/* Top row: context + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs text-white/40">
            {estateId ? "Estate linked" : "No estate linked"}
          </div>

          {estateId && (
            <div className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60 truncate">
              {String(estateId)}
            </div>
          )}
        </div>

        <button
          onClick={load}
          disabled={!estateId || loading}
          className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Composer card (replaces +Post button) */}
      <div className="mt-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <button
            type="button"
            onClick={openComposer}
            disabled={!estateId}
            className="w-full text-left rounded-xl bg-black/20 hover:bg-black/30 transition px-4 py-3 border border-white/10 disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-white/70">Share an update…</div>
                <div className="text-[11px] text-white/35 mt-1">
                  Announcements, quick updates, estate info
                </div>
              </div>

              <div className="shrink-0">
                <div className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm">
                  Post
                </div>
              </div>
            </div>
          </button>

          <div className="mt-2 flex items-center justify-between text-[11px] text-white/40 px-1">
            <span>
              {items.length ? `${items.length} updates` : "No updates yet"}
            </span>
            <span className="text-white/30">
              Tap to write
            </span>
          </div>
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
          {items.map((p) => {
            const preview = p.body || "";
            return (
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
                      {when(p.created_at)} {p.status ? `• ${p.status}` : ""}
                    </div>

                    {preview ? (
                      <div className="text-sm text-white/70 mt-2 line-clamp-2">
                        {preview}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-xs text-white/40 shrink-0">Open →</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* POST VIEW MODAL */}
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
                      {when(openPost.created_at)}{" "}
                      {openPost.status ? `• ${openPost.status}` : ""}
                    </div>
                  </div>

                  <button
                    className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setOpenPost(null)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 text-sm text-white/80 whitespace-pre-wrap">
                  {openPost.body || "No details provided."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POST MODAL */}
      {composerOpen && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !posting && setComposerOpen(false)}
          />

          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      New post
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Broadcast to your estate community
                    </div>
                  </div>

                  <button
                    className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => !posting && setComposerOpen(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title (required)"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
                  />

                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Message (optional)"
                    rows={5}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none resize-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => setComposerOpen(false)}
                      disabled={posting}
                      className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
                      type="button"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={createPost}
                      disabled={posting || !title.trim()}
                      className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-semibold disabled:opacity-50"
                      type="button"
                    >
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>

                  <div className="text-[11px] text-white/40">
                    Route: <span className="text-white/60">POST /community/post</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
