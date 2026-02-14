// src/app/community/page.tsx
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

function pickPostId(p: any) {
  return String(p?.id ?? p?.post_id ?? "");
}

function pickAuthor(p: any) {
  return (
    p?.author_name ||
    p?.author?.full_name ||
    p?.author?.name ||
    p?.author?.email ||
    p?.created_by_email ||
    p?.created_by ||
    "Resident"
  );
}

function pickRoleBadge(p: any) {
  const r = p?.author_role || p?.author?.role || p?.role || p?.created_by_role || null;
  if (!r) return null;

  const t = String(r).toLowerCase();
  if (t.includes("admin") || t.includes("facility") || t.includes("manager")) return "Admin";
  return null;
}

function clampCount(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

export default function CommunityPage() {
  const { user } = useAuth();

  const estateId = useMemo(() => {
    return (
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null)
    );
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<CommunityPost[]>([]);

  // Composer inline
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Per-post interaction state
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [busyPost, setBusyPost] = useState<string | null>(null);

  async function load() {
    if (!estateId) return;

    setLoading(true);
    setErr(null);
    try {
      const list = await communityService.listByEstate(String(estateId));
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);

      // seed counts if backend sends them
      const nextLikes: Record<string, number> = {};
      const nextReplies: Record<string, number> = {};

      for (const p of arr as any[]) {
        const id = pickPostId(p);
        if (!id) continue;

        const l = p?.like_count ?? p?.likes ?? p?.reactions_count ?? 0;
        const r = p?.reply_count ?? p?.replies_count ?? p?.comment_count ?? p?.comments ?? 0;

        nextLikes[id] = clampCount(l);
        nextReplies[id] = clampCount(r);
      }

      if (Object.keys(nextLikes).length) setLikeCounts((prev) => ({ ...prev, ...nextLikes }));
      if (Object.keys(nextReplies).length) setReplyCounts((prev) => ({ ...prev, ...nextReplies }));
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

  function openComposer() {
    if (!estateId) {
      setErr("No estate linked yet. Join/choose an estate to post.");
      return;
    }
    setErr(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    if (posting) return;
    setComposerOpen(false);
    setTitle("");
    setBody("");
  }

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

      closeComposer();

      // optimistic insert
      setItems((prev) => [res as CommunityPost, ...prev]);

      const id = pickPostId(res);
      if (id) {
        setLikeCounts((p) => ({ ...p, [id]: clampCount((res as any)?.like_count ?? 0) }));
        setReplyCounts((p) => ({ ...p, [id]: clampCount((res as any)?.reply_count ?? 0) }));
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  }

  // ✅ WIRED: POST /community/post/:postId/react
  async function reactLike(post: CommunityPost) {
    const id = pickPostId(post);
    if (!id) return;

    if (busyPost) return;
    setBusyPost(id);

    const wasLiked = !!liked[id];
    const prevCount = likeCounts[id] ?? 0;

    // optimistic UI
    setLiked((p) => ({ ...p, [id]: !wasLiked }));
    setLikeCounts((p) => ({ ...p, [id]: Math.max(0, prevCount + (wasLiked ? -1 : 1)) }));

    try {
      // if your backend supports unlike, send "unlike". If not, it can still treat "like" as toggle.
      const type = wasLiked ? "unlike" : "like";
      const res: any = await communityService.reactToPost(id, type);

      if (res?.error) {
        // rollback
        setLiked((p) => ({ ...p, [id]: wasLiked }));
        setLikeCounts((p) => ({ ...p, [id]: prevCount }));
      } else {
        // if backend returns counts, sync
        const serverCount =
          res?.like_count ?? res?.likes ?? res?.reactions_count ?? res?.data?.like_count;
        if (serverCount != null) {
          setLikeCounts((p) => ({ ...p, [id]: clampCount(serverCount) }));
        }
      }
    } catch {
      // rollback
      setLiked((p) => ({ ...p, [id]: wasLiked }));
      setLikeCounts((p) => ({ ...p, [id]: prevCount }));
    } finally {
      setBusyPost(null);
    }
  }

  function toggleReplyBox(post: CommunityPost) {
    const id = pickPostId(post);
    if (!id) return;
    setReplyOpen((p) => ({ ...p, [id]: !p[id] }));
  }

  // ✅ WIRED: POST /community/post/:postId/comment
  async function sendReply(post: CommunityPost) {
    const id = pickPostId(post);
    if (!id) return;

    const text = (replyDraft[id] || "").trim();
    if (!text) return;

    if (busyPost) return;
    setBusyPost(id);

    const prev = replyCounts[id] ?? 0;

    // optimistic
    setReplyCounts((p) => ({ ...p, [id]: prev + 1 }));
    setReplyDraft((p) => ({ ...p, [id]: "" }));

    try {
      const res: any = await communityService.createComment(id, { content: text });

      if (res?.error) {
        // rollback
        setReplyCounts((p) => ({ ...p, [id]: prev }));
        setReplyDraft((p) => ({ ...p, [id]: text }));
        return;
      }

      // if backend returns updated counts
      const serverCount = res?.reply_count ?? res?.replies_count ?? res?.comment_count;
      if (serverCount != null) {
        setReplyCounts((p) => ({ ...p, [id]: clampCount(serverCount) }));
      }
    } catch {
      // rollback
      setReplyCounts((p) => ({ ...p, [id]: prev }));
      setReplyDraft((p) => ({ ...p, [id]: text }));
    } finally {
      setBusyPost(null);
    }
  }

  return (
    <ConsumerShell title="Community" subtitle="Estate updates • announcements • resident posts">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs text-white/45">{estateId ? "Estate linked" : "No estate linked"}</div>

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
          type="button"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Composer inline */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        {!composerOpen ? (
          <button
            type="button"
            onClick={openComposer}
            disabled={!estateId}
            className="w-full text-left rounded-2xl px-4 py-3 border border-white/10 bg-black/20 hover:bg-black/30 transition disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-white/75">Share an update…</div>
                <div className="text-[11px] text-white/35 mt-1">Announcements, quick updates, facility info</div>
              </div>

              <div className="shrink-0">
                <div className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold">Post</div>
              </div>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55 mb-2">New post</div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (required)"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
              disabled={posting}
            />

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your update…"
              rows={4}
              className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none resize-none"
              disabled={posting}
            />

            <div className="mt-3 flex gap-2">
              <button
                onClick={closeComposer}
                disabled={posting}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={createPost}
                disabled={posting || !title.trim()}
                className="flex-1 py-3 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
                type="button"
              >
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/40 px-1">
          <span>{items.length ? `${items.length} updates` : "No updates yet"}</span>
          <span className="text-white/30">Estate feed</span>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {!estateId ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No estate linked yet. Join/choose an estate to view updates.
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
          {items.map((p: any) => {
            const id = pickPostId(p);
            const author = pickAuthor(p);
            const badge = pickRoleBadge(p);

            const likeCount = likeCounts[id] ?? clampCount(p?.like_count ?? p?.likes ?? 0);
            const replyCount = replyCounts[id] ?? clampCount(p?.reply_count ?? p?.replies_count ?? 0);

            const isLiked = !!liked[id];
            const replyIsOpen = !!replyOpen[id];
            const isBusy = busyPost === id;

            return (
              <div
                key={id || String(p?.created_at) || Math.random().toString(36)}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/5 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[13px] font-semibold text-white truncate">{p.title || "Update"}</div>
                      {badge ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70">
                          {badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-white/45 mt-1 truncate">
                      <span className="text-white/70">{author}</span>
                      <span className="text-white/35"> • </span>
                      {when(p.created_at)}
                      {p.status ? (
                        <>
                          <span className="text-white/35"> • </span>
                          <span className="text-white/55">{String(p.status)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-[11px] text-white/35 shrink-0">
                    {likeCount ? `${likeCount} react` : "0 react"}
                    {" • "}
                    {replyCount ? `${replyCount} replies` : "0 replies"}
                  </div>
                </div>

                {p.body ? (
                  <div className="mt-3 text-sm text-white/80 whitespace-pre-wrap">{String(p.body)}</div>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => reactLike(p)}
                    disabled={isBusy}
                    className={`px-3 py-2 rounded-xl text-sm border transition disabled:opacity-50 ${
                      isLiked
                        ? "bg-white text-black border-white/20"
                        : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {isLiked ? "Reacted" : "React"}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleReplyBox(p)}
                    className="px-3 py-2 rounded-xl text-sm border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
                  >
                    Reply
                  </button>
                </div>

                {replyIsOpen && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <textarea
                      value={replyDraft[id] ?? ""}
                      onChange={(e) => setReplyDraft((prev) => ({ ...prev, [id]: e.target.value }))}
                      placeholder="Write a reply…"
                      rows={3}
                      className="w-full rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white outline-none resize-none"
                      disabled={isBusy}
                    />

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyOpen((prev) => ({ ...prev, [id]: false }))}
                        className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm"
                        disabled={isBusy}
                      >
                        Close
                      </button>

                      <button
                        type="button"
                        onClick={() => sendReply(p)}
                        disabled={isBusy || !(replyDraft[id] || "").trim()}
                        className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
                      >
                        {isBusy ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ConsumerShell>
  );
}
