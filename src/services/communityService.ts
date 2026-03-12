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
};

export type CreatePostPayload = {
  title: string;
  body?: string | null;
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
  if (lower.includes("community_reactions") && lower.includes("could not find the table")) {
    return "Reactions are being configured. Please refresh shortly.";
  }
  if (lower.includes("community_comments") && lower.includes("could not find the table")) {
    return "Comments are being configured. Please refresh shortly.";
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

  async uploadMedia(payload: CommunityUploadPayload) {
    try {
      const res = await API.post("/community/media/upload", payload);
      return res.data as { ok?: boolean; url?: string; mime?: string; mediaType?: "image" | "video"; key?: string };
    } catch (err: any) {
      return { error: pickError(err, "Failed to upload media") } as any;
    }
  },
};

export default communityService;
