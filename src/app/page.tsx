"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, LogIn, QrCode, Sparkles } from "lucide-react";
import { decodeToken, isExpired } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";

export default function LandingPage() {
  const router = useRouter();
  const { hydrate, token } = useSessionStore();
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    hydrate();
    const timer = window.setTimeout(() => setPreparing(false), 1150);
    return () => window.clearTimeout(timer);
  }, [hydrate]);

  useEffect(() => {
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) return;
    router.replace("/home");
  }, [token, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02060b] text-white">
      <div className="oyi-ambient-bg" />
      <div className="relative flex min-h-screen items-center justify-center px-5 py-[calc(28px+var(--sat))]">
        <section className="w-full max-w-[390px]">
          <div className="flex flex-col items-center text-center">
            <div className="oyi-orb grid h-28 w-28 place-items-center rounded-full text-[24px] font-semibold tracking-[-0.09em] shadow-[0_0_70px_rgba(0,102,255,0.22)]">
              Oyi
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200/56">Living intelligence</p>
            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.065em] text-white">Welcome home.</h1>
            <p className="mt-2 max-w-[300px] text-sm leading-6 text-white/48">
              Your secure invitation connects your home, services, and Oyi intelligence.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_26px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
            {preparing ? (
              <div className="px-3 py-8 text-center">
                <Sparkles className="mx-auto h-5 w-5 animate-pulse text-sky-200" />
                <p className="mt-4 text-sm font-medium text-white/82">Preparing your living intelligence</p>
                <div className="mx-auto mt-5 h-[2px] w-40 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-400/70" />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => router.push("/auth/invite?mode=scan")}
                  className="flex w-full items-center gap-3 rounded-[18px] border border-sky-400/20 bg-sky-500/12 px-4 py-3.5 text-left transition hover:bg-sky-500/18 active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-sky-400/20 bg-sky-500/12">
                    <QrCode className="h-4.5 w-4.5 text-sky-100" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Scan invitation</span>
                    <span className="mt-0.5 block text-xs text-white/42">Use the QR code from your estate.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/34" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/auth/invite")}
                  className="flex w-full items-center gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045]">
                    <Link2 className="h-4.5 w-4.5 text-white/68" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Paste setup link</span>
                    <span className="mt-0.5 block text-xs text-white/42">Enter your secure invitation manually.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/34" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="flex w-full items-center gap-3 rounded-[18px] border border-white/[0.08] bg-black/20 px-4 py-3.5 text-left transition hover:bg-white/[0.045] active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035]">
                    <LogIn className="h-4.5 w-4.5 text-white/62" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Sign in</span>
                    <span className="mt-0.5 block text-xs text-white/42">Open your existing Oyi Home.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/34" />
                </button>
              </div>
            )}
          </div>

          {!preparing ? (
            <button type="button" onClick={() => router.push("/auth/signup")} className="mx-auto mt-5 block text-xs text-white/28 transition hover:text-white/48">
              Development signup
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
