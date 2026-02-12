// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
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
        {/* Background (same vibe as landing) */}
        <div className="pointer-events-none absolute inset-0">
          {/* brand glow */}
          <div
            className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full blur-3xl opacity-25"
            style={{
              background: "radial-gradient(circle at center, var(--brand) 0%, transparent 60%)",
            }}
          />
          {/* cool neutral glow */}
          <div
            className="absolute top-1/4 -right-56 h-[720px] w-[720px] rounded-full blur-3xl opacity-25"
            style={{
              background: "radial-gradient(circle at center, rgba(148,163,184,0.55) 0%, transparent 62%)",
            }}
          />
          {/* deep vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(7,10,18,0.72) 45%, rgba(7,10,18,0.97) 100%)",
            }}
          />
          {/* subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            }}
          />
        </div>

        {/* Card */}
        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur shadow-[0_20px_90px_rgba(0,0,0,0.60)] overflow-hidden">
            {/* Top micro highlight */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.55,
              }}
            />

            <div className="relative p-6">
              {/* Logo */}
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-2xl border border-white/10 bg-black/20 grid place-items-center overflow-hidden">
                  <div className="relative h-10 w-10">
                    <Image
                      src="/oyi-logo-transparent.png"
                      alt="Oyi OS Logo"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>

                <div className="mt-5 text-xl font-semibold text-white">Sign in</div>
                <div className="mt-1 text-xs text-white/45">Continue to your dashboard</div>
              </div>

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

                {err && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {err}
                  </div>
                )}

                {/* ✅ Primary = brand (not red) */}
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  type="button"
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                    color: "#fff",
                    boxShadow:
                      "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                  }}
                >
                  {loading ? "Signing in…" : "Continue"}
                </button>

                <button
                  onClick={() => router.push("/auth/signup")}
                  className="w-full py-3 rounded-2xl bg-white/10 text-white/85 text-sm font-semibold hover:bg-white/15 transition active:scale-[0.99] border border-white/10"
                  type="button"
                >
                  Create account
                </button>

                <div className="pt-1 text-center text-[11px] text-white/35">
                  Secure • Private • Estate-native
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
