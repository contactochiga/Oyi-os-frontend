// src/app/wallet/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { walletService, type WalletDTO } from "@/services/walletService";
import { servicesService, type ServicePayment } from "@/services/servicesService";

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
  const [servicePayments, setServicePayments] = useState<ServicePayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<ServicePayment | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const transactionId = String(new URLSearchParams(window.location.search).get("transactionId") || "").trim();
    if (!transactionId || !servicePayments.length) return;
    const found = servicePayments.find((payment) => String(payment.id) === transactionId || String(payment.reference || "") === transactionId);
    if (found) setSelectedPayment(found);
  }, [servicePayments]);

  useEffect(() => {
    (async () => {
      const rows = await servicesService.history({ limit: 5 });
      setServicePayments(Array.isArray(rows) ? rows : []);
    })();
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
    const paymentReference = reference;

    let cancelled = false;

    async function verifyAndRefresh() {
      setErr(null);
      setInfo("Verifying payment...");

      const verifyRes: any = await walletService.verifyPayment(paymentReference);
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
    <ConsumerShell title="Wallet" subtitle="Home operations finance • dues • utilities">
      <div className="oyi-living-page space-y-3 pb-8">
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

      <section className="oyi-environment-hero rounded-[24px] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Available Balance</div>
            <div className="mt-2 text-2xl leading-tight font-semibold text-white tracking-tight">
              {formatMoney(balance, currency)}
            </div>

            <div className="mt-2 text-xs text-white/45">
              Estate dues, utility payments and service charges stay tied to this home.
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? "Syncing" : "Refresh"}
          </button>
        </div>

        <div className="mt-4 border-t border-white/10" />

        <div className="mt-4">
          <div className="text-sm font-medium text-white">Fund wallet</div>
          <div className="mt-1 text-xs text-white/40">
            Payments run securely through Paystack.
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
          <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-white/10 bg-black/[0.16] px-3 py-2.5">
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
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">Home expenses</div>
            <div className="text-xs text-white/40 mt-1">
              Recent wallet-paid services tied to this account.
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {servicePayments.length ? (
            servicePayments.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelectedPayment(p)} className="oyi-presence-row w-full rounded-[16px] px-3 py-2 text-left">
                <div className="text-xs text-white/90">
                  {(p.service_title || p.service_key.replaceAll("_", " "))} • {formatMoney(p.amount, currency)}
                </div>
                <div className="text-[11px] text-white/50">{p.reference}</div>
                {p.bundle_name ? (
                  <div className="text-[11px] text-white/45">{p.bundle_name}</div>
                ) : null}
                {p.period_label ? (
                  <div className="text-[11px] text-white/45">{p.period_label}</div>
                ) : null}
                {p.computed_units != null && p.unit_name ? (
                  <div className="text-[11px] text-white/45">
                    {p.computed_units} {p.unit_name} @ {formatMoney(Number(p.unit_cost || 0), currency)}
                  </div>
                ) : null}
              </button>
            ))
          ) : (
            <div className="text-xs text-white/40">No service payments yet.</div>
          )}
        </div>
      </section>
      {selectedPayment ? (
        <div className="fixed inset-0 z-[125]">
          <button type="button" aria-label="Close transaction details" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedPayment(null)} />
          <section className="absolute inset-x-4 bottom-[calc(16px+var(--sab))] mx-auto max-w-xl rounded-[26px] border border-white/10 bg-zinc-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-sky-100/54">Wallet transaction</div>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em] text-white">{selectedPayment.service_title || selectedPayment.service_key.replaceAll("_", " ")}</h2>
            <div className="mt-2 text-2xl font-semibold text-cyan-100">{formatMoney(selectedPayment.amount, currency)}</div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs text-white/58">
              <div>Reference: <span className="text-white/82">{selectedPayment.reference || "—"}</span></div>
              <div className="mt-1">Status: <span className="capitalize text-white/82">{selectedPayment.status || "recorded"}</span></div>
              <div className="mt-1">Date: <span className="text-white/82">{selectedPayment.created_at ? new Date(selectedPayment.created_at).toLocaleString() : "—"}</span></div>
            </div>
            <button type="button" onClick={() => setSelectedPayment(null)} className="mt-4 h-11 w-full rounded-full bg-white text-sm font-semibold text-black">Close</button>
          </section>
        </div>
      ) : null}
      </div>
    </ConsumerShell>
  );
}
