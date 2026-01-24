// src/app/components/remotes/WalletPanel.tsx

"use client";

import { useEffect, useState } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { walletService } from "@/services/estateOpsService";

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: "credit" | "debit";
  time: string;
};

function pickErr(e: any) {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Something went wrong"
  );
}

// Paystack initialize responses sometimes come back in different shapes
function extractPaystackUrl(resp: any): string | null {
  // Typical Paystack: { status: true, message, data: { authorization_url } }
  const a =
    resp?.data?.authorization_url ||
    resp?.authorization_url ||
    resp?.data?.data?.authorization_url ||
    resp?.data?.authorization_url;

  return typeof a === "string" ? a : null;
}

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

      // Expecting: { id, user_id, balance, ... }
      const b = Number(w?.balance ?? 0);
      setBalance(Number.isFinite(b) ? b : 0);

      // No tx endpoint yet — keep empty until you add one (signals/ledger)
      setTransactions([]);
    } catch (e: any) {
      const msg = pickErr(e);

      // If backend returns the Supabase "single()" error, show clear hint
      if (String(msg).toLowerCase().includes("cannot coerce the result to a single json object")) {
        setErr(
          "Wallet table returned multiple rows for this user. Fix backend: ensure wallets.user_id is UNIQUE (or change query to limit 1)."
        );
      } else {
        setErr(msg);
      }

      // keep real state (no demo fallback)
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  async function fundWallet() {
    setErr(null);

    if (!user?.email) {
      setErr("Your account email is required to fund wallet.");
      return;
    }

    const raw = window.prompt("How much do you want to fund? (NGN)", "5000");
    if (!raw) return;

    const amount = Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a valid amount (e.g. 5000).");
      return;
    }

    try {
      setLoading(true);
      touch();

      const initResp = await walletService.initPayment({
        amount,
        email: user.email,
      });

      const url = extractPaystackUrl(initResp);
      if (!url) {
        setErr("Paystack init succeeded but no authorization_url was returned.");
        return;
      }

      // redirect to Paystack checkout
      window.location.href = url;
    } catch (e: any) {
      setErr(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  async function payBills() {
    setErr(null);

    const raw = window.prompt("How much do you want to pay? (NGN)", "1000");
    if (!raw) return;

    const amount = Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a valid amount (e.g. 1000).");
      return;
    }

    const reason =
      window.prompt("Reason (optional)", "bills_payment") || "bills_payment";

    try {
      setLoading(true);
      touch();

      // placeholder until you build real biller endpoints
      await walletService.debit({ amount, reason });
      await load();
    } catch (e: any) {
      setErr(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RemotePanel title="Wallet" lastUpdated={lastUpdated}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">
          {loading ? "Syncing…" : "Balance"}
        </div>

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
        <div className="text-2xl font-semibold text-white">
          ₦{Number(balance).toLocaleString()}
        </div>
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
          <div className="text-sm text-gray-500">
            No transactions yet. (We’ll show this once you add a tx/ledger endpoint.)
          </div>
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
                  {tx.type === "credit" ? "+" : "-"}₦
                  {tx.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RemotePanel>
  );
}
