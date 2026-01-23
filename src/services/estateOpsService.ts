// src/services/estateOpsService.ts
import API from "./api";

export const estateOpsService = {
  /* -----------------------------
     WALLET
  ------------------------------ */
  async getWallet() {
    const res = await API.get("/wallet");
    return res.data;
  },

  async getWalletTransactions() {
    const res = await API.get("/wallet/transactions");
    return res.data?.transactions ?? res.data ?? [];
  },

  async fundWallet(amount: number) {
    const res = await API.post("/wallet/fund", { amount });
    return res.data;
  },

  /* -----------------------------
     UTILITIES (meters + bills)
  ------------------------------ */
  async getUtilitiesSummary() {
    const res = await API.get("/utilities/summary");
    return res.data;
  },

  async payUtilityBill(payload: { type: string; amount: number; referenceId?: string }) {
    const res = await API.post("/utilities/pay", payload);
    return res.data;
  },

  /* -----------------------------
     VISITORS
  ------------------------------ */
  async listVisitors() {
    const res = await API.get("/visitors");
    return res.data?.visitors ?? res.data ?? [];
  },

  async createVisitor(payload: { name: string; phone?: string; note?: string }) {
    const res = await API.post("/visitors", payload);
    return res.data;
  },

  async approveVisitor(visitorId: string) {
    const res = await API.post(`/visitors/${encodeURIComponent(visitorId)}/approve`);
    return res.data;
  },

  /* -----------------------------
     MAINTENANCE
  ------------------------------ */
  async listMaintenance() {
    const res = await API.get("/maintenance");
    return res.data?.tickets ?? res.data ?? [];
  },

  async createMaintenance(payload: { title: string; description?: string; priority?: string }) {
    const res = await API.post("/maintenance", payload);
    return res.data;
  },

  /* -----------------------------
     COMMUNITY
  ------------------------------ */
  async listCommunityPosts() {
    const res = await API.get("/community");
    return res.data?.posts ?? res.data ?? [];
  },
};
