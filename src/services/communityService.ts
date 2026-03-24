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
  live_session?: {
    post_id: string;
    estate_id?: string | null;
    host_user_id?: string | null;
    status?: "starting" | "live" | "ended" | string;
    viewer_count?: number;
    created_at?: string | null;
    updated_at?: string | null;
    is_live?: boolean;
  } | null;
};

export type CreatePostPayload = {
  title: string;
  content?: string | null;
  body?: string | null;
  media?: Array<{ id?: string; type?: "image" | "video"; url: string; name?: string | null }>;
  liveLink?: string | null;
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

  return msg;
}

export const communityService = {
  // ✅ GET /community/posts/estate/:estateId
  async listByEstate(estateId: string): Promise<CommunityPost[]> {
    try {
      const res = await API.get(
        `/community/posts/estate/${encodeURIComponent(estateId)}`
      );
      return unwrapList(res.data) as CommunityPost[];
    } catch (err) {
      console.warn("communityService.listByEstate error:", err);
      return [];
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
    } catch (err) {
      console.warn("communityService.listComments error:", err);
      return [];
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
};

export default communityService;
