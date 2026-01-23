// src/services/estateOpsService.ts
import API from "./api";

/* ---------------------------
   COMMUNITY
---------------------------- */
// Your backend:
// GET /community/posts/estate/:estateId
// POST /community/post
export const communityService = {
  async listPostsForEstate(estateId: string) {
    const res = await API.get(`/community/posts/estate/${encodeURIComponent(estateId)}`);
    // controller returns array directly
    return res.data ?? [];
  },

  async createPost(payload: { estateId: string; title: string; content?: string }) {
    const res = await API.post("/community/post", payload);
    return res.data;
  },
};

/* ---------------------------
   VISITORS
---------------------------- */
// Your backend:
// POST /visitors
// PUT /visitors/approve/:id
// (no deny endpoint yet)
export const visitorService = {
  async createVisitor(payload: any) {
    const res = await API.post("/visitors", payload);
    return res.data;
  },

  async approveVisitor(id: string) {
    const res = await API.put(`/visitors/approve/${encodeURIComponent(id)}`);
    return res.data;
  },

  // If you want deny, add backend route + controller method.
  // For now we'll keep it UI-only or reuse "delete" later.
};

/* ---------------------------
   WALLET
---------------------------- */
// Your backend:
// GET /wallets
// POST /wallets/init
// POST /wallets/debit
export const walletService = {
  async getWallet() {
    const res = await API.get("/wallets");
    return res.data;
  },

  async initPayment(payload: { amount: number; email: string }) {
    const res = await API.post("/wallets/init", payload);
    return res.data;
  },

  async debit(payload: { amount: number; reason?: string }) {
    const res = await API.post("/wallets/debit", payload);
    return res.data;
  },
};

/* ---------------------------
   ROOMS
---------------------------- */
// Your backend:
// GET /rooms?homeId=xxx
export const roomsService = {
  async getRooms(homeId: string) {
    const res = await API.get(`/rooms`, { params: { homeId } });
    return res.data ?? [];
  },
};
