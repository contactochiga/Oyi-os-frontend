"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { walletService, type WalletFundingStatusResponse } from "@/services/walletService";

function formatMoney(amount?: number, currency = "NGN") {
  const safeAmount = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${currency || "NGN"} ${safeAmount.toFixed(2)}`;
  }
}

export default function WalletPaymentReturnPage() {
  const [result, setResult] = useState<WalletFundingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reference = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return String(params.get("reference") || params.get("trxref") || "").trim();
  }, []);

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      setError("Payment reference is missing.");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      const shouldReconcile = attempts > 0;
      const response = await walletService.getFundingStatus(reference, { reconcile: shouldReconcile });
      if (cancelled) return;
      if (response?.error) {
        setError(String(response.error));
        setResult(null);
        setLoading(false);
        return;
      }

      setResult(response);
      const isPending = response?.state === "pending";
      if (isPending && attempts < 4) {
        attempts += 1;
        window.setTimeout(poll, 2500);
        return;
      }

      setLoading(false);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const currency = result?.transaction?.currency || result?.receipt?.currency || "NGN";
  const amount = result?.receipt?.credited_amount ?? result?.transaction?.amount ?? result?.receipt?.amount ?? 0;
  const strip = [
    { label: "Reference", value: reference || "Pending" },
    { label: "State", value: result?.state || (loading ? "Checking" : "Unknown") },
    { label: "Amount", value: formatMoney(amount, currency) },
  ];

  const title = result?.title || (loading ? "Confirming your payment" : "Payment status");
  const subtitle =
    result?.summary ||
    (loading
      ? "We are checking the latest wallet confirmation."
      : error || "Review your latest wallet funding status.");

  const canViewReceipt = Boolean(result?.receipt || result?.transaction?.receipt_available);

  return (
    <ConsumerShell title={title} subtitle={subtitle} strip={strip}>
      <div className="oyi-living-page space-y-3 pb-8">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="mt-1 text-xs text-white/45">{subtitle}</div>

          <div className="mt-4 rounded-[18px] border border-white/10 bg-black/[0.16] p-4">
            {loading ? (
              <div className="text-sm text-white/70">Confirming your payment…</div>
            ) : error ? (
              <div className="text-sm text-red-200">{error}</div>
            ) : (
              <>
                <div className="text-2xl font-semibold text-white">{formatMoney(amount, currency)}</div>
                <div className="mt-2 text-xs text-white/45">Reference: {reference}</div>
                <div className="mt-1 text-xs text-white/45">
                  Status: <span className="capitalize text-white/80">{result?.status || result?.state || "pending"}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canViewReceipt ? (
              <Link href={`/wallet?receipt=${encodeURIComponent(reference)}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
                View receipt
              </Link>
            ) : null}
            <Link href="/wallet" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
              View wallet
            </Link>
            <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
              Return home
            </Link>
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
