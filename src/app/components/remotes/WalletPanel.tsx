"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RemotePanel from "./RemotePanel";
import useActiveContext from "@/hooks/useActiveContext";
import { walletService } from "@/services/walletService";

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

export default function WalletPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const activeContext = useActiveContext();
  const router = useRouter();
  const scope = useMemo(
    () => ({ estate_id: activeContext.estate_id || null, home_id: activeContext.home_id || null }),
    [activeContext.estate_id, activeContext.home_id],
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  function touch() {
    onInteraction?.();
  }

  const load = useCallback(async () => {
    if (!activeContext.ready || !activeContext.home_id) {
      setBalance(0);
      setTransactions([]);
      return;
    }
    setLoading(true);
    setErr(null);

    try {
      const w: any = await walletService.getWallet(scope);
      if (w?.error) throw new Error(String(w.error));
      const b = Number(w?.balance ?? 0);
      setBalance(Number.isFinite(b) ? b : 0);

      // keep empty until your backend provides tx list
      setTransactions([]);
    } catch (e: any) {
      const msg = pickErr(e);
      setErr(msg);
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [activeContext.ready, activeContext.home_id, scope]);

  function openWallet() {
    touch();
    router.push("/wallet");
  }

  useEffect(() => {
    void load();
  }, [load, activeContext.contextKey]);

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
          onClick={openWallet}
          disabled={loading}
          className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-semibold border border-white/20 disabled:opacity-50"
          type="button"
        >
          Fund wallet
        </button>

        <button
          onClick={openWallet}
          disabled={loading}
          className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm font-semibold border border-white/10 hover:bg-white/15 disabled:opacity-50"
          type="button"
        >
          Open payments
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
