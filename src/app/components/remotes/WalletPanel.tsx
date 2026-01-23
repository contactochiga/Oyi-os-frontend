"use client";

import { useEffect, useState } from "react";
import RemotePanel from "./RemotePanel";
import { walletService } from "@/services/estateOpsService";
import useAuth from "@/hooks/useAuth";

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: "credit" | "debit";
  time: string;
};

export default function WalletPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  function touch() {
    onInteraction?.();
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const w = await walletService.getWallet();
      setBalance(Number(w?.balance ?? 0));

      // If you later store transactions in DB, map it here.
      setTransactions([]);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Wallet not ready yet");
      // demo fallback
      setBalance(24500);
      setTransactions([
        { id: "t1", title: "Electricity Bill", amount: 4500, type: "debit", time: "Today" },
        { id: "t2", title: "Wallet Funding", amount: 20000, type: "credit", time: "Yesterday" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function fundWallet() {
    // You already have /wallets/init (Paystack initialize)
    if (!user?.email) {
      setErr("Your account email is required to fund wallet.");
      return;
    }

    try {
      touch();
      // example: ₦5,000
      const init = await walletService.initPayment({ amount: 5000, email: user.email });
      // Paystack response typically includes authorization_url
      const url = init?.data?.authorization_url || init?.authorization_url;
      if (url) window.location.href = url;
      else setErr("Paystack init returned no redirect URL.");
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Funding failed");
    }
  }

  async function payBills() {
    // placeholder: you can use /wallets/debit for now as “bill payment”
    try {
      touch();
      await walletService.debit({ amount: 1000, reason: "bills_payment_placeholder" });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Payment failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <RemotePanel title="Wallet" lastUpdated={lastUpdated}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">{loading ? "Syncing…" : "Balance"}</div>
        <button
          onClick={load}
          disabled={loading}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            loading ? "bg-gray-700 text-gray-400" : "bg-[#E11D2E] text-white"
          }`}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="mb-4 rounded-xl bg-gray-800 border border-gray-700 p-4">
        <div className="text-xs text-gray-400 mb-1">Available Balance</div>
        <div className="text-2xl font-semibold text-white">₦{Number(balance).toLocaleString()}</div>
      </div>

      <div className="flex gap-3 mb-5">
        <button
          onClick={fundWallet}
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-medium disabled:opacity-50"
        >
          Fund Wallet
        </button>

        <button
          onClick={payBills}
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium disabled:opacity-50"
        >
          Pay Bills
        </button>
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-2">Recent Transactions</div>

        {!transactions.length ? (
          <div className="text-sm text-gray-500">No transactions yet.</div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 border border-gray-700"
              >
                <div>
                  <div className="text-sm text-white">{tx.title}</div>
                  <div className="text-xs text-gray-400">{tx.time}</div>
                </div>

                <div
                  className={`text-sm font-medium ${
                    tx.type === "credit" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RemotePanel>
  );
}
