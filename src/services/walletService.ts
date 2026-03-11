// src/services/walletService.ts
import API from "./api";

export type WalletDTO = {
  id: string;
  user_id: string;
  balance: number;
  currency?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InitPaymentResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
  // some stacks return these at root
  authorization_url?: string;
  reference?: string;
};

export type VerifyPaymentResponse = {
  ok?: boolean;
  applied?: boolean;
  balance?: number;
  reference?: string;
  error?: string;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const walletService = {
  // ✅ GET /wallets
  async getWallet() {
    try {
      const res = await API.get("/wallets");
      return res.data as WalletDTO;
    } catch (err: any) {
      return { error: pickError(err, "Failed to load wallet") } as any;
    }
  },

  // ✅ POST /wallets/init
  async initPayment(payload: { amount: number; email: string; callback_url?: string }) {
    try {
      const res = await API.post("/wallets/init", payload);
      return res.data as InitPaymentResponse;
    } catch (err: any) {
      return { error: pickError(err, "Failed to init payment") } as any;
    }
  },

  // ✅ POST /wallets/debit (optional)
  async debit(payload: { amount: number; reason?: string }) {
    try {
      const res = await API.post("/wallets/debit", payload);
      return res.data as { balance: number };
    } catch (err: any) {
      return { error: pickError(err, "Failed to debit wallet") } as any;
    }
  },

  // ✅ GET /wallets/verify/:reference (fallback when webhook is delayed)
  async verifyPayment(reference: string) {
    try {
      const res = await API.get(`/wallets/verify/${encodeURIComponent(reference)}`);
      return res.data as VerifyPaymentResponse;
    } catch (err: any) {
      return { error: pickError(err, "Failed to verify payment") } as VerifyPaymentResponse;
    }
  },
};

export default walletService;
