"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import API, { setApiAuthToken } from "@/services/api";

function pickUserFromContext(payload: any) {
  return (
    payload?.user ||
    payload?.profile ||
    payload?.me ||
    payload?.resident ||
    payload?.account ||
    null
  );
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, hydrate, token } = useSessionStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) return;
    router.replace("/home");
  }, [token, router]);

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

      // ✅ Web cookie (fine if iOS ignores)
      setCookie("oyi_consumer_token", res.token, 30);

      // ✅ iOS / WebView: set auth on axios immediately
      setApiAuthToken(res.token);

      // ✅ store token immediately (user derived from token)
      setSession(res.token);

      // ✅ fetch context and store richer user
      try {
        const ctxRes = await API.get("/me/context");
        const payload = (ctxRes as any)?.data?.data ?? (ctxRes as any)?.data ?? null;

        const estate = payload?.estate ?? null;
        const home = payload?.home ?? null;

        const u = pickUserFromContext(payload);

        const mergedUser = {
          ...(u || {}),
          id: (u as any)?.id ?? decoded.id,
          email: (u as any)?.email ?? decoded.email ?? email.trim(),
          role: (u as any)?.role ?? decoded.role,
          full_name: (u as any)?.full_name ?? decoded.full_name,
          username: (u as any)?.username ?? decoded.username,
          phone: (u as any)?.phone ?? decoded.phone,
          avatar_url: (u as any)?.avatar_url ?? decoded.avatar_url,
          profile_image_url: (u as any)?.profile_image_url ?? decoded.profile_image_url,
          estate_id:
            (u as any)?.estate_id ?? estate?.id ?? payload?.estate_id ?? decoded.estate_id,
          home_id:
            (u as any)?.home_id ?? home?.id ?? payload?.home_id ?? decoded.home_id,
        };

        setSession(res.token, mergedUser as any);

        // ✅ legacy LS keys some pages still read directly
        if (typeof window !== "undefined") {
          if (estate?.id) localStorage.setItem("ochiga_estate", String(estate.id));
          if (home?.id) localStorage.setItem("ochiga_home", String(home.id));
        }
      } catch {
        // ok
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
    <main className="min-h-screen overflow-hidden bg-[#02060b] text-white">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-[calc(26px+var(--sat))]">
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
              maskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            }}
          />
        </div>

        <div className="relative w-full max-w-[370px]">
          <div className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.55,
              }}
            />

            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="oyi-orb grid h-20 w-20 place-items-center rounded-full text-[18px] font-semibold tracking-[-0.08em]">Oyi</div>

                <div className="mt-5 text-[22px] font-semibold tracking-[-0.05em] text-white">Welcome home.</div>
                <div className="mt-1 text-xs text-white/45">Sign in to your living intelligence OS.</div>
              </div>

              <div className="mt-6 space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 disabled:opacity-60"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 disabled:opacity-60"
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

                <div className="pt-1 text-center text-[11px] text-white/32">
                  Calm home control · estate access · Oyi intelligence
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
