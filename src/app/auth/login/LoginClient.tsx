// src/app/auth/login/LoginClient.tsx
"use client";

import { useState } from "react";
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
      {/* Ultra-minimal background (no red) */}
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        {/* soft gradients */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-white/6 blur-3xl" />
          <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-[560px] w-[560px] rounded-full bg-white/4 blur-3xl" />
          {/* faint grid */}
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(circle at 50% 30%, black 0%, transparent 62%)",
              WebkitMaskImage:
                "radial-gradient(circle at 50% 30%, black 0%, transparent 62%)",
            }}
          />
        </div>

        {/* Card */}
        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.55)] overflow-hidden">
            {/* subtle top sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

            <div className="relative p-6">
              {/* Logo block (centered, clean) */}
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 grid place-items-center">
                  {/* If you have a real logo component/image, replace this */}
                  <span className="text-sm font-semibold tracking-wide text-white/90">
                    OYI
                  </span>
                </div>

                {/* Minimal text (no long write-ups) */}
                <div className="mt-4 text-lg font-semibold text-white/95">
                  Sign in
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Use your account details.
                </div>
              </div>

              {/* Inputs */}
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-transparent outline-none text-[16px] leading-[20px] text-white/90 placeholder-white/35"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
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

                {/* Primary action (no red) */}
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className={`
                    w-full py-3 rounded-2xl font-semibold text-sm
                    border transition active:scale-[0.99]
                    ${
                      canSubmit
                        ? "bg-white text-black border-white/20 hover:bg-white/90"
                        : "bg-white/10 text-white/40 border-white/10 opacity-70"
                    }
                  `}
                >
                  {loading ? "Signing in..." : "Continue"}
                </button>

                {/* Secondary */}
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="w-full py-3 rounded-2xl border border-white/10 bg-white/5 text-white/80 text-sm font-semibold hover:bg-white/10 transition active:scale-[0.99]"
                  type="button"
                >
                  Create account
                </button>

                {/* tiny footer link (optional) */}
                <div className="pt-2 text-center text-[11px] text-white/35">
                  By continuing, you agree to the estate platform terms.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom subtle hint */}
          <div className="mt-4 text-center text-[11px] text-white/30">
            Secure access • Minimal UI • Infrastructure-grade
          </div>
        </div>
      </div>
    </main>
  );
}
