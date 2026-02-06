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
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || "Something went wrong";
}

function extractPaystackUrl(resp: any): string | null {
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
      const b = Number(w?.balance ?? 0);
      setBalance(Number.isFinite(b) ? b : 0);

      // keep empty until your backend provides tx list
      setTransactions([]);
    } catch (e: any) {
      const msg = pickErr(e);
      if (String(msg).toLowerCase().includes("cannot coerce the result to a single json object")) {
        setErr("Wallet returned multiple rows for this user. Ensure wallets.user_id is UNIQUE (or query limit 1).");
      } else {
        setErr(msg);
      }
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  async function fundWallet() {
    setErr(null);
    if (!user?.email) return setErr("Your account email is required to fund wallet.");

    const raw = window.prompt("How much do you want to fund? (NGN)", "5000");
    if (!raw) return;

    const amount = Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return setErr("Enter a valid amount (e.g. 5000).");

    try {
      setLoading(true);
      touch();

      const initResp = await walletService.initPayment({ amount, email: user.email });
      const url = extractPaystackUrl(initResp);
      if (!url) return setErr("No authorization_url returned from Paystack init.");

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
    if (!Number.isFinite(amount) || amount <= 0) return setErr("Enter a valid amount (e.g. 1000).");

    const reason = window.prompt("Reason (optional)", "bills_payment") || "bills_payment";

    try {
      setLoading(true);
      touch();

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
    <RemotePanel
      title="Wallet"
      lastUpdated={lastUpdated}
      right={
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 disabled:opacity-50"
          type="button"
        >
          {loading ? "Syncing…" : "Refresh"}
        </button>
      }
    >
      {err && (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/45 mb-1">Available balance</div>
        <div className="text-2xl font-semibold text-white/90">₦{Number(balance).toLocaleString()}</div>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={fundWallet}
          disabled={loading}
          className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-semibold border border-white/20 disabled:opacity-50"
          type="button"
        >
          Fund
        </button>

        <button
          onClick={payBills}
          disabled={loading}
          className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm font-semibold border border-white/10 hover:bg-white/15 disabled:opacity-50"
          type="button"
        >
          Pay
        </button>
      </div>

      <div>
        <div className="text-xs text-white/45 mb-2">Transactions</div>

        {!transactions.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No transactions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-white/90 truncate">{tx.title}</div>
                  <div className="text-xs text-white/45">{tx.time}</div>
                </div>

                <div className={`text-sm font-semibold ${tx.type === "credit" ? "text-emerald-300" : "text-red-300"}`}>
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
