// src/app/community/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import ConsumerShell from "@/app/components/ConsumerShell";
import {
  communityService,
  type CommunityComment,
  type CommunityPost,
} from "@/services/communityService";

// Icons (same style you referenced)
import {
  MessageSquare,
  Bell,
  Calendar,
  Send,
  ThumbsUp,
  MessageCircle,
  AlertCircle,
} from "lucide-react";

// -------------------------------
// helpers
// -------------------------------
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
  const r =
    p?.author_role || p?.author?.role || p?.role || p?.created_by_role || null;
  if (!r) return null;

  const t = String(r).toLowerCase();
  if (t.includes("admin") || t.includes("facility") || t.includes("manager"))
    return "Admin";
  return null;
}

function initialsFrom(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "R";
  const parts = clean.split(" ").filter(Boolean);
  const a = (parts[0]?.[0] || "R").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function clampCount(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

function pickCommentId(c: any) {
  return String(c?.id ?? c?.comment_id ?? "");
}

function pickCommentAuthor(c: any) {
  return (
    c?.author_name ||
    c?.author?.name ||
    c?.author?.full_name ||
    c?.user?.name ||
    c?.user_name ||
    c?.created_by ||
    "Resident"
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PostAttachment = {
  id: string;
  type: "image" | "video";
  url: string;
  name?: string;
};

type ParsedPostBody = {
  text: string;
  attachments: PostAttachment[];
  liveLink?: string | null;
};

const BODY_META_PREFIX = "__OYI_POST_V1__:";

function parsePostBody(raw: any): ParsedPostBody {
  const body = String(raw ?? "");
  if (!body.startsWith(BODY_META_PREFIX)) {
    return { text: body, attachments: [], liveLink: null };
  }

  try {
    const json = JSON.parse(body.slice(BODY_META_PREFIX.length));
    const text = String(json?.text ?? "");
    const attachments = Array.isArray(json?.attachments)
      ? json.attachments
          .map((a: any, idx: number) => ({
            id: String(a?.id ?? `${idx}`),
            type: a?.type === "video" ? "video" : "image",
            url: String(a?.url ?? ""),
            name: a?.name ? String(a.name) : undefined,
          }))
          .filter((a: PostAttachment) => !!a.url)
      : [];
    const liveLink = json?.liveLink ? String(json.liveLink) : null;
    return { text, attachments, liveLink };
  } catch {
    return { text: body, attachments: [], liveLink: null };
  }
}

function buildPostBody(text: string, attachments: PostAttachment[], liveLink?: string | null) {
  return (
    BODY_META_PREFIX +
    JSON.stringify({
      text,
      attachments: attachments.map((a) => ({
        id: a.id,
        type: a.type,
        url: a.url,
        name: a.name ?? null,
      })),
      liveLink: liveLink ? String(liveLink).trim() : null,
    })
  );
}

// -------------------------------
// Tiny local UI wrappers (so we don’t change your app theme or deps)
// -------------------------------
function Card({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("p-4 pb-3", className)}>{children}</div>;
}

function CardContent({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("p-4 pt-0", className)}>{children}</div>;
}

function BadgePill({
  children,
  variant = "outline",
  className,
}: React.PropsWithChildren<{
  variant?: "outline" | "default" | "secondary" | "destructive";
  className?: string;
}>) {
  const styles =
    variant === "destructive"
      ? "bg-red-500/15 text-red-200 border-red-500/25"
      : variant === "secondary"
      ? "bg-white/8 text-white/75 border-white/10"
      : variant === "default"
      ? "bg-white text-black border-white/20"
      : "bg-white/5 text-white/75 border-white/10";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border",
        styles,
        className
      )}
    >
      {children}
    </span>
  );
}

function TabPill({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  badge?: number;
}) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 h-10 rounded-xl border text-sm transition flex items-center justify-center gap-2",
        active
          ? "bg-white/10 text-white border-white/10"
          : "bg-transparent text-white/70 border-transparent hover:bg-white/5 hover:border-white/10"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
      {badge && badge > 0 ? (
        <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/25 text-red-200">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

// -------------------------------
// Page
// -------------------------------
export default function CommunityPage() {
  const { user } = useAuth();

  const estateId = useMemo(() => {
    return (
      (user as any)?.estate_id ??
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null)
    );
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CommunityPost[]>([]);

  // Composer
  const [postDraft, setPostDraft] = useState("");
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const [liveLink, setLiveLink] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [posting, setPosting] = useState(false);

  // Per-post interaction state
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [busyPost, setBusyPost] = useState<Record<string, boolean>>({});
  const [commentMap, setCommentMap] = useState<Record<string, CommunityComment[]>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [lastLiveAt, setLastLiveAt] = useState<number | null>(null);

  // Tabs
  const [tab, setTab] = useState<"feed" | "announcements">("feed");

  // Announcements derived from same posts (no new endpoints)
  const announcements = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    const isAnnouncement = (p: any) => {
      const badge = pickRoleBadge(p);
      const t = String(p?.title || "").toLowerCase();
      const admin = badge === "Admin";
      const keyword =
        t.includes("announcement") ||
        t.includes("notice") ||
        t.includes("maintenance") ||
        t.includes("update") ||
        t.includes("policy");
      return admin || keyword;
    };
    return arr.filter(isAnnouncement);
  }, [items]);

  const unreadCount = announcements.length;

  async function load() {
    if (!estateId) return;

    setLoading(true);
    setErr(null);
    try {
      const list = await communityService.listByEstate(String(estateId));
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);

      const nextLikes: Record<string, number> = {};
      const nextReplies: Record<string, number> = {};

      for (const p of arr as any[]) {
        const id = pickPostId(p);
        if (!id) continue;

        const l = p?.like_count ?? p?.likes ?? p?.reactions_count ?? 0;
        const r =
          p?.reply_count ??
          p?.replies_count ??
          p?.comment_count ??
          p?.comments ??
          0;

        nextLikes[id] = clampCount(l);
        nextReplies[id] = clampCount(r);
      }

      if (Object.keys(nextLikes).length)
        setLikeCounts((prev) => ({ ...prev, ...nextLikes }));
      if (Object.keys(nextReplies).length)
        setReplyCounts((prev) => ({ ...prev, ...nextReplies }));
      setLastLiveAt(Date.now());
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

  useEffect(() => {
    if (!estateId) return;
    const t = window.setInterval(() => {
      load();
      Object.keys(replyOpen).forEach((postId) => {
        if (replyOpen[postId]) loadComments(postId, true);
      });
    }, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId, replyOpen]);

  async function loadComments(postId: string, force = false) {
    if (!postId) return;
    if (!force && commentMap[postId]) return;
    setCommentLoading((p) => ({ ...p, [postId]: true }));
    try {
      const list = await communityService.listComments(postId);
      setCommentMap((p) => ({ ...p, [postId]: Array.isArray(list) ? list : [] }));
    } finally {
      setCommentLoading((p) => ({ ...p, [postId]: false }));
    }
  }

  async function toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function onPickMedia(kind: "image" | "video", files: FileList | null) {
    if (!files?.length) return;
    setMediaError(null);
    setMediaUploading(true);

    try {
      const selected = Array.from(files).slice(0, 3);
      const next: PostAttachment[] = [];
      for (const file of selected) {
        const max = kind === "image" ? 4 * 1024 * 1024 : 12 * 1024 * 1024;
        if (file.size > max) {
          setMediaError(
            `${file.name} is too large. Max ${kind === "image" ? "4MB" : "12MB"}`
          );
          continue;
        }
        const dataUrl = await toDataUrl(file);
        const uploaded: any = await communityService.uploadMedia({
          base64: dataUrl,
          mime: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
          filename: file.name,
          mediaType: kind,
        });
        if (uploaded?.error || !uploaded?.url) {
          setMediaError(String(uploaded?.error || `Failed to upload ${file.name}`));
          continue;
        }
        next.push({
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: kind,
          url: String(uploaded.url),
          name: file.name,
        });
      }
      if (next.length) {
        setAttachments((prev) => [...prev, ...next].slice(0, 6));
      }
    } catch {
      setMediaError("Failed to attach media");
    } finally {
      setMediaUploading(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function addLinkAsAttachment() {
    const url = linkDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setMediaError("Link must start with http:// or https://");
      return;
    }
    const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
    setAttachments((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: isVideo ? "video" : "image",
        url,
        name: "linked-media",
      },
    ]);
    setLinkDraft("");
    setMediaError(null);
  }

  async function createPost() {
    const content = postDraft.trim();
    if (!content && !attachments.length && !liveLink.trim()) {
      return setErr("Write something or attach media to share.");
    }
    if (!estateId) return setErr("No estate linked.");

    setPosting(true);
    setErr(null);
    try {
      const generatedTitle =
        content.length > 42 ? `${content.slice(0, 42).trimEnd()}…` : content;
      const res: any = await communityService.createPost({
        title: generatedTitle || "Update",
        body: buildPostBody(content, attachments, liveLink.trim() || null),
        estateId: String(estateId),
      });

      if (res?.error) {
        setErr(String(res.error));
        return;
      }

      setPostDraft("");
      setItems((prev) => [res as CommunityPost, ...prev]);

      const id = pickPostId(res);
      if (id) {
        setLikeCounts((p) => ({
          ...p,
          [id]: clampCount((res as any)?.like_count ?? 0),
        }));
        setReplyCounts((p) => ({
          ...p,
          [id]: clampCount((res as any)?.reply_count ?? 0),
        }));
      }
      await load();
      setAttachments([]);
      setLiveLink("");
      setLinkDraft("");
      setMediaError(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  }

  async function reactLike(post: CommunityPost) {
    const id = pickPostId(post);
    if (!id) return;

    if (busyPost[id]) return;
    setBusyPost((p) => ({ ...p, [id]: true }));

    const wasLiked = !!liked[id];
    const prevCount = likeCounts[id] ?? 0;

    setLiked((p) => ({ ...p, [id]: !wasLiked }));
    setLikeCounts((p) => ({
      ...p,
      [id]: Math.max(0, prevCount + (wasLiked ? -1 : 1)),
    }));

    try {
      const type = wasLiked ? "unlike" : "like";
      const res: any = await communityService.reactToPost(id, type);

      if (res?.error) {
        setLiked((p) => ({ ...p, [id]: wasLiked }));
        setLikeCounts((p) => ({ ...p, [id]: prevCount }));
      } else {
        const serverCount =
          res?.like_count ??
          res?.likes ??
          res?.reactions_count ??
          res?.data?.like_count;
        if (serverCount != null) {
          setLikeCounts((p) => ({ ...p, [id]: clampCount(serverCount) }));
        }
      }
    } catch {
      setLiked((p) => ({ ...p, [id]: wasLiked }));
      setLikeCounts((p) => ({ ...p, [id]: prevCount }));
    } finally {
      setBusyPost((p) => ({ ...p, [id]: false }));
    }
  }

  function toggleReplyBox(post: CommunityPost) {
    const id = pickPostId(post);
    if (!id) return;
    const next = !replyOpen[id];
    setReplyOpen((p) => ({ ...p, [id]: next }));
    if (next) loadComments(id);
  }

  async function sendReply(post: CommunityPost) {
    const id = pickPostId(post);
    if (!id) return;

    const text = (replyDraft[id] || "").trim();
    if (!text) return;

    if (busyPost[id]) return;
    setBusyPost((p) => ({ ...p, [id]: true }));

    const prev = replyCounts[id] ?? 0;

    setReplyCounts((p) => ({ ...p, [id]: prev + 1 }));
    setReplyDraft((p) => ({ ...p, [id]: "" }));
    const optimisticComment: CommunityComment = {
      id: `local-${Date.now()}`,
      post_id: id,
      user_id: String((user as any)?.id || ""),
      content: text,
      created_at: new Date().toISOString(),
    };
    setCommentMap((p) => ({ ...p, [id]: [optimisticComment, ...(p[id] || [])] }));

    try {
      const res: any = await communityService.createComment(id, { content: text });

      if (res?.error) {
        setReplyCounts((p) => ({ ...p, [id]: prev }));
        setReplyDraft((p) => ({ ...p, [id]: text }));
        setCommentMap((p) => ({
          ...p,
          [id]: (p[id] || []).filter((c) => !String(c.id).startsWith("local-")),
        }));
        return;
      }

      const serverCount = res?.reply_count ?? res?.replies_count ?? res?.comment_count;
      if (serverCount != null) {
        setReplyCounts((p) => ({ ...p, [id]: clampCount(serverCount) }));
      }
      await loadComments(id, true);
      await load();
    } catch {
      setReplyCounts((p) => ({ ...p, [id]: prev }));
      setReplyDraft((p) => ({ ...p, [id]: text }));
      setCommentMap((p) => ({
        ...p,
        [id]: (p[id] || []).filter((c) => !String(c.id).startsWith("local-")),
      }));
    } finally {
      setBusyPost((p) => ({ ...p, [id]: false }));
    }
  }

  const listForTab = tab === "announcements" ? announcements : items;

  return (
    <ConsumerShell title="Community" subtitle="Estate updates • announcements • resident posts">
      {/* Top row (kept) */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-[11px] text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live activity
          <span className="text-white/60">
            {lastLiveAt ? `• updated ${new Date(lastLiveAt).toLocaleTimeString()}` : ""}
          </span>
        </div>
        <button
          onClick={load}
          disabled={!estateId || loading}
          className="ml-auto px-3 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
          type="button"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          <TabPill
            active={tab === "feed"}
            onClick={() => setTab("feed")}
            icon={MessageSquare}
            label="Community Feed"
          />
          <TabPill
            active={tab === "announcements"}
            onClick={() => setTab("announcements")}
            icon={Bell}
            label="Announcements"
            badge={unreadCount}
          />
        </div>
      </div>

      {/* Composer (feed only) */}
      {tab === "feed" && (
        <div className="mt-4">
          <Card className="bg-white/5">
            <CardHeader>
              <div className="text-sm font-semibold text-white">Share with the community</div>
              <div className="text-[11px] text-white/40 mt-1">
                One post box. Just type and publish.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickMedia("image", e.target.files)}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => onPickMedia("video", e.target.files)}
              />

              <textarea
                value={postDraft}
                onChange={(e) => setPostDraft(e.target.value)}
                placeholder="What’s on your mind?"
                rows={4}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none resize-none"
                disabled={posting || !estateId}
              />

              {attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="relative rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                      {a.type === "video" ? (
                        <video src={a.url} className="h-28 w-full object-cover" controls />
                      ) : (
                        <img src={a.url} alt={a.name || "attachment"} className="h-28 w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="absolute top-1 right-1 rounded-md bg-black/70 text-white text-[10px] px-1.5 py-0.5"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={mediaUploading || posting}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
                >
                  {mediaUploading ? "Uploading…" : "Add Image"}
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={mediaUploading || posting}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
                >
                  Add Video
                </button>
                <button
                  type="button"
                  onClick={() => setLiveLink((v) => (v ? "" : "https://"))}
                  className={`rounded-xl border px-3 py-2 text-xs hover:bg-white/10 ${
                    liveLink ? "border-red-400/40 bg-red-500/15 text-red-100" : "border-white/10 bg-white/5 text-white/85"
                  }`}
                >
                  {liveLink ? "Live Enabled" : "Go Live"}
                </button>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
                  {attachments.length} media
                </div>
              </div>

              <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                <input
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="Paste image/video URL"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white outline-none"
                />
                <button
                  type="button"
                  onClick={addLinkAsAttachment}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 hover:bg-white/10"
                >
                  Add Link
                </button>
              </div>

              {liveLink ? (
                <input
                  value={liveLink}
                  onChange={(e) => setLiveLink(e.target.value)}
                  placeholder="Live stream URL"
                  className="w-full rounded-xl bg-white/5 border border-red-400/30 px-3 py-2 text-xs text-white outline-none"
                />
              ) : null}

              {mediaError ? <div className="text-xs text-red-300">{mediaError}</div> : null}

              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-white/45">Attach images, videos, or a live link.</div>
                <button
                  onClick={createPost}
                  disabled={posting || mediaUploading || (!postDraft.trim() && !attachments.length && !liveLink.trim()) || !estateId}
                  className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  type="button"
                >
                  <Send className="h-4 w-4" />
                  {posting ? "Posting..." : "Post"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
      ) : listForTab.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          {tab === "announcements" ? "No announcements yet." : "No community posts yet."}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {listForTab.map((p: any) => {
            const id = pickPostId(p);
            const author = pickAuthor(p);
            const badge = pickRoleBadge(p);

            const likeCount = likeCounts[id] ?? clampCount(p?.like_count ?? p?.likes ?? 0);
            const replyCount = replyCounts[id] ?? clampCount(p?.reply_count ?? p?.replies_count ?? 0);

            const isLiked = !!liked[id];
            const replyIsOpen = !!replyOpen[id];
            const isBusy = !!busyPost[id];
            const comments = commentMap[id] || [];
            const loadingComments = !!commentLoading[id];
            const parsed = parsePostBody(p?.body ?? p?.content ?? "");

            const type: "announcement" | "discussion" | "event" =
              tab === "announcements" ? "announcement" : badge === "Admin" ? "announcement" : "discussion";

            return (
              <Card key={id || String(p?.created_at) || Math.random().toString(36)}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-2xl border border-white/10 flex items-center justify-center font-semibold text-[12px]",
                          badge ? "bg-white/10 text-white" : "bg-white/5 text-white/80"
                        )}
                      >
                        {initialsFrom(author)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-white truncate">{author}</div>
                          {badge ? (
                            <BadgePill variant="outline" className="text-[10px]">
                              {badge}
                            </BadgePill>
                          ) : null}
                        </div>
                        <div className="text-xs text-white/45">{when(p.created_at)}</div>
                      </div>
                    </div>

                    <BadgePill
                      variant={type === "announcement" ? "default" : type === "event" ? "secondary" : "outline"}
                    >
                      {type === "announcement" ? <Bell className="h-3 w-3" /> : null}
                      {type === "event" ? <Calendar className="h-3 w-3" /> : null}
                      {type === "discussion" ? <MessageCircle className="h-3 w-3" /> : null}
                      <span className="capitalize">{type}</span>
                    </BadgePill>
                  </div>

                  <div className="mt-3 text-[13px] font-semibold text-white">
                    {p.title || "Update"}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {parsed.text ? (
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      {parsed.text}
                    </p>
                  ) : null}

                  {parsed.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsed.attachments.map((a) => (
                        <div key={a.id} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                          {a.type === "video" ? (
                            <video src={a.url} controls className="w-full max-h-72 bg-black" />
                          ) : (
                            <img src={a.url} alt={a.name || "post media"} className="w-full max-h-72 object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {parsed.liveLink ? (
                    <a
                      href={parsed.liveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                    >
                      Live session link
                    </a>
                  ) : null}

                  <div className="flex items-center gap-4 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => reactLike(p)}
                      disabled={isBusy}
                      className={cn(
                        "inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition disabled:opacity-50",
                        isLiked
                          ? "bg-cyan-400/20 text-cyan-100 border-cyan-300/40"
                          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {isLiked ? "Liked" : "Like"} • {likeCount}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleReplyBox(p)}
                      className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Comment • {replyCount}
                    </button>
                  </div>

                  {replyIsOpen && tab === "feed" && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      {loadingComments ? (
                        <div className="mb-2 text-xs text-white/50">Loading comments…</div>
                      ) : comments.length > 0 ? (
                        <div className="mb-3 space-y-2 max-h-48 overflow-auto pr-1">
                          {comments.map((c) => (
                            <div key={pickCommentId(c)} className="rounded-xl bg-black/25 border border-white/10 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-white/85 truncate">
                                  {pickCommentAuthor(c)}
                                </span>
                                <span className="text-[10px] text-white/45">
                                  {when(c?.created_at)}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-white/75 whitespace-pre-wrap">
                                {String(c?.content || "")}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mb-2 text-xs text-white/45">No comments yet. Be the first.</div>
                      )}

                      <textarea
                        value={replyDraft[id] ?? ""}
                        onChange={(e) =>
                          setReplyDraft((prev) => ({ ...prev, [id]: e.target.value }))
                        }
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
                          className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          <Send className="h-4 w-4" />
                          {isBusy ? "Sending…" : "Send"}
                        </button>
                      </div>
                    </div>
                  )}

                  {tab === "announcements" ? (
                    <div className="text-[11px] text-white/45 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      Announcements are identified from admin posts and priority keywords.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ConsumerShell>
  );
}
