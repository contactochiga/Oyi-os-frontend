// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useSessionStore();

  // ✅ Brand color (your chosen brand)
  const BRAND = "#2563EB"; // change if needed

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

  const brandStyle = useMemo(
    () =>
      ({
        "--brand": BRAND,
      }) as React.CSSProperties,
    [BRAND]
  );

  return (
    <main className="min-h-screen text-white" style={brandStyle}>
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        {/* ✅ Background: moderate mix */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full blur-3xl opacity-30"
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
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(7,10,18,0.65) 45%, rgba(7,10,18,0.95) 100%)",
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

        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_90px_rgba(0,0,0,0.60)] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.65,
              }}
            />

            <div className="relative p-6">
              {/* Logo */}
              <div className="flex flex-col items-center text-center">
                <div
                  className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 grid place-items-center"
                  style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.04)" }}
                >
                  <span className="text-sm font-semibold tracking-wide text-white/90">
                    OYI
                  </span>
                </div>

                <div className="mt-4 text-lg font-semibold text-white/95">
                  Sign in
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Continue to your estate dashboard
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 focus-within:border-white/20">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-transparent outline-none text-[16px] leading-[20px] text-white/90 placeholder-white/35"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 focus-within:border-white/20">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-transparent outline-none text-[16px] leading-[20px] text-white/90 placeholder-white/35"
                  />
                </div>

                {err && (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {err}
                  </div>
                )}

                {/* ✅ Bulletproof primary: no bg classes, no shorthand background */}
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  type="button"
                  className="w-full py-3 rounded-2xl font-semibold text-sm transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/10"
                  style={{
                    // IMPORTANT: split background into color + image so global "background:" overrides don't win easily
                    backgroundColor: canSubmit ? "var(--brand)" : "rgba(255,255,255,0.10)",
                    backgroundImage: canSubmit
                      ? "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.18) 100%)"
                      : "none",
                    boxShadow: canSubmit
                      ? "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.10) inset"
                      : "0 0 0 1px rgba(255,255,255,0.10) inset",
                    color: canSubmit ? "#ffffff" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {loading ? "Signing in..." : "Continue"}
                </button>

                <button
                  onClick={() => router.push("/auth/signup")}
                  className="w-full py-3 rounded-2xl border border-white/10 bg-white/5 text-white/80 text-sm font-semibold hover:bg-white/10 transition active:scale-[0.99]"
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
