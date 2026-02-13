// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import API from "@/services/api";

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

      // ✅ keep cookie for web (fine if iOS ignores it)
      setCookie("oyi_consumer_token", res.token, 30);

      // ✅ store token immediately (so interceptor can use it too)
      setSession(res.token);

      // ✅ CRITICAL for iOS: set axios default header immediately
      API.defaults.headers.common.Authorization = `Bearer ${res.token}`;

      // ✅ pull full context (estate_id, home_id, email, etc) and store it
      try {
        const ctxRes = await API.get("/me/context");
        const ctx = ctxRes?.data;

        // depending on how your backend formats it, pick best shape
        const userFromCtx = ctx?.user || ctx?.profile || ctx?.me || ctx;

        if (userFromCtx) {
          setSession(res.token, userFromCtx);
        }
      } catch {
        // If /me/context fails, we still let user in with token-only.
        // (But normally it should succeed once Authorization is set above)
      }

      const next = searchParams.get("next");
      router.replace(next || "/home");
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!email.trim() && !!password && !loading;

  return (
    <main className="min-h-screen text-white">
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(circle at center, var(--brand) 0%, transparent 60%)",
            }}
          />
          <div
            className="absolute top-1/4 -right-56 h-[720px] w-[720px] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(circle at center, rgba(148,163,184,0.55) 0%, transparent 62%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(7,10,18,0.72) 45%, rgba(7,10,18,0.97) 100%)",
            }}
          />
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

        {/* Card */}
        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur shadow-[0_20px_90px_rgba(0,0,0,0.60)] overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.55,
              }}
            />

            <div className="relative p-6">
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

                <div className="mt-5 text-xl font-semibold text-white">
                  Sign in
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Continue to your dashboard
                </div>
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
