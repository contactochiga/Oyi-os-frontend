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
  Megaphone,
  AlertTriangle,
  Image as ImageIcon,
  HelpCircle,
  Building2,
  Wrench,
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
type TabKey = "all" | "announcements" | "urgent" | "discussions" | "media" | "questions";
type PostAttachment = { id: string; type: "image" | "video"; url: string; name?: string | null };

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "all", label: "All", icon: Users },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "urgent", label: "Urgent", icon: AlertTriangle },
  { key: "discussions", label: "Discussions", icon: Users },
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "questions", label: "Questions", icon: HelpCircle },
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

function categoryFor(post: any): Exclude<TabKey, "all"> {
  const raw = String(post?.category || post?.post_type || "").toLowerCase();
  const title = String(post?.title || "").toLowerCase();
  const body = String(post?.body || post?.content || "").toLowerCase();
  const text = `${raw} ${title} ${body} ${String(post?.priority || "")}`.toLowerCase();
  if (post?.is_urgent === true) return "urgent";
  if (/urgent|critical|emergency|alert|incident|security|gate|water|power|outage/.test(text)) return "urgent";
  if (Array.isArray(post?.media) && post.media.length) return "media";
  if (/question|ask|help|recommend|where|how do|anyone/.test(text)) return "questions";
  if (/notice|announcement|policy|service_notice|maintenance|facility|operations/.test(text)) return "announcements";
  return "discussions";
}

function toneFor(tab: TabKey) {
  if (tab === "urgent") return { Icon: AlertTriangle, ring: "text-red-100 border-red-300/18 bg-red-500/12 shadow-[0_0_16px_rgba(248,113,113,0.16)]", chip: "text-red-100 bg-red-500/12 border-red-300/18" };
  if (tab === "announcements") return { Icon: Megaphone, ring: "text-emerald-200 border-emerald-300/15 bg-emerald-400/10 shadow-[0_0_14px_rgba(52,211,153,0.12)]", chip: "text-emerald-200 bg-emerald-400/10 border-emerald-300/15" };
  if (tab === "media") return { Icon: ImageIcon, ring: "text-cyan-200 border-cyan-300/15 bg-cyan-400/10 shadow-[0_0_14px_rgba(34,211,238,0.12)]", chip: "text-cyan-200 bg-cyan-400/10 border-cyan-300/15" };
  if (tab === "questions") return { Icon: HelpCircle, ring: "text-amber-200 border-amber-300/15 bg-amber-400/10 shadow-[0_0_14px_rgba(251,191,36,0.12)]", chip: "text-amber-200 bg-amber-400/10 border-amber-300/15" };
  return { Icon: Users, ring: "text-violet-200 border-violet-300/15 bg-violet-400/10 shadow-[0_0_14px_rgba(167,139,250,0.12)]", chip: "text-violet-200 bg-violet-400/10 border-violet-300/15" };
}

function categoryLabelFor(post: any, tab: TabKey) {
  const raw = String(post?.category || post?.status || "").trim().toLowerCase();
  const text = [raw, post?.title || "", post?.body || post?.content || ""].join(" ").toLowerCase();
  if (/maintenance|repair|water|power|utility/.test(text)) return "Maintenance";
  if (/security|gate|access|alert|incident/.test(text)) return "Security";
  if (/amenity|booking|gym|pool|club|parking/.test(text)) return "Amenity";
  if (/resident|neighbor|neighbour|discussion|group/.test(text)) return "Resident";
  if (/notice|announcement|policy|update/.test(text) || tab === "announcements") return "Notice";
  return "General";
}

function authorName(post: any, me: any) {
  const explicit = normalizeText(post?.author_name || post?.author?.full_name || post?.author?.name || post?.created_by_name);
  if (explicit) return explicit;
  if (String(post?.author_id || post?.user_id || "") === String(me?.id || "")) return "You";
  return "Resident";
}

function officialIdentity(post: any) {
  const sourceLabel = normalizeText(post?.source_label);
  const sourceType = String(post?.source_type || post?.author_type || post?.created_by_type || "").toLowerCase();
  const hasResidentIdentity = Boolean(post?.resident_id || post?.author?.resident_id || post?.author_resident_id) || sourceType === "resident";
  if (hasResidentIdentity) return null;
  const roleText = `${post?.author_role || ""} ${post?.created_by_role || ""} ${post?.created_by_type || ""} ${post?.source || ""}`.toLowerCase();
  const operationalSource = Boolean(post?.facility_user_id || post?.operator_id || post?.staff_id) || /facility|operator|admin|administration|security|maintenance|moderator|operations/.test(`${sourceType} ${roleText}`);
  if (operationalSource || (post?.is_official === true && /facility|operator|admin|administration|security|maintenance|moderator|operations/.test(roleText))) {
    if (/security/i.test(sourceLabel)) return { label: sourceLabel || "Security Desk", Icon: ShieldCheck };
    if (/maintenance/i.test(sourceLabel)) return { label: sourceLabel || "Maintenance Team", Icon: Wrench };
    if (/admin/i.test(sourceLabel)) return { label: sourceLabel || "Administration", Icon: Building2 };
    if (/moderator/i.test(sourceLabel)) return { label: sourceLabel || "Community Moderator", Icon: ShieldCheck };
    if (/security/.test(roleText)) return { label: sourceLabel || "Security Desk", Icon: ShieldCheck };
    if (/maintenance|repair|service/.test(roleText)) return { label: sourceLabel || "Maintenance Team", Icon: Wrench };
    if (/admin|administration/.test(roleText)) return { label: sourceLabel || "Administration", Icon: Building2 };
    if (/moderator/.test(roleText)) return { label: sourceLabel || "Community Moderator", Icon: ShieldCheck };
    return { label: sourceLabel || "Estate Operations", Icon: Megaphone };
  }
  return null;
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
  if (tab === "announcements") return "announcement";
  if (tab === "urgent") return "urgent";
  if (tab === "media") return "media";
  if (tab === "questions") return "question";
  return "resident";
}

function isPostRead(post: any) {
  return post?.viewed_by_me === true || post?.read_by_me === true || Boolean(post?.read_at) || Boolean(post?.viewed_at);
}

function isPriorityNotice(data: { post: any; tab: Exclude<TabKey, "all">; official?: { label: string; Icon: any } | null }) {
  const post = data.post;
  const text = `${post?.category || ""} ${post?.post_type || ""} ${post?.priority || ""} ${post?.title || ""} ${post?.body || post?.content || ""}`.toLowerCase();
  if (!data.official || isPostRead(post)) return false;
  return post?.is_urgent === true || data.tab === "urgent" || /security|maintenance|emergency|service interruption|outage|power|water|administration|broadcast|gate|access/.test(text);
}

function initialsFor(name: string) {
  const parts = normalizeText(name).split(" ").filter(Boolean);
  if (!parts.length) return "R";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
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
  const activeContext = useActiveContext();
  const { estate, home } = activeContext;
  const notificationItems = useNotificationStore((state) => state.items);
  const markBucketViewed = useNotificationStore((state) => state.markBucketViewed);
  const markNotificationsRead = useNotificationStore((state) => state.markNotificationsRead);
  const estateId = useMemo(() => String(activeContext.estate_id || ""), [activeContext.estate_id]);
  const contextReady = activeContext.ready;

  const [tab, setTab] = useState<TabKey>("all");
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
    if (!contextReady || !estateId) {
      setItems([]);
      setLoading(activeContext.loading || activeContext.switching);
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

  useEffect(() => { void load(); }, [contextReady, activeContext.contextKey]);
  useEffect(() => { markBucketViewed("community"); }, [markBucketViewed]);
  useEffect(() => {
    if (!contextReady || !estateId) return;
    const timer = window.setInterval(() => void load(true), 20000);
    return () => window.clearInterval(timer);
  }, [contextReady, activeContext.contextKey]);

  const decorated = useMemo(() => items.map((post: any) => ({ post, tab: categoryFor(post), parsed: parseBody(post), author: authorName(post, user), official: officialIdentity(post), id: pickPostId(post) })).sort((a, b) => {
    const ap = a.post?.is_pinned ? 4 : a.tab === "urgent" ? 3 : a.tab === "announcements" ? 2 : 1;
    const bp = b.post?.is_pinned ? 4 : b.tab === "urgent" ? 3 : b.tab === "announcements" ? 2 : 1;
    if (bp !== ap) return bp - ap;
    return new Date(b.post?.created_at || 0).getTime() - new Date(a.post?.created_at || 0).getTime();
  }), [items, user]);
  const filtered = tab === "all" ? decorated : decorated.filter((item) => item.tab === tab);
  const priorityNotices = decorated.filter(isPriorityNotice).slice(0, 4);
  const counts = TABS.reduce<Record<TabKey, number>>((acc, item) => {
    acc[item.key] = item.key === "all" ? decorated.length : decorated.filter((post) => post.tab === item.key).length;
    return acc;
  }, { all: 0, announcements: 0, urgent: 0, discussions: 0, media: 0, questions: 0 });

  useEffect(() => {
    if (typeof window === "undefined" || !decorated.length) return;
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("postId");
    const target = decorated.find((item) => item.id === postId);
    if (!target) return;
    setTab(target.tab);
    setOpenPost(target.id);
    if (!comments[target.id]) void toggleComments(target.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorated.length]);

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

  async function markPostReadLocal(postId: string) {
    if (!postId) return;
    setItems((prev) => prev.map((post: any) => pickPostId(post) === postId ? { ...post, viewed_by_me: true, read_by_me: true, read_at: post.read_at || new Date().toISOString() } : post));
    const matchingNotificationIds = notificationItems
      .filter((item: any) => String(item?.status || "") !== "read" && String(item?.payload?.post_id || item?.entity_id || item?.post_id || "") === postId)
      .map((item: any) => String(item.id || ""))
      .filter(Boolean);
    if (matchingNotificationIds.length) markNotificationsRead(matchingNotificationIds);
    markBucketViewed("community");
    void communityService.markPostRead(postId);
  }

  async function toggleComments(postId: string) {
    const next = openPost === postId ? null : postId;
    setOpenPost(next);
    if (next) void markPostReadLocal(next);
    if (!next || comments[next]) return;
    setBusyPost((prev) => ({ ...prev, [next]: true }));
    try {
      const rows = await communityService.listComments(next);
      setComments((prev) => ({ ...prev, [next]: Array.isArray(rows) ? rows : [] }));
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

            {canPost ? (
              <section className="rounded-[21px] border border-white/[0.065] bg-white/[0.03] p-2.5 shadow-[0_14px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                {!composerOpen ? (
                  <button type="button" onClick={() => setComposerOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[17px] border border-sky-300/10 bg-sky-400/[0.045] px-3.5 py-2.5 text-[13px] font-semibold text-sky-200 transition active:scale-[0.99]">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Share with estate
                  </button>
                ) : (
                  <div className="space-y-3">
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Share a quiet update with ${estateName}...`} rows={3} className="w-full resize-none rounded-[18px] border border-white/[0.075] bg-black/25 px-3.5 py-3 text-[14px] leading-6 text-white outline-none placeholder:text-white/35 focus:border-sky-300/35" />
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

            {priorityNotices.length ? <OfficialNoticeLane notices={priorityNotices} onOpen={(id) => void toggleComments(id)} /> : null}

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button key={key} type="button" onClick={() => setTab(key)} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition", active ? "border-blue-400/70 bg-blue-500/12 text-sky-200 shadow-[0_0_16px_rgba(0,122,255,0.16)]" : "border-white/[0.075] bg-white/[0.025] text-white/64") }>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    {counts[key] ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", key === "urgent" ? "bg-red-300/18 text-red-100" : "bg-white/[0.06] text-white/56")}>{counts[key] > 9 ? "9+" : counts[key]}</span> : null}
                  </button>
                );
              })}
            </div>

            <LiveBroadcastComposer open={liveComposerOpen} estateId={estateId || null} draft={draft} onClose={() => setLiveComposerOpen(false)} onStarted={(post) => { setItems((prev) => [post, ...prev]); setLiveComposerOpen(false); void load(true); }} onStopped={() => void load(true)} />

            {err ? <div className="rounded-[16px] border border-red-300/15 bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-100">{err}</div> : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/42">{tab === "all" ? "Latest posts" : TABS.find((item) => item.key === tab)?.label}</div>
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

function OfficialNoticeLane({ notices, onOpen }: { notices: Array<{ post: any; tab: Exclude<TabKey, "all">; parsed: any; author: string; official?: { label: string; Icon: any } | null; id: string }>; onOpen: (id: string) => void }) {
  return (
    <section className="rounded-[24px] border border-sky-300/14 bg-sky-400/[0.045] p-3 shadow-[0_18px_52px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100/72"><ShieldCheck className="h-3.5 w-3.5" />Official notices</div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[10px] text-white/48">{notices.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {notices.map((notice) => {
          const label = categoryLabelFor(notice.post, notice.tab);
          return (
            <button key={notice.id || notice.post?.title} type="button" onClick={() => onOpen(notice.id)} className="min-w-[235px] rounded-[19px] border border-white/[0.08] bg-black/20 p-3 text-left transition active:scale-[0.99]">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", notice.tab === "urgent" ? "bg-red-300 shadow-[0_0_12px_rgba(248,113,113,0.75)]" : "bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.65)]")} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">{label}</span>
              </div>
              <div className="mt-2 line-clamp-1 text-[13px] font-semibold text-white">{normalizeText(notice.post?.title || notice.parsed?.text || "Estate notice")}</div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/50">{normalizeText(notice.parsed?.text || notice.post?.body || notice.post?.content || "Tap to view details.")}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommunityCard({ data, featured, open, comments, commentDraft, onCommentDraft, onToggleComments, onSendComment, onLike, busy, userId }: { data: { post: any; tab: Exclude<TabKey, "all">; parsed: any; author: string; official?: { label: string; Icon: any } | null; id: string }; featured?: boolean; open: boolean; comments: CommunityComment[]; commentDraft: string; onCommentDraft: (value: string) => void; onToggleComments: (postId: string) => void; onSendComment: () => void; onLike: (postId: string) => void; busy: boolean; userId: string }) {
  const { post, tab, parsed, author, official, id } = data;
  const tone = toneFor(tab);
  const Icon = official?.Icon || tone.Icon;
  const title = normalizeText(post?.title || parsed.text || "Community update");
  const body = normalizeText(parsed.text || post?.body || post?.content || "");
  const likeCount = Number(post?.like_count ?? post?.likes ?? post?.reactions_count ?? 0);
  const commentCount = Number(post?.comment_count ?? post?.comments ?? post?.reply_count ?? comments.length ?? 0);
  const isInternalLive = String(parsed.liveLink || post?.live_link || "").startsWith("oyi-live://");
  const liveSession = post?.live_session || null;
  const isLive = isInternalLive && String(liveSession?.status || "").toLowerCase() !== "ended";
  const authorAvatar = normalizeText(post?.author_avatar_url || post?.profile_image_url || post?.avatar_url || post?.author?.profile_image_url || post?.author?.avatar_url);
  const isOfficial = Boolean(official);
  const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];

  return (
    <article className={cn("rounded-[24px] border bg-white/[0.035] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl", featured || isOfficial ? "border-sky-300/18" : "border-white/[0.075]") }>
      <div className="flex items-start gap-3">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center overflow-hidden border", isOfficial ? "rounded-[16px] border-sky-300/18 bg-sky-400/12 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,0.16)]" : `rounded-full ${tone.ring}`)}>
          {!isOfficial && authorAvatar ? <img src={authorAvatar} alt={author} className="h-full w-full object-cover" /> : isOfficial ? <Icon className="h-4 w-4" /> : <span className="text-[12px] font-semibold">{initialsFor(author)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.025em] text-white">{title}</h2>
            {featured ? <span className="rounded-full border border-sky-300/16 bg-sky-400/10 px-1.5 py-0.5 text-[9px] text-sky-200">Pinned</span> : null}
            {tab === "urgent" ? <span className="rounded-full border border-red-300/18 bg-red-500/12 px-1.5 py-0.5 text-[9px] text-red-100">Urgent</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-white/42">
            <span className={cn(isOfficial && "font-semibold text-sky-100/84")}>{official?.label || author}</span>
            {!isOfficial && <span>Resident</span>}
            <span>•</span>
            <span>{when(post?.created_at)}</span>
          </div>
        </div>
        <MoreHorizontal className="mt-2 h-4 w-4 shrink-0 text-white/32" />
      </div>

      {body && body !== title ? <p className="mt-3 whitespace-pre-line text-[13.5px] leading-6 text-white/68">{body}</p> : null}

      {attachments.length ? (
        <div className={cn("mx-[-16px] mt-4 grid overflow-hidden border-y border-white/[0.08] bg-black/30", attachments.length === 1 ? "grid-cols-1" : "grid-cols-2 gap-px")}>
          {attachments.slice(0, 4).map((item: PostAttachment, index: number) => item.type === "video" ? (
            <div key={item.id} className="relative">
              <video src={item.url} controls className={cn("w-full bg-black object-cover", attachments.length === 1 ? "max-h-[390px] min-h-[230px]" : "h-40", index === 0 && attachments.length === 3 && "row-span-2 h-full")} />
              <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur"><Video className="h-3 w-3" /> Video</span>
            </div>
          ) : (
            <img key={item.id} src={item.url} alt={item.name || "community media"} className={cn("w-full object-cover", attachments.length === 1 ? "max-h-[390px] min-h-[230px]" : "h-40", index === 0 && attachments.length === 3 && "row-span-2 h-full")} />
          ))}
        </div>
      ) : null}

      {isInternalLive ? <div className="mt-3"><LiveSessionPlayer postId={id} userId={userId || null} userName={author} isLive={isLive} initialViewerCount={Number(liveSession?.viewer_count || 0)} hasGuest={Boolean(liveSession?.has_guest)} /></div> : null}

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.055] pt-3">
        <span className={cn("rounded-full border px-2 py-0.5 text-[9.5px] capitalize", tone.chip)}>{categoryLabelFor(post, tab)}</span>
        <div className="flex items-center gap-1.5 text-[11px] text-white/52">
          <button type="button" onClick={() => onLike(id)} disabled={busy || !id} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-white/[0.055]"><ThumbsUp className="h-3.5 w-3.5" />{likeCount}</button>
          <button type="button" onClick={() => onToggleComments(id)} disabled={!id} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-white/[0.055]"><MessageCircle className="h-3.5 w-3.5" />{commentCount}</button>
          <ChevronRight className={cn("h-4 w-4 transition", open && "rotate-90")} />
        </div>
      </div>

      {open ? (
        <div className="mt-3 rounded-[18px] border border-white/[0.07] bg-black/20 p-3">
          {comments.length ? <div className="mb-3 max-h-48 space-y-2 overflow-auto pr-1">{comments.map((comment: any) => <div key={String(comment.id)} className="rounded-[15px] bg-white/[0.035] px-3 py-2.5"><div className="text-[11px] font-medium text-white/76">{comment.author_name || "Resident"}</div><div className="mt-1 text-[12px] leading-5 text-white/60">{comment.content}</div></div>)}</div> : <div className="mb-3 text-[12px] text-white/40">No comments yet.</div>}
          <div className="flex items-center gap-2">
            <input value={commentDraft} onChange={(event) => onCommentDraft(event.target.value)} placeholder="Write a calm reply..." className="h-9 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 text-[12px] text-white outline-none placeholder:text-white/32" />
            <button type="button" onClick={onSendComment} disabled={busy || !commentDraft.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
