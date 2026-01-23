"use client";

import { useEffect, useState } from "react";
import RemotePanel from "./RemotePanel";
import { estateOpsService } from "@/services/estateOpsService";

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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState<number>(1000);

  function touch() {
    onInteraction?.();
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const wallet = await estateOpsService.getWallet();
      const txs = await estateOpsService.getWalletTransactions();
      setBalance(Number(wallet?.balance ?? 0));
      setTransactions(txs || []);
      touch();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }

  async function fund() {
    setLoading(true);
    setErr(null);
    try {
      await estateOpsService.fundWallet(amount);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Funding failed");
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RemotePanel title="Wallet" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* BALANCE */}
      <div className="mb-4 rounded-xl bg-gray-800 border border-gray-700 p-4">
        <div className="text-xs text-gray-400 mb-1">Available Balance</div>
        <div className="text-2xl font-semibold text-white">
          ₦{balance.toLocaleString()}
        </div>
      </div>

      {/* FUND */}
      <div className="flex gap-2 mb-5">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
          placeholder="Amount"
          min={0}
        />
        <button
          onClick={fund}
          disabled={loading || amount <= 0}
          className="px-4 py-2 rounded-xl bg-[#E11D2E] text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "..." : "Fund"}
        </button>
      </div>

      {/* TX */}
      <div>
        <div className="text-xs text-gray-400 mb-2">Recent Transactions</div>

        {loading && !transactions.length ? (
          <div className="text-sm text-gray-500 py-4">Loading…</div>
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

            {!transactions.length && (
              <div className="text-sm text-gray-500 text-center py-4">
                No transactions yet.
              </div>
            )}
          </div>
        )}
      </div>
    </RemotePanel>
  );
}
