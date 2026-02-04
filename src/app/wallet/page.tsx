"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { walletService, type WalletDTO } from "@/services/walletService";

function formatMoney(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency || "NGN"} ${Number(amount || 0).toFixed(2)}`;
  }
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function WalletPage() {
  const { user } = useAuth();

  const email = useMemo(() => {
    return user?.email || "";
  }, [user?.email]);

  const [wallet, setWallet] = useState<WalletDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res: any = await walletService.getWallet();
      if (res?.error) {
        setErr(String(res.error));
        setWallet(null);
        return;
      }
      setWallet(res || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load wallet");
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function fund() {
    setErr(null);

    const n = safeNum(amount);
    if (!email) return setErr("No email found for this account.");
    if (!n || n < 100) return setErr("Enter an amount of at least ₦100.");

    setFunding(true);
    try {
      const res: any = await walletService.initPayment({
        amount: n,
        email,
      });

      if (res?.error) {
        setErr(String(res.error));
        return;
      }

      // Paystack initialize usually returns { data: { authorization_url } }
      const url =
        res?.data?.authorization_url ||
        res?.authorization_url ||
        res?.data?.data?.authorization_url;

      if (!url) {
        setErr("Payment initialized but no Paystack URL returned (check backend route response).");
        return;
      }

      // ✅ open paystack checkout
      window.location.href = String(url);
    } catch (e: any) {
      setErr(e?.message || "Failed to start funding");
    } finally {
      setFunding(false);
    }
  }

  const currency = wallet?.currency || "NGN";
  const balance = safeNum(wallet?.balance);

  return (
    <ConsumerShell title="Wallet" subtitle="Fund account • pay dues">
      {/* BALANCE CARD */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/40">Available balance</div>
            <div className="text-2xl font-semibold text-white mt-1">
              {formatMoney(balance, currency)}
            </div>
            <div className="text-xs text-white/40 mt-2">
              Currency: <span className="text-white/70">{currency}</span>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        )}
      </div>

      {/* FUND WALLET */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-semibold text-white">Fund wallet</div>
        <div className="text-xs text-white/40 mt-1">
          Payments are processed via Paystack.
        </div>

        <div className="mt-4 grid gap-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="Amount (e.g. 5000)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
          />

          <button
            onClick={fund}
            disabled={funding || !amount}
            className="w-full py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-semibold disabled:opacity-50"
          >
            {funding ? "Starting..." : "Fund with Paystack"}
          </button>

          <div className="text-[11px] text-white/40">
            Tip: after payment completes, wallet balance updates via webhook. If it doesn’t update immediately, tap refresh.
          </div>
        </div>
      </div>

      {/* FUTURE: DUES / BILLS */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">Estate dues (next)</div>
        <div className="text-xs text-white/40 mt-1">
          We’ll list bills here and let you pay directly from wallet.
        </div>
      </div>
    </ConsumerShell>
  );
}
