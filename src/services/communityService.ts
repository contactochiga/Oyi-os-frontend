// services/communityService.ts
import API from "./api";

export type CommunityPost = {
  id: string;
  estate_id: string;
  user_id: string;

  title: string;
  content?: string | null;

  media?: any | null;
  poll?: any | null;

  status?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const communityService = {
  /**
   * GET /community/posts/:estateId
   * returns: CommunityPost[]
   */
  async listByEstate(estateId: string): Promise<{ items: CommunityPost[]; error?: string }> {
    if (!estateId) return { items: [], error: "No estateId provided" };

    try {
      const res = await API.get(`/community/posts/${estateId}`);
      return { items: (res.data || []) as CommunityPost[] };
    } catch (err: any) {
      return { items: [], error: pickError(err, "Failed to load community posts") };
    }
  },

  /**
   * POST /community/posts
   * body: { title, content, estateId, media?, poll? }
   * returns: CommunityPost
   */
  async create(payload: {
    estateId: string;
    title: string;
    content: string;
    media?: any;
    poll?: any;
  }): Promise<{ post?: CommunityPost; error?: string }> {
    try {
      const res = await API.post("/community/posts", payload);
      return { post: res.data as CommunityPost };
    } catch (err: any) {
      return { error: pickError(err, "Failed to create post") };
    }
  },
};
