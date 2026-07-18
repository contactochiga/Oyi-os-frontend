// src/services/communityService.ts
import API from "./api";

export type CommunityPost = {
  id: string;
  estate_id?: string | null;

  title?: string | null;
  body?: string | null;

  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  author_id?: string | null;
  views?: number;
  view_count?: number;
  viewed_by_me?: boolean;
  live_link?: string | null;
  category?: string | null;
  is_pinned?: boolean | null;
  pinned_until?: string | null;
  audience_type?: string | null;
  audience_ref?: string | null;
  scheduled_at?: string | null;
  priority?: string | null;
  author_role?: string | null;
  source_type?: "facility" | "resident" | string | null;
  source_label?: string | null;
  is_official?: boolean | null;
  is_urgent?: boolean | null;
  media?: Array<{ id?: string; type?: "image" | "video"; url: string; name?: string | null }>;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  live_session?: {
    post_id: string;
    estate_id?: string | null;
    host_user_id?: string | null;
    guest_user_id?: string | null;
    guest_display_name?: string | null;
    status?: "starting" | "live" | "ended" | string;
    viewer_count?: number;
    has_guest?: boolean;
    pending_request_count?: number;
    created_at?: string | null;
    updated_at?: string | null;
    is_live?: boolean;
  } | null;
  rtc_config?: LiveRtcConfig | null;
};

export type LiveRtcConfig = {
  iceServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  iceTransportPolicy?: "all" | "relay";
};

export type LiveGuestRequest = {
  socketId: string;
  userId?: string;
  userName?: string;
};

export type LiveChatMessage = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

export type CreatePostPayload = {
  title: string;
  content?: string | null;
  body?: string | null;
  media?: Array<{ id?: string; type?: "image" | "video"; url: string; name?: string | null }>;
  liveLink?: string | null;
  category?: string | null;
  is_pinned?: boolean | null;
  pinned_until?: string | null;
  audience?: { type?: string | null; ref?: string | null } | null;
  scheduled_at?: string | null;
  priority?: string | null;
  // optional: backend can derive from user.estate_id
  estateId?: string;
  estate_id?: string;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CommunityUploadPayload = {
  base64: string;
  mime: string;
  filename?: string;
  mediaType?: "image" | "video";
};

function unwrapList(data: any) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.posts)) return data.posts;
  return [];
}

function pickError(err: any, fallback: string) {
  const status = Number(err?.response?.status || 0);
  const msg =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback;

  const lower = String(msg || "").toLowerCase();
  const url = String(err?.config?.url || "").toLowerCase();
  if (lower.includes("community_reactions") && lower.includes("could not find the table")) {
    return "Reactions are being configured. Please refresh shortly.";
  }
  if (lower.includes("community_comments") && lower.includes("could not find the table")) {
    return "Comments are being configured. Please refresh shortly.";
  }
  if (
    err?.response?.status === 404 &&
    (url.includes("/community/live/") || lower.includes("route not found"))
  ) {
    return "Live streaming backend is not deployed yet. Redeploy the backend and try again.";
  }

  if (status === 401) return "Please sign in again to load community updates.";
  if (status === 403) return "This account does not have access to these community updates.";
  if (status >= 500) return "Community updates are temporarily unavailable. Try again.";
  return String(msg || fallback).length < 180 ? msg : fallback;
}

function throwCommunityError(err: any, fallback: string): never {
  const error = new Error(pickError(err, fallback)) as Error & { status?: number; code?: string };
  error.status = Number(err?.response?.status || 0) || undefined;
  error.code = String(err?.response?.data?.code || err?.response?.data?.error_code || "community_request_failed");
  throw error;
}

export const communityService = {
  // ✅ GET /community/posts/estate/:estateId
  async listByEstate(estateId: string): Promise<CommunityPost[]> {
    try {
      const res = await API.get(
        `/community/posts/estate/${encodeURIComponent(estateId)}`
      );
      return unwrapList(res.data) as CommunityPost[];
    } catch (err: any) {
      throwCommunityError(err, "Failed to load community updates");
    }
  },

  // ✅ POST /community/post
  async createPost(payload: CreatePostPayload) {
    try {
      const res = await API.post("/community/post", payload);
      return res.data as CommunityPost;
    } catch (err: any) {
      return { error: pickError(err, "Failed to create post") } as any;
    }
  },

  // ✅ GET /community/post/:postId
  async getPost(postId: string) {
    try {
      const res = await API.get(`/community/post/${encodeURIComponent(postId)}`);
      return res.data as CommunityPost;
    } catch (err: any) {
      return { error: pickError(err, "Failed to load post") } as any;
    }
  },

  // ✅ GET /community/post/:postId/comments
  async listComments(postId: string): Promise<CommunityComment[]> {
    try {
      const res = await API.get(
        `/community/post/${encodeURIComponent(postId)}/comments`
      );
      return unwrapList(res.data) as CommunityComment[];
    } catch (err: any) {
      throwCommunityError(err, "Failed to load comments");
    }
  },

  // ✅ POST /community/post/:postId/comment
  async createComment(postId: string, payload: { content: string; parent_comment_id?: string | null }) {
    try {
      const res = await API.post(
        `/community/post/${encodeURIComponent(postId)}/comment`,
        payload
      );
      return res.data as CommunityComment;
    } catch (err: any) {
      return { error: pickError(err, "Failed to create comment") } as any;
    }
  },

  // ✅ POST /community/post/:postId/react
  async reactToPost(postId: string, type: string) {
    try {
      const res = await API.post(
        `/community/post/${encodeURIComponent(postId)}/react`,
        { type }
      );
      return res.data;
    } catch (err: any) {
      return { error: pickError(err, "Failed to react") } as any;
    }
  },

  async markPostRead(postId: string) {
    try {
      const res = await API.post(`/community/post/${encodeURIComponent(postId)}/read`);
      return res.data;
    } catch (err: any) {
      return { error: pickError(err, "Failed to mark post read") } as any;
    }
  },

  async reportPost(postId: string, payload: { reason: string; details?: string | null }) {
    try {
      const res = await API.post(`/community/post/${encodeURIComponent(postId)}/report`, payload);
      return res.data;
    } catch (err: any) {
      return { error: pickError(err, "Failed to report post") } as any;
    }
  },

  async trackView(postId: string) {
    try {
      const res = await API.post(`/community/post/${encodeURIComponent(postId)}/view`);
      return res.data;
    } catch (err: any) {
      return { error: pickError(err, "Failed to track view") } as any;
    }
  },

  async uploadMedia(payload: CommunityUploadPayload) {
    try {
      const res = await API.post("/community/media/upload", payload, {
        timeout: 120000,
      });
      return res.data as { ok?: boolean; url?: string; mime?: string; mediaType?: "image" | "video"; key?: string };
    } catch (err: any) {
      return { error: pickError(err, "Failed to upload media") } as any;
    }
  },

  async startLiveSession(payload: { title?: string | null; content?: string | null; estateId?: string }) {
    try {
      const res = await API.post("/community/live/start", payload);
      return res.data as CommunityPost;
    } catch (err: any) {
      return { error: pickError(err, "Failed to start live session") } as any;
    }
  },

  async stopLiveSession(postId: string) {
    try {
      const res = await API.post(`/community/live/${encodeURIComponent(postId)}/stop`);
      return res.data as CommunityPost;
    } catch (err: any) {
      return { error: pickError(err, "Failed to stop live session") } as any;
    }
  },

  async getLiveSession(postId: string) {
    try {
      const res = await API.get(`/community/live/${encodeURIComponent(postId)}`);
      return res.data as any;
    } catch (err: any) {
      return { error: pickError(err, "Failed to load live session") } as any;
    }
  },

  async getLiveRequests(postId: string) {
    try {
      const res = await API.get(`/community/live/${encodeURIComponent(postId)}/requests`);
      return res.data as { ok?: boolean; requests?: LiveGuestRequest[]; live_session?: CommunityPost["live_session"] };
    } catch (err: any) {
      return { error: pickError(err, "Failed to load live requests") } as any;
    }
  },

  async getLiveChat(postId: string) {
    try {
      const res = await API.get(`/community/live/${encodeURIComponent(postId)}/chat`);
      return res.data as { ok?: boolean; chat?: LiveChatMessage[]; live_session?: CommunityPost["live_session"] };
    } catch (err: any) {
      return { error: pickError(err, "Failed to load live chat") } as any;
    }
  },

  async getLiveRtcConfig() {
    try {
      const res = await API.get("/community/live/config");
      return res.data as { ok?: boolean; rtc_config?: LiveRtcConfig | null };
    } catch (err: any) {
      return { error: pickError(err, "Failed to load live configuration") } as any;
    }
  },
};

export default communityService;
