// src/app/wallet/page.tsx
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
  const email = useMemo(() => user?.email || "", [user?.email]);

  const [wallet, setWallet] = useState<WalletDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");

  async function load() {
    setLoading(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fund() {
    setErr(null);
    setInfo(null);

    const n = safeNum(amount);
    if (!email) return setErr("No email found for this account.");
    if (!n || n < 100) return setErr("Enter an amount of at least ₦100.");

    setFunding(true);
    try {
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/wallet?funding=1`
          : undefined;

      const res: any = await walletService.initPayment({
        amount: n,
        email,
        callback_url: callbackUrl,
      });

      if (res?.error) {
        const text = String(res.error || "");
        if (text.toLowerCase().includes("disabled")) {
          setErr("Wallet funding is disabled on backend. Set WALLET_FUNDING_ENABLED=true and redeploy.");
        } else {
          setErr(text);
        }
        return;
      }

      const url =
        res?.data?.authorization_url ||
        res?.authorization_url ||
        res?.data?.data?.authorization_url;

      if (!url) {
        setErr(
          "Payment initialized but Paystack URL missing (check backend response)."
        );
        return;
      }

      window.location.href = String(url);
    } catch (e: any) {
      setErr(e?.message || "Failed to start funding");
    } finally {
      setFunding(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const funding = url.searchParams.get("funding");
    const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
    if (!funding || !reference) return;

    let cancelled = false;

    async function verifyAndRefresh() {
      setErr(null);
      setInfo("Verifying payment...");

      const verifyRes: any = await walletService.verifyPayment(reference);
      if (cancelled) return;

      if (verifyRes?.error) {
        setErr(String(verifyRes.error));
        setInfo(null);
      } else {
        setInfo("Payment verified. Wallet updated.");
      }

      await load();
    }

    verifyAndRefresh();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currency = wallet?.currency || "NGN";
  const balance = safeNum(wallet?.balance);

  const quickAmounts = [1000, 5000, 10000, 20000];

  return (
    <ConsumerShell title="Wallet" subtitle="Fund account • pay dues">
      {info && (
        <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {info}
        </div>
      )}

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-white/50">Available balance</div>
            <div className="mt-2 text-[28px] leading-tight font-semibold text-white tracking-tight">
              {formatMoney(balance, currency)}
            </div>

            <div className="mt-2 text-xs text-white/40">
              Currency: <span className="text-white/70">{currency}</span>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="shrink-0 rounded-xl px-3 py-2 text-sm text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="mt-5 border-t border-white/10" />

        <div className="mt-4">
          <div className="text-sm font-medium text-white">Fund wallet</div>
          <div className="mt-1 text-xs text-white/40">
            Payments run through Paystack. You’ll be redirected to complete
            payment.
          </div>

          {/* Quick picks */}
          <div className="mt-4 flex flex-wrap gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="rounded-full px-3 py-2 text-xs bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition"
              >
                ₦{q.toLocaleString("en-NG")}
              </button>
            ))}
          </div>

          {/* Input + action */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="text-xs text-white/40 pl-1">₦</div>

            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="Amount"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
            />

            <button
              onClick={fund}
              disabled={funding || !amount}
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-medium
                         bg-white text-black hover:opacity-90
                         disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {funding ? "Starting…" : "Fund"}
            </button>
          </div>

          <div className="mt-3 text-[11px] text-white/35">
            Balance updates via webhook. If funding returns to this page, verification runs automatically.
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">Estate dues</div>
            <div className="text-xs text-white/40 mt-1">
              Bills will appear here for direct payment from wallet.
            </div>
          </div>

          <div className="text-xs text-white/40">Coming soon</div>
        </div>
      </div>
    </ConsumerShell>
  );
}
