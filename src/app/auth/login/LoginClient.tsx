// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useSessionStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const res = await loginWithEmail(email.trim(), password);

      if (res?.error || !res?.token) {
        setErr(res?.error || "Login failed");
        return;
      }

      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setErr("Invalid session token");
        return;
      }

      setCookie("oyi_consumer_token", res.token, 30);
      setSession(res.token);

      const next = searchParams.get("next");
      router.replace(next || "/home");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!email.trim() && !!password && !loading;

  return (
    <main className="min-h-screen text-white">
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        {/* ✅ Moderate mixed background (neutral, not shouty) */}
        <div className="pointer-events-none absolute inset-0">
          {/* soft white glow */}
          <div className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full bg-white/6 blur-3xl" />
          <div className="absolute top-1/4 -right-56 h-[720px] w-[720px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-56 left-1/3 h-[760px] w-[760px] rounded-full bg-white/4 blur-3xl" />

          {/* deep vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(7,10,18,0.72) 45%, rgba(7,10,18,0.97) 100%)",
            }}
          />

          {/* subtle grid (same vibe as your other screens) */}
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
              WebkitMaskImage:
                "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            }}
          />
        </div>

        {/* ✅ Card (Visitors language) */}
        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur shadow-[0_20px_90px_rgba(0,0,0,0.60)] overflow-hidden">
            {/* glass sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

            <div className="relative p-6">
              {/* Logo + minimal text */}
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 grid place-items-center">
                  {/* swap with real logo later */}
                  <span className="text-sm font-semibold tracking-wide text-white/90">
                    OYI
                  </span>
                </div>

                <div className="mt-4 text-lg font-semibold text-white">
                  Sign in
                </div>
                <div className="mt-1 text-xs text-white/40">
                  Continue to your dashboard
                </div>
              </div>

              {/* Inputs */}
              <div className="mt-6 space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 disabled:opacity-60"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 disabled:opacity-60"
                />

                {/* Error (same calm styling pattern) */}
                {err && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {err}
                  </div>
                )}

                {/* ✅ Primary action = neutral white (NO brand, NO red) */}
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  type="button"
                  className="w-full py-3 rounded-2xl bg-white text-black text-sm font-medium hover:opacity-90 disabled:opacity-40 transition active:scale-[0.99]"
                >
                  {loading ? "Signing in…" : "Continue"}
                </button>

                {/* Secondary */}
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="w-full py-3 rounded-2xl bg-white/10 text-white/80 text-sm border border-white/10 hover:bg-white/15 transition active:scale-[0.99]"
                  type="button"
                >
                  Create account
                </button>

                <div className="pt-1 text-center text-[11px] text-white/35">
                  Secure access • Minimal UI
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-white/30">
            Infrastructure-grade estate control
          </div>
        </div>
      </div>
    </main>
  );
}
