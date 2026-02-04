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
  // some backends return { authorization_url } directly
  authorization_url?: string;
  reference?: string;
};

function unwrapInitUrl(res: any): { url?: string; reference?: string } {
  const url =
    res?.data?.authorization_url ||
    res?.authorization_url ||
    res?.data?.data?.authorization_url ||
    res?.data?.data?.authorizationUrl;

  const reference =
    res?.data?.reference ||
    res?.reference ||
    res?.data?.data?.reference;

  return { url, reference };
}

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const walletService = {
  // ✅ GET /wallet
  async getWallet() {
    try {
      const res = await API.get("/wallet");
      return res.data as WalletDTO;
    } catch (err: any) {
      return { error: pickError(err, "Failed to load wallet") } as any;
    }
  },

  /**
   * ✅ INIT PAYSTACK PAYMENT
   * Backend controller: initPayment expects { amount, email }
   *
   * ROUTE NOTE:
   * - If your backend mounts it as POST /wallet/init, keep this.
   * - If it is POST /wallet/init-payment or /wallet/initPayment, change it here.
   */
  async initPayment(payload: { amount: number; email: string }) {
    try {
      const res = await API.post("/wallet/init", payload); // <-- change if your route differs
      return res.data as InitPaymentResponse;
    } catch (err: any) {
      return { error: pickError(err, "Failed to init payment") } as any;
    }
  },

  /**
   * ✅ OPTIONAL: MANUAL DEBIT (only if you expose it to consumer)
   * POST /wallet/debit { amount, reason }
   */
  async debit(payload: { amount: number; reason?: string }) {
    try {
      const res = await API.post("/wallet/debit", payload);
      return res.data as { balance: number };
    } catch (err: any) {
      return { error: pickError(err, "Failed to debit wallet") } as any;
    }
  },
};

export default walletService;
