"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  RadioTower,
  Send,
  ShieldCheck,
  ThumbsUp,
  Users,
  Video,
  Home,
  Leaf,
} from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import BottomNav from "@/app/components/BottomNav";
import LiveBroadcastComposer from "@/app/components/community/LiveBroadcastComposer";
import LiveSessionPlayer from "@/app/components/community/LiveSessionPlayer";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { communityService, type CommunityComment, type CommunityPost } from "@/services/communityService";
import { useNotificationStore } from "@/store/useNotificationStore";

const BODY_META_PREFIX = "__OYI_POST_V1__:";
type TabKey = "updates" | "notices" | "amenities" | "residents";
type PostAttachment = { id: string; type: "image" | "video"; url: string; name?: string | null };

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "updates", label: "Updates", icon: Bell },
  { key: "notices", label: "Notices", icon: ShieldCheck },
  { key: "amenities", label: "Amenities", icon: Home },
  { key: "residents", label: "Residents", icon: Users },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function when(value?: string | null) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function pickPostId(post: any) {
  return String(post?.id || post?.post_id || "");
}

function normalizeText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseBody(post: any) {
  const raw = String(post?.body ?? post?.content ?? "");
  if (!raw.startsWith(BODY_META_PREFIX)) return { text: raw, attachments: mediaFromPost(post), liveLink: post?.live_link || null };
  try {
    const json = JSON.parse(raw.slice(BODY_META_PREFIX.length));
    return {
      text: String(json?.text || ""),
      attachments: mediaFromPost({ media: json?.attachments }),
      liveLink: json?.liveLink ? String(json.liveLink) : post?.live_link || null,
    };
  } catch {
    return { text: raw, attachments: mediaFromPost(post), liveLink: post?.live_link || null };
  }
}

function mediaFromPost(post: any): PostAttachment[] {
  const media = Array.isArray(post?.media) ? post.media : [];
  return media
    .map((item: any, index: number) => ({
      id: String(item?.id || `${index}`),
      type: item?.type === "video" || item?.mediaType === "video" ? "video" : "image",
      url: String(item?.url || ""),
      name: item?.name ? String(item.name) : null,
    }))
    .filter((item: PostAttachment) => Boolean(item.url));
}

function categoryFor(post: any): TabKey {
  const raw = String(post?.category || post?.post_type || "").toLowerCase();
  const title = String(post?.title || "").toLowerCase();
  const body = String(post?.body || post?.content || "").toLowerCase();
  const text = `${raw} ${title} ${body}`;
  if (/amenity|booking|gym|pool|club|parking|market/.test(text)) return "amenities";
  if (/notice|announcement|maintenance|security|policy|water|power|alert|gate/.test(text)) return "notices";
  if (/resident|neighbor|neighbour|family|discussion|group/.test(text)) return "residents";
  return "updates";
}

function toneFor(tab: TabKey) {
  if (tab === "notices") return { Icon: ShieldCheck, ring: "text-emerald-200 border-emerald-300/15 bg-emerald-400/10 shadow-[0_0_14px_rgba(52,211,153,0.12)]", chip: "text-emerald-200 bg-emerald-400/10 border-emerald-300/15" };
  if (tab === "amenities") return { Icon: Leaf, ring: "text-cyan-200 border-cyan-300/15 bg-cyan-400/10 shadow-[0_0_14px_rgba(34,211,238,0.12)]", chip: "text-cyan-200 bg-cyan-400/10 border-cyan-300/15" };
  if (tab === "residents") return { Icon: Users, ring: "text-violet-200 border-violet-300/15 bg-violet-400/10 shadow-[0_0_14px_rgba(167,139,250,0.12)]", chip: "text-violet-200 bg-violet-400/10 border-violet-300/15" };
  return { Icon: Bell, ring: "text-sky-200 border-sky-300/15 bg-sky-400/10 shadow-[0_0_14px_rgba(56,189,248,0.12)]", chip: "text-sky-200 bg-sky-400/10 border-sky-300/15" };
}

function categoryLabelFor(post: any, tab: TabKey) {
  const raw = String(post?.category || post?.status || "").trim().toLowerCase();
  const text = [raw, post?.title || "", post?.body || post?.content || ""].join(" ").toLowerCase();
  if (/maintenance|repair|water|power|utility/.test(text)) return "Maintenance";
  if (/security|gate|access|alert|incident/.test(text)) return "Security";
  if (/amenity|booking|gym|pool|club|parking/.test(text)) return "Amenity";
  if (/resident|neighbor|neighbour|discussion|group/.test(text)) return "Resident";
  if (/notice|announcement|policy|update/.test(text) || tab === "notices") return "Notice";
  return "General";
}

function authorName(post: any, me: any) {
  const explicit = normalizeText(post?.author_name || post?.author?.full_name || post?.author?.name || post?.created_by_name);
  if (explicit) return explicit;
  if (String(post?.author_id || post?.user_id || "") === String(me?.id || "")) return "You";
  return "Resident";
}

function canUseCommunityWrite(user: any) {
  const scopes = [...(user?.permission_scopes || []), ...(user?.permissions || [])].map(String);
  const role = String(user?.role || "resident").toLowerCase();
  return scopes.includes("community.write") || !["guest", "viewer"].includes(role);
}

function canUseCommunityBroadcast(user: any) {
  const scopes = [...(user?.permission_scopes || []), ...(user?.permissions || [])].map(String);
  const role = String(user?.role || "resident").toLowerCase();
  return scopes.includes("community.broadcast") || ["admin", "estate_admin", "facility_manager", "manager", "operator", "owner", "super_admin"].includes(role);
}

function createCategoryForTab(tab: TabKey) {
  if (tab === "notices") return "notice";
  if (tab === "amenities") return "amenity";
  if (tab === "residents") return "resident";
  return "resident";
}

async function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read media"));
    reader.readAsDataURL(file);
  });
}

function CommunityHeader({ unread }: { unread: number }) {
  return (
    <div className="flex items-start justify-between gap-3 pt-0">
      <div className="flex items-start gap-2.5">
        <HamburgerMenu />
        <div>
          <h1 className="text-[29px] font-semibold leading-none tracking-[-0.05em] text-white">Community</h1>
          <p className="mt-2 text-[13px] leading-5 text-white/52">Estate updates and resident notices.</p>
        </div>
      </div>
      <div className="relative">
        <MessagesInboxButton />
        {unread > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.85)]" /> : null}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const { user } = useAuth();
  const { estate, home } = useActiveContext();
  const notificationItems = useNotificationStore((state) => state.items);
  const estateId = useMemo(() => String((user as any)?.estate_id || estate?.id || (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") || "" : "")), [user, estate?.id]);

  const [tab, setTab] = useState<TabKey>("updates");
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [liveComposerOpen, setLiveComposerOpen] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busyPost, setBusyPost] = useState<Record<string, boolean>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const canPost = canUseCommunityWrite(user);
  const canBroadcast = canUseCommunityBroadcast(user);
  const unread = useMemo(() => notificationItems.filter((item: any) => String(item?.status || "") !== "read" && /community|announcement|notice/.test(`${item?.type || ""} ${item?.title || ""} ${item?.message || ""}`.toLowerCase())).length, [notificationItems]);

  async function load(silent = false) {
    if (!estateId) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setErr(null);
    try {
      const rows = await communityService.listByEstate(estateId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      setErr(error?.message || "Failed to load community updates");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [estateId]);
  useEffect(() => {
    if (!estateId) return;
    const timer = window.setInterval(() => void load(true), 20000);
    return () => window.clearInterval(timer);
  }, [estateId]);

  const decorated = useMemo(() => items.map((post: any) => ({ post, tab: categoryFor(post), parsed: parseBody(post), author: authorName(post, user), id: pickPostId(post) })), [items, user]);
  const filtered = decorated.filter((item) => item.tab === tab || (tab === "updates" && item.tab === "updates"));
  const pinned = decorated.find((item) => Boolean((item.post as any)?.is_pinned) || String((item.post as any)?.status || "").includes("pinned"));
  const counts = TABS.reduce<Record<TabKey, number>>((acc, item) => { acc[item.key] = decorated.filter((post) => post.tab === item.key).length; return acc; }, { updates: 0, notices: 0, amenities: 0, residents: 0 });

  async function pickMedia(kind: "image" | "video", files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    try {
      const next: PostAttachment[] = [];
      for (const file of Array.from(files).slice(0, 3)) {
        const dataUrl = await toDataUrl(file);
        const res: any = await communityService.uploadMedia({ base64: dataUrl, mime: file.type, filename: file.name, mediaType: kind });
        if (res?.error || !res?.url) throw new Error(res?.error || "Media upload failed");
        next.push({ id: `${Date.now()}-${file.name}`, type: kind, url: String(res.url), name: file.name });
      }
      setAttachments((prev) => [...prev, ...next].slice(0, 4));
    } catch (error: any) {
      setErr(error?.message || "Media upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function createPost() {
    const content = draft.trim();
    if (!content && !attachments.length) return setErr("Write a short update or attach media.");
    if (!estateId) return setErr("No estate linked yet.");
    setPosting(true);
    setErr(null);
    try {
      const title = content ? content.slice(0, 72) : "Community media update";
      const res: any = await communityService.createPost({ estateId, title, content, media: attachments, category: createCategoryForTab(tab) });
      if (res?.error) throw new Error(res.error);
      setItems((prev) => [res as CommunityPost, ...prev]);
      setDraft("");
      setAttachments([]);
      setComposerOpen(false);
      await load(true);
    } catch (error: any) {
      setErr(error?.message || "Failed to post update");
    } finally {
      setPosting(false);
    }
  }

  async function toggleComments(postId: string) {
    const next = openPost === postId ? null : postId;
    setOpenPost(next);
    if (!next || comments[next]) return;
    setBusyPost((prev) => ({ ...prev, [next]: true }));
    try {
      const rows = await communityService.listComments(next);
      setComments((prev) => ({ ...prev, [next]: Array.isArray(rows) ? rows : [] }));
      void communityService.markPostRead(next);
    } finally {
      setBusyPost((prev) => ({ ...prev, [next]: false }));
    }
  }

  async function likePost(postId: string) {
    if (!postId || busyPost[postId]) return;
    setBusyPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await communityService.reactToPost(postId, "like");
      await load(true);
    } finally {
      setBusyPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function sendComment(postId: string) {
    const content = String(commentDrafts[postId] || "").trim();
    if (!postId || !content) return;
    setBusyPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const res: any = await communityService.createComment(postId, { content });
      if (res?.error) throw new Error(res.error);
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), res] }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await load(true);
    } catch (error: any) {
      setErr(error?.message || "Failed to send comment");
    } finally {
      setBusyPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  const estateName = String(estate?.name || (home as any)?.estate_name || "Your estate");

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="relative z-10 h-full overflow-y-auto px-4 pb-[calc(132px+var(--sab))] pt-[calc(14px+var(--sat))]">
          <div className="mx-auto w-full max-w-[760px] space-y-4">
            <CommunityHeader unread={unread} />

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button key={key} type="button" onClick={() => setTab(key)} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition", active ? "border-blue-400/70 bg-blue-500/12 text-sky-200 shadow-[0_0_16px_rgba(0,122,255,0.16)]" : "border-white/[0.075] bg-white/[0.025] text-white/64") }>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    {counts[key] ? <span className="text-[10px] text-white/36">{counts[key]}</span> : null}
                  </button>
                );
              })}
            </div>

            <LiveBroadcastComposer open={liveComposerOpen} estateId={estateId || null} draft={draft} onClose={() => setLiveComposerOpen(false)} onStarted={(post) => { setItems((prev) => [post, ...prev]); setLiveComposerOpen(false); void load(true); }} onStopped={() => void load(true)} />

            {pinned ? (
              <CommunityCard data={pinned} featured onToggleComments={toggleComments} onLike={likePost} open={openPost === pinned.id} comments={comments[pinned.id] || []} commentDraft={commentDrafts[pinned.id] || ""} onCommentDraft={(value) => setCommentDrafts((prev) => ({ ...prev, [pinned.id]: value }))} onSendComment={() => sendComment(pinned.id)} busy={!!busyPost[pinned.id]} userId={String((user as any)?.id || "")} />
            ) : null}

            {canPost ? (
              <section className="rounded-[21px] border border-white/[0.065] bg-white/[0.03] p-2.5 shadow-[0_14px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                {!composerOpen ? (
                  <button type="button" onClick={() => setComposerOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[17px] border border-sky-300/10 bg-sky-400/[0.045] px-3.5 py-2.5 text-[13px] font-semibold text-sky-200 transition active:scale-[0.99]">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Share with estate
                  </button>
                ) : (
                  <div className="space-y-3">
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Share a quiet update with ${estateName}...`} rows={2} className="w-full resize-none rounded-[18px] border border-white/[0.075] bg-black/25 px-3.5 py-2.5 text-[13px] leading-5 text-white outline-none placeholder:text-white/35 focus:border-sky-300/35" />
                    {attachments.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {attachments.map((item) => (
                          <div key={item.id} className="relative overflow-hidden rounded-[16px] border border-white/[0.08] bg-black/30">
                            {item.type === "video" ? <video src={item.url} className="h-20 w-full object-cover" muted playsInline /> : <img src={item.url} alt={item.name || "community media"} className="h-20 w-full object-cover" />}
                            <button type="button" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== item.id))} className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-white/80">Remove</button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void pickMedia("image", event.target.files)} />
                    <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(event) => void pickMedia("video", event.target.files)} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/72"><ImagePlus className="h-4 w-4" /></button>
                        <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploading} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/72"><Video className="h-4 w-4" /></button>
                        {canBroadcast ? <button type="button" onClick={() => setLiveComposerOpen(true)} className="grid h-9 w-9 place-items-center rounded-full border border-red-300/12 bg-red-400/10 text-red-100" aria-label="Start live broadcast"><RadioTower className="h-4 w-4" /></button> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { setComposerOpen(false); setDraft(""); setAttachments([]); }} className="rounded-full px-3 py-2 text-[12px] text-white/50">Cancel</button>
                        <button type="button" onClick={createPost} disabled={posting || uploading || (!draft.trim() && !attachments.length)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-50">
                          {posting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {err ? <div className="rounded-[16px] border border-red-300/15 bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-100">{err}</div> : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/42">{tab === "updates" ? "Estate Updates" : TABS.find((item) => item.key === tab)?.label}</div>
                <button type="button" onClick={() => void load()} className="text-[11px] font-medium text-sky-300/76">Refresh</button>
              </div>

              {!estateId ? (
                <EmptyState title="No estate linked yet." body="Join or select an estate to view community updates." />
              ) : loading ? (
                <div className="rounded-[20px] border border-white/[0.065] bg-white/[0.03] p-4 text-[12px] text-white/54">Loading community updates...</div>
              ) : filtered.length === 0 ? (
                <EmptyState title="No community updates yet." body="Estate notices will appear here." />
              ) : (
                <div className="space-y-3">
                  {filtered.map((data) => (
                    <CommunityCard key={data.id || `${data.post?.created_at}-${data.post?.title}`} data={data} onToggleComments={toggleComments} onLike={likePost} open={openPost === data.id} comments={comments[data.id] || []} commentDraft={commentDrafts[data.id] || ""} onCommentDraft={(value) => setCommentDrafts((prev) => ({ ...prev, [data.id]: value }))} onSendComment={() => sendComment(data.id)} busy={!!busyPost[data.id]} userId={String((user as any)?.id || "")} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.065] bg-white/[0.03] px-4 py-5 text-center shadow-[0_18px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-sky-300/15 bg-sky-400/10 text-sky-200"><Bell className="h-4 w-4" /></div>
      <div className="mt-2.5 text-[14px] font-semibold text-white">{title}</div>
      <div className="mt-1 text-[11px] leading-5 text-white/45">{body}</div>
    </div>
  );
}

function CommunityCard({ data, featured, open, comments, commentDraft, onCommentDraft, onToggleComments, onSendComment, onLike, busy, userId }: { data: { post: any; tab: TabKey; parsed: any; author: string; id: string }; featured?: boolean; open: boolean; comments: CommunityComment[]; commentDraft: string; onCommentDraft: (value: string) => void; onToggleComments: (postId: string) => void; onSendComment: () => void; onLike: (postId: string) => void; busy: boolean; userId: string }) {
  const { post, tab, parsed, author, id } = data;
  const tone = toneFor(tab);
  const Icon = tone.Icon;
  const title = normalizeText(post?.title || parsed.text || "Community update");
  const body = normalizeText(parsed.text || post?.body || post?.content || "");
  const likeCount = Number(post?.like_count ?? post?.likes ?? post?.reactions_count ?? 0);
  const commentCount = Number(post?.comment_count ?? post?.comments ?? post?.reply_count ?? comments.length ?? 0);
  const isInternalLive = String(parsed.liveLink || post?.live_link || "").startsWith("oyi-live://");
  const liveSession = post?.live_session || null;
  const isLive = isInternalLive && String(liveSession?.status || "").toLowerCase() !== "ended";

  return (
    <article className={cn("rounded-[21px] border bg-white/[0.03] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl", featured ? "border-sky-300/18" : "border-white/[0.075]") }>
      <div className="flex items-center gap-2.5">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", tone.ring)}><Icon className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14.5px] font-semibold tracking-[-0.025em] text-white">{title}</h2>
            {featured ? <span className="rounded-full border border-sky-300/16 bg-sky-400/10 px-1.5 py-0.5 text-[9px] text-sky-200">Pinned</span> : null}
          </div>
          {body && body !== title ? <p className="mt-0.5 line-clamp-1 text-[12px] leading-5 text-white/58">{body}</p> : null}
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-white/38"><span>{author}</span><span>•</span><span>{when(post?.created_at)}</span></div>
        </div>
        {parsed.attachments?.[0]?.url ? <img src={parsed.attachments[0].url} alt="community media" className="h-14 w-[72px] shrink-0 rounded-[13px] object-cover" /> : <MoreHorizontal className="h-4 w-4 shrink-0 text-white/32" />}
      </div>

      {parsed.attachments?.length > 1 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {parsed.attachments.slice(1, 5).map((item: PostAttachment) => item.type === "video" ? <video key={item.id} src={item.url} controls className="h-20 rounded-[13px] bg-black object-cover" /> : <img key={item.id} src={item.url} alt={item.name || "community media"} className="h-20 w-full rounded-[13px] object-cover" />)}
        </div>
      ) : null}

      {isInternalLive ? <div className="mt-3"><LiveSessionPlayer postId={id} userId={userId || null} userName={author} isLive={isLive} initialViewerCount={Number(liveSession?.viewer_count || 0)} hasGuest={Boolean(liveSession?.has_guest)} /></div> : null}

      <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.055] pt-2.5">
        <span className={cn("rounded-full border px-2 py-0.5 text-[9.5px] capitalize", tone.chip)}>{categoryLabelFor(post, tab)}</span>
        <div className="flex items-center gap-1.5 text-[11px] text-white/52">
          <button type="button" onClick={() => onLike(id)} disabled={busy || !id} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-white/[0.055]"><ThumbsUp className="h-3.5 w-3.5" />{likeCount}</button>
          <button type="button" onClick={() => onToggleComments(id)} disabled={!id} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-white/[0.055]"><MessageCircle className="h-3.5 w-3.5" />{commentCount}</button>
          <ChevronRight className={cn("h-4 w-4 transition", open && "rotate-90")} />
        </div>
      </div>

      {open ? (
        <div className="mt-2.5 rounded-[16px] border border-white/[0.07] bg-black/20 p-2.5">
          {comments.length ? <div className="mb-3 max-h-40 space-y-1.5 overflow-auto pr-1">{comments.map((comment: any) => <div key={String(comment.id)} className="rounded-[13px] bg-white/[0.03] px-2.5 py-2"><div className="text-[11px] font-medium text-white/76">{comment.author_name || "Resident"}</div><div className="mt-1 text-[11px] leading-5 text-white/56">{comment.content}</div></div>)}</div> : <div className="mb-3 text-[12px] text-white/40">No comments yet.</div>}
          <div className="flex items-center gap-2">
            <input value={commentDraft} onChange={(event) => onCommentDraft(event.target.value)} placeholder="Write a calm reply..." className="h-9 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 text-[12px] text-white outline-none placeholder:text-white/32" />
            <button type="button" onClick={onSendComment} disabled={busy || !commentDraft.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
